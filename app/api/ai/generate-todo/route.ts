import { APICallError } from "ai"
import { NextResponse } from "next/server"
import { z } from "zod"

import {
  GEMINI_QUOTA_ERROR_CODE,
  geminiQuotaUserMessage,
  isGeminiQuotaExceeded,
} from "@/lib/ai/detect-gemini-quota"
import { generateZodWithTextJsonFallback } from "@/lib/ai/generate-zod-with-json-fallback"
import { postProcessGeneratedPayload } from "@/lib/ai/generate-todo-post"
import type { AiTodoPayload } from "@/lib/ai/generate-todo-types"
import { inferCategoryLabel, normalizeCategoryLabel } from "@/lib/ai/infer-category"
import { preprocessPrompt, validatePromptProcessed } from "@/lib/ai/prompt-pipeline"
import { getSeoulNowContext, kstDateTimeToIso } from "@/lib/ai/kst-due-date"
import {
  createGoogleAiProvider,
  getGoogleGenerativeAiApiKey,
  getGoogleGenerativeAiModelId,
} from "@/lib/env/google-ai"

export const runtime = "nodejs"

const aiTodoSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(8000).optional().nullable(),
  due_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  due_time: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional()
    .nullable(),
  priority: z.enum(["high", "medium", "low"]),
  category: z.string().max(100).optional().nullable(),
})

type AiTodo = z.infer<typeof aiTodoSchema>

const DEFAULT_TIME = "09:00"

function toApiPayload(
  parsed: AiTodo,
  categoryResolved: string | null
): AiTodoPayload {
  const dateYmd = parsed.due_date?.trim() || null
  let timeHm = parsed.due_time?.trim() || null
  if (dateYmd && !timeHm) timeHm = DEFAULT_TIME

  const due_date = dateYmd && timeHm ? kstDateTimeToIso(dateYmd, timeHm) : null

  return {
    title: parsed.title.trim(),
    description: parsed.description?.trim() || undefined,
    due_date,
    priority: parsed.priority,
    category_id: null,
    category: categoryResolved,
  }
}

function resolveCategory(prompt: string, parsed: AiTodo): string | null {
  const fromModel = normalizeCategoryLabel(parsed.category)
  if (fromModel) return fromModel
  const blob = `${prompt}\n${parsed.title}\n${parsed.description ?? ""}`
  return inferCategoryLabel(blob)
}

