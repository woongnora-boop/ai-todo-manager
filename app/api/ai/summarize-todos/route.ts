import { APICallError } from "ai"
import { NextResponse } from "next/server"
import { z } from "zod"

import {
  GEMINI_QUOTA_ERROR_CODE,
  geminiQuotaUserMessage,
  isGeminiQuotaExceeded,
} from "@/lib/ai/detect-gemini-quota"
import { generateZodWithTextJsonFallback } from "@/lib/ai/generate-zod-with-json-fallback"
import { createClient } from "@/lib/supabase/server"
import {
  buildRichAnalysisPayload,
  buildSummaryMetrics,
  emptySummaryMetrics,
  filterTodosByPeriod,
  type SummarizePeriod,
} from "@/lib/ai/summarize-todos-helpers"
import type { Todo } from "@/components/todo/TodoCard"
import { coerceTodoPriority } from "@/lib/todos/priority"
import {
  createGoogleAiProvider,
  getGoogleGenerativeAiApiKey,
  getGoogleGenerativeAiModelId,
} from "@/lib/env/google-ai"

export const runtime = "nodejs"

const bodySchema = z.object({
  period: z.enum(["today", "week"]),
})

const summarizeOutputSchema = z.object({
  summary: z.string().min(1).max(3500),
  urgentTasks: z.array(z.string().max(400)).max(12),
  insights: z.array(z.string().max(700)).max(14),
  recommendations: z.array(z.string().max(700)).max(12),
  nextWeekSuggestions: z.array(z.string().max(500)).max(8),
})

/** Gemini 등이 단일 문자열·코드펜스 형태로 줄 때 zod 통과용 */
function toStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean)
  if (typeof v === "string" && v.trim()) return [v.trim()]
  return []
}

function normalizeSummaryOutput(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw
  const o = raw as Record<string, unknown>
  const summary =
    typeof o.summary === "string"
      ? o.summary.trim()
      : o.summary != null
        ? String(o.summary).trim()
        : ""
  return {
    summary,
    urgentTasks: toStringArray(o.urgentTasks),
    insights: toStringArray(o.insights),
    recommendations: toStringArray(o.recommendations),
    nextWeekSuggestions: toStringArray(o.nextWeekSuggestions),
  }
}

function mapRow(row: Record<string, unknown>): Todo {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    title: String(row.title),
    description: (row.description as string | null) ?? null,
    created_date: (row.created_date as string | null) ?? null,
    due_date: (row.due_date as string | null) ?? null,
    priority: coerceTodoPriority(row.priority),
    category_id: (row.category_id as string | null) ?? null,
    completed: Boolean(row.completed),
  }
}

function emptyResponse(period: SummarizePeriod) {
  const isToday = period === "today"
  return {
    summary: isToday
      ? "오늘 마감이거나 오늘 만든 할 일이 아직 없어요."
      : "이번 주(월~일, 서울 기준)에 해당하는 할 일이 없어요.",
    urgentTasks: [] as string[],
    insights: [
      isToday
        ? "오늘 다룰 할 일을 추가하면 요약을 받아볼 수 있어요."
        : "이번 주 일정을 할 일에 담아 두면 주간 패턴을 분석해 드려요.",
    ],
    recommendations: ["새 할 일을 추가하거나, 마감일을 설정해 보세요."],
    nextWeekSuggestions: [] as string[],
    metrics: emptySummaryMetrics(period),
  }
}

