import type { LanguageModelV3 } from "@ai-sdk/provider"
import {
  extractJsonMiddleware,
  generateText,
  Output,
  wrapLanguageModel,
} from "ai"
import type { ZodType } from "zod"

import {
  GEMINI_QUOTA_ERROR_CODE,
  isGeminiQuotaExceeded,
} from "@/lib/ai/detect-gemini-quota"
import { parseLooseJson } from "@/lib/ai/parse-loose-json"

/**
 * 1) Output.object(구조화 출력) 시도 → 2) 실패 시 일반 텍스트로 JSON만 받아 파싱.
 * Gemini+구조화 출력이 불안정할 때 대비.
 */
export async function generateZodWithTextJsonFallback<T>(options: {
  model: LanguageModelV3
  schema: ZodType<T>
  outputName: string
  outputDescription: string
  system: string
  prompt: string
  temperature: number
  /** structured 단계 이후 safeParse 전에 정규화(요약 API용) */
  normalizeBeforeParse?: (raw: unknown) => unknown
  logLabel?: string
}): Promise<T> {
  const {
    model,
    schema,
    outputName,
    outputDescription,
    system,
    prompt,
    temperature,
    normalizeBeforeParse,
    logLabel = "ai-json",
  } = options

  const wrapped = wrapLanguageModel({
    model,
    middleware: extractJsonMiddleware(),
  })

  try {
    const result = await generateText({
      model: wrapped,
      output: Output.object({
        schema,
        name: outputName,
        description: outputDescription,
      }),
      system,
      prompt,
      temperature,
      maxRetries: 0,
    })
    if (result.output) {
      const candidate = normalizeBeforeParse
        ? normalizeBeforeParse(result.output)
        : result.output
      const v = schema.safeParse(candidate)
      if (v.success) return v.data
    }
  } catch (e) {
    if (isGeminiQuotaExceeded(e)) {
      throw new Error(GEMINI_QUOTA_ERROR_CODE)
    }
    if (process.env.NODE_ENV === "development") {
      console.warn(`[${logLabel}] 구조화 출력 실패 → 텍스트 JSON 폴백`, e)
    }
  }

  let textResult: Awaited<ReturnType<typeof generateText>>
  try {
    textResult = await generateText({
      model,
      system: `${system}

[출력 규칙 — 반드시 준수]
- 응답은 유효한 JSON 객체 한 개만 출력한다.
- 앞뒤 설명 문장, 마크다운, 코드펜스(백틱) 사용 금지.`,
      prompt,
      temperature,
      maxRetries: 0,
    })
  } catch (e) {
    if (isGeminiQuotaExceeded(e)) {
      throw new Error(GEMINI_QUOTA_ERROR_CODE)
    }
    throw e
  }

  let parsed: unknown
  try {
    parsed = parseLooseJson(textResult.text)
  } catch {
    throw new Error(
      `AI_JSON_PARSE: 모델이 JSON을 주지 않았습니다. raw=${textResult.text.slice(0, 280).replace(/\s+/g, " ")}`
    )
  }

  const normalized = normalizeBeforeParse ? normalizeBeforeParse(parsed) : parsed
  const v = schema.safeParse(normalized)
  if (!v.success) {
    const msg = v.error.issues.map((i) => i.message).join("; ")
    throw new Error(`AI_JSON_SCHEMA: ${msg.slice(0, 400)}`)
  }
  return v.data
}