export async function POST(request: Request) {
  const googleAi = createGoogleAiProvider()
  if (!getGoogleGenerativeAiApiKey() || !googleAi) {
    return NextResponse.json(
      {
        error:
          "AI 서비스가 설정되지 않았습니다. .env.local 에 GOOGLE_GENERATIVE_AI_API_KEY(또는 GEMINI_API_KEY)를 넣고 서버를 재시작해 주세요.",
      },
      { status: 503 }
    )
  }
  const modelId = getGoogleGenerativeAiModelId()

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json(
      { error: "요청 본문이 올바른 JSON 형식이 아닙니다. JSON으로 보내 주세요." },
      { status: 400 }
    )
  }

  if (!json || typeof json !== "object" || !("prompt" in json)) {
    return NextResponse.json({ error: "prompt 필드가 필요합니다." }, { status: 400 })
  }

  const rawPrompt = (json as { prompt: unknown }).prompt
  if (typeof rawPrompt !== "string") {
    return NextResponse.json({ error: "prompt는 문자열이어야 합니다." }, { status: 400 })
  }

  const prompt = preprocessPrompt(rawPrompt)
  const promptCheck = validatePromptProcessed(prompt)
  if (!promptCheck.ok) {
    return NextResponse.json({ error: promptCheck.error.message }, { status: 400 })
  }
  const { dateYmd, timeHm, weekdayKo } = getSeoulNowContext()

  const system = `당신은 할 일 앱용 데이터 변환기입니다. 사용자의 한국어 자연어 입력만 분석해, 지정된 스키마에 맞는 객체(JSON)로 출력합니다. 설명 문장·인사·코드펜스는 출력하지 마세요.

[기준] 시간대는 Asia/Seoul이다. 아래 "참조 시각"의 dateYmd를 "오늘(현재 날짜)"로 삼고 모든 상대 날짜를 계산한다.

[1. 날짜 처리 규칙 — 반드시 적용]
- 오늘 → 참조 시각의 dateYmd 그대로
- 내일 → 참조 dateYmd + 1일
- 모레 → 참조 dateYmd + 2일
- 이번 주 금요일 → "가장 가까운 금요일": 참조일 당일 포함 이후로 가장 먼저 도래하는 금요일의 YYYY-MM-DD
- 다음 주 월요일 → 참조일 기준 "다음 주"에 속하는 월요일(다음 주의 월요일)

날짜가 문맥에 없으면 due_date는 null. 있으면 반드시 YYYY-MM-DD.

[2. 시간 처리 규칙 — 반드시 적용]
구체 시각(예: 오후 3시 → 15:00)이 있으면 그것을 우선한다. 시각이 뭉뚱그려진 경우 아래로 매핑한다.
- 아침 → 09:00
- 점심 → 12:00
- 오후(단, "오후 N시"처럼 숫자 시각이 있으면 그 시각 우선) → 문맥상 시간대만 있을 때 14:00
- 저녁 → 18:00
- 밤 → 21:00

시각이 전혀 없으면 due_time은 null(서버가 날짜만 있을 때 09:00으로 보정). HH:mm 24시간 형식.

[3. 우선순위 — 키워드 기반]
- high: 입력에 다음 중 하나라도 있으면 high — "급하게", "중요한", "빨리", "꼭", "반드시"
- low: "여유롭게", "천천히", "언젠가" 중 하나라도 있으면 low
- medium: "보통", "적당히" 또는 위 high/low에 해당하는 표현이 없을 때 medium

[4. 카테고리 — 키워드로 분류]
아래 키워드가 제목·설명에 포함되면 해당 라벨을 category에 넣는다(복수 해당 시 문맥상 가장 적합한 하나). 해당 없으면 null.
- 업무: "회의", "보고서", "프로젝트", "업무"
- 개인: "쇼핑", "친구", "가족", "개인"
- 건강: "운동", "병원", "건강", "요가"
- 학습: "공부", "책", "강의", "학습"

[5. JSON 응답 형식 — 반드시 준수]
도구/스키마가 요구하는 필드만 사용한다: title, description, due_date, due_time, priority, category.
- title: 핵심 행동만 간결하게
- description: 부가 메모(선택). category 라벨과 중복 나열은 피한다.
- priority는 반드시 "high" | "medium" | "low" 중 하나
- category는 반드시 다음 중 하나의 정확한 문자열이거나 null: "업무", "개인", "건강", "학습" (다른 표현 금지)
- 불필요한 필드·주석·마크다운을 넣지 않는다.`

  const userContent = `참조 시각(서울): ${weekdayKo} ${dateYmd} ${timeHm}

사용자 입력:
${prompt}`

  try {
    const validated = await generateZodWithTextJsonFallback({
      model: googleAi(modelId),
      schema: aiTodoSchema,
      outputName: "TodoFields",
      outputDescription: "한국어 할 일에서 추출한 필드",
      system,
      prompt: userContent,
      temperature: 0.2,
      logLabel: "generate-todo",
    })

    const categoryResolved = resolveCategory(prompt, validated)
    const payload = postProcessGeneratedPayload(toApiPayload(validated, categoryResolved))
    return NextResponse.json(payload)
  } catch (error) {
    if (error instanceof Error && error.message === GEMINI_QUOTA_ERROR_CODE) {
      return NextResponse.json({ error: geminiQuotaUserMessage() }, { status: 429 })
    }

    if (error instanceof Error && error.message.startsWith("AI_JSON_")) {
      return NextResponse.json(
        {
          error:
            "AI가 올바른 형식으로 답하지 않았습니다. 문장을 짧게 바꿔 다시 시도해 주세요.",
        },
        { status: 502 }
      )
    }

    if (APICallError.isInstance(error)) {
      if (isGeminiQuotaExceeded(error) || error.statusCode === 429) {
        return NextResponse.json({ error: geminiQuotaUserMessage() }, { status: 429 })
      }
      const body = error.responseBody ?? ""
      const combined = `${error.message}\n${body}`
      const isInvalidKey =
        combined.includes("API_KEY_INVALID") ||
        combined.includes("API key not valid") ||
        combined.includes("API_KEY_INVALID_ARGUMENT")

      if (isInvalidKey) {
        return NextResponse.json(
          {
            error:
              "Google AI API 키가 유효하지 않습니다. https://aistudio.google.com/apikey 에서 키를 발급·확인한 뒤, 프로젝트 루트 .env.local 의 GOOGLE_GENERATIVE_AI_API_KEY 를 갱신하고 개발 서버를 재시작해 주세요. (따옴표·앞뒤 공백 없이 키만 넣었는지 확인하세요.)",
          },
          { status: 401 }
        )
      }

      if (process.env.NODE_ENV === "development") {
        console.error("[generate-todo] APICallError", error.statusCode, error.message, error.responseBody?.slice(0, 500))
      }

      const status =
        error.statusCode && error.statusCode >= 400 && error.statusCode < 500
          ? error.statusCode
          : 500

      const upstreamMsg =
        error.statusCode && error.statusCode >= 500
          ? "AI 서비스가 일시적으로 응답하지 않습니다. 잠시 후 다시 시도해 주세요."
          : "AI 서버와 통신할 수 없습니다. 네트워크와 API 설정을 확인한 뒤 다시 시도해 주세요."

      return NextResponse.json({ error: upstreamMsg }, { status })
    }

    if (isGeminiQuotaExceeded(error)) {
      return NextResponse.json({ error: geminiQuotaUserMessage() }, { status: 429 })
    }

    const message = error instanceof Error ? error.message : String(error)
    if (process.env.NODE_ENV === "development") {
      console.error("[generate-todo]", error)
    }
    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === "development"
            ? `AI 처리 오류: ${message.slice(0, 300)}`
            : "AI 처리 중 예기치 않은 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
      },
      { status: 500 }
    )
  }
}