export async function POST(request: Request) {
  const googleAi = createGoogleAiProvider()
  if (!getGoogleGenerativeAiApiKey() || !googleAi) {
    return NextResponse.json(
      {
        error:
          "AI 서비스가 설정되지 않았습니다. GOOGLE_GENERATIVE_AI_API_KEY 또는 GEMINI_API_KEY 를 확인해 주세요.",
      },
      { status: 503 }
    )
  }
  const modelId = getGoogleGenerativeAiModelId()

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: "JSON 본문이 필요합니다." }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "period는 \"today\" 또는 \"week\" 여야 합니다." },
      { status: 400 }
    )
  }

  const { period } = parsed.data

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 })
  }

  const { data: rows, error: dbError } = await supabase
    .from("todos")
    .select("*")
    .eq("user_id", user.id)
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(500)

  if (dbError) {
    return NextResponse.json({ error: "할 일 목록을 불러오지 못했습니다." }, { status: 500 })
  }

  const allTodos = (rows ?? []).map((r) => mapRow(r as Record<string, unknown>))
  const filtered = filterTodosByPeriod(allTodos, period)

  if (filtered.length === 0) {
    return NextResponse.json(emptyResponse(period))
  }

  const periodLabel = period === "today" ? "오늘(서울 달력 기준 당일)" : "이번 주(서울 기준 월요일~일요일)"
  const rich = buildRichAnalysisPayload(allTodos, filtered, period)
  const a = rich.current

  const system = `역할: 할 일 앱의 생산성 코치이자 따뜻한 동반자입니다. 아래 JSON 데이터만 근거로 분석하세요. 추측으로 숫자를 만들지 마세요.

톤: 한국어, 자연스럽고 친근하며 긍정적입니다. 개선점은 비난이 아니라 격려와 함께 제시하고, 잘한 점은 구체적으로 칭찬합니다. 바로 실천할 수 있는 문장으로 씁니다.

출력: 오직 지정된 JSON 스키마의 객체 하나만 (다른 텍스트·코드펜스 금지).

필드별 지침:
1) summary (3~6문장)
   - 현재 기간 완료율·전체/완료/미완료를 요약합니다.
   - comparison이 있으면 이전 기간(어제 또는 직전 주) 대비 완료율·완료 개수 변화 방향을 한두 문장에 녹입니다. 이전 기간 데이터가 0건이면 과장 없이 언급만 합니다.
   - 우선순위별 완료 패턴(priorityCompletion)을 한 줄 안에서 짚습니다.
   - 긍정 피드백: 잘하고 있는 점·유지하면 좋은 습관을 반드시 한 문장 이상 포함합니다.
   - 기간별: period가 오늘이면 오늘 남은 일·집중 포인트를, 주간이면 주간 흐름을 한 문장 포함합니다.

2) urgentTasks (최대 8개, 제목 문자열만)
   - 미완료 중 priority가 high이거나, 마감이 임박·지난 항목을 우선합니다.

3) insights (5~10개 권장, 각각 한 문장)
   다음 축을 데이터에 맞게 골고루 반영하세요 (해당 없으면 생략):
   · 완료율·우선순위별 완료율(priorityCompletion) 해석
   · 이전 기간 대비 개선·후퇴(comparison.snapshot vs 현재)
   · 마감 준수: todosWithDueDateInScope, overdueIncompleteCount, pastDueHandledPercent, createdEarlierDueInScopeCount
   · 시간대: current.dueHourDistribution 전체(마감 집중) + productivity.completedCountByDueHour·peakHour(완료된 일의 마감 시각 분포)
   · 요일: productivity.completedCountByDueWeekdayKo·peakWeekdayKo
   · titleSamples로 미완료 vs 완료 제목 차이(반복되는 유형·짧은 일 등)를 신중히 언급 — 확실하지 않으면 약하게 표현

4) recommendations (5~8개 권장)
   - 구체적 시간 관리 팁(예: 오전 블록, 짧은 정리 시간)
   - 우선순위 재조정·일정 재배치
   - 과부하 완화를 위한 업무 분산·쪼개기
   - 다음 주 준비(주간 분석일 때만 자연스럽게)
   - 동기부여 한두 문장은 insights 또는 recommendations 어디에든 녹일 수 있습니다.

5) 기간별 차별화 (userPayload 분석_범위를 확인)
   - 오늘: 당일 마감·시간대 집중도, 남은 할 일 우선순위, 오늘 안에 끝낼 수 있는 작은 행동 제안.
   - 이번 주: 주간 완료 패턴, 요일·시간대 생산성, 직전 주 대비 흐름, 다음 주 계획·리듬 조정 제안.

6) nextWeekSuggestions (문자열 배열)
   - 분석 범위가 "이번 주"일 때: 다음 주에 옮기거나 준비하면 좋은 일 2~5개를 짧은 문장으로.
   - 분석 범위가 "오늘"이면 반드시 빈 배열 [].

주의: DB에 완료 시각이 없으므로 '완료한 시각'은 추정하지 말고, 마감 시각·생성일·완료 여부 등 주어진 필드만 사용하세요.`

  const userPayload = {
    분석_범위: periodLabel,
    현재_기간_핵심: {
      전체: a.total,
      완료: a.completed,
      미완료: a.incomplete,
      완료율_퍼센트: a.completionRatePercent,
      우선순위_개수: a.byPriority,
      마감시각_서울_시간대별_개수_전체: a.dueHourDistribution,
    },
    이전_기간_비교: rich.comparison,
    우선순위별_완료_패턴: rich.priorityCompletion,
    시간_관리_지표: rich.timeManagement,
    생산성_패턴_완료된_일_기준_마감시각: rich.productivity,
    제목_샘플_패턴용: rich.titleSamples,
    // 토큰·컨텍스트 한도 대비 (전체 DB는 이미 기간 필터됨)
    할일_목록_요약: a.todosBrief.slice(0, 150),
  }

  try {
    const data = await generateZodWithTextJsonFallback({
      model: googleAi(modelId),
      schema: summarizeOutputSchema,
      outputName: "TodoSummary",
      outputDescription: "할 일 요약 및 인사이트",
      system,
      prompt: JSON.stringify(userPayload, null, 2),
      temperature: 0.35,
      normalizeBeforeParse: normalizeSummaryOutput,
      logLabel: "summarize-todos",
    })

    const payload = {
      ...data,
      nextWeekSuggestions: period === "today" ? [] : data.nextWeekSuggestions,
    }

    const metrics = buildSummaryMetrics(filtered, rich)
    return NextResponse.json({ ...payload, metrics })
  } catch (error) {
    if (error instanceof Error && error.message === GEMINI_QUOTA_ERROR_CODE) {
      return NextResponse.json({ error: geminiQuotaUserMessage() }, { status: 429 })
    }

    if (error instanceof Error && error.message.startsWith("AI_JSON_")) {
      return NextResponse.json(
        {
          error:
            "AI가 요약 형식으로 답하지 않았습니다. 잠시 후 다시 시도해 주세요.",
        },
        { status: 502 }
      )
    }

    if (APICallError.isInstance(error)) {
      if (isGeminiQuotaExceeded(error) || error.statusCode === 429) {
        return NextResponse.json({ error: geminiQuotaUserMessage() }, { status: 429 })
      }
      const isInvalidKey =
        `${error.message}\n${error.responseBody ?? ""}`.includes("API_KEY_INVALID") ||
        `${error.message}\n${error.responseBody ?? ""}`.includes("API key not valid")
      if (isInvalidKey) {
        return NextResponse.json({ error: "Google AI API 키를 확인해 주세요." }, { status: 401 })
      }
      return NextResponse.json(
        { error: "AI 서비스와 통신할 수 없습니다. 잠시 후 다시 시도해 주세요." },
        { status: 500 }
      )
    }

    if (isGeminiQuotaExceeded(error)) {
      return NextResponse.json({ error: geminiQuotaUserMessage() }, { status: 429 })
    }

    const message = error instanceof Error ? error.message : String(error)
    if (process.env.NODE_ENV === "development") {
      console.error("[summarize-todos]", error)
    }
    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === "development"
            ? `요약 처리 오류: ${message.slice(0, 300)}`
            : "요약 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
      },
      { status: 500 }
    )
  }
}
