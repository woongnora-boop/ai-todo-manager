import { APICallError, RetryError } from "ai"

export const GEMINI_QUOTA_ERROR_CODE = "GEMINI_QUOTA_EXCEEDED" as const

function appendErrorText(e: unknown, depth: number): string {
  if (depth > 8 || e == null) return ""
  if (typeof e === "string") return `${e}\n`
  if (APICallError.isInstance(e)) {
    return `${e.message}\n${e.responseBody ?? ""}\n${appendErrorText(e.cause, depth + 1)}`
  }
  if (RetryError.isInstance(e)) {
    let s = `${e.message}\n`
    for (const err of e.errors) {
      s += appendErrorText(err, depth + 1)
    }
    s += appendErrorText(e.lastError, depth + 1)
    return s
  }
  if (e instanceof Error) {
    const x = e as Error & { cause?: unknown; responseBody?: string }
    return `${e.message}\n${x.responseBody ?? ""}\n${appendErrorText(x.cause, depth + 1)}`
  }
  try {
    return `${JSON.stringify(e)}\n`
  } catch {
    return `${String(e)}\n`
  }
}

/** Gemini 무료 한도·일일 쿼터·429 류 */
export function isGeminiQuotaExceeded(error: unknown): boolean {
  const blob = appendErrorText(error, 0).toLowerCase()
  if (!blob.trim()) return false
  if (blob.includes("resource_exhausted")) return true
  if (blob.includes("exceeded your current quota")) return true
  if (blob.includes("quota exceeded")) return true
  if (blob.includes("check your plan and billing")) return true
  if (blob.includes("rate limit") && blob.includes("exceeded")) return true
  if (APICallError.isInstance(error) && error.statusCode === 429) return true
  return false
}

export function geminiQuotaUserMessage(): string {
  return [
    "Google Gemini API 사용 한도(쿼터)에 걸렸습니다.",
    "무료 키는 분·일 단위 제한이 작습니다. 잠시 후 다시 시도하거나, Google AI Studio에서 사용량·결제를 확인하세요.",
    "안내: https://ai.google.dev/gemini-api/docs/rate-limits",
  ].join(" ")
}
