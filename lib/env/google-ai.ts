import { createGoogleGenerativeAI } from "@ai-sdk/google"

/**
 * 문서/예제마다 이름이 달라서 흔한 변형을 모두 허용합니다.
 */
export function getGoogleGenerativeAiApiKey(): string | undefined {
  const raw =
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    ""
  const k = raw.trim()
  return k || undefined
}

/** 무료 키·지역에 따라 2.5가 막히는 경우가 있어 2.0을 기본으로 둡니다. */
export function getGoogleGenerativeAiModelId(): string {
  const fromEnv =
    process.env.GOOGLE_GENERATIVE_AI_MODEL?.trim() ||
    process.env.GEMINI_MODEL?.trim() ||
    ""
  return fromEnv || "gemini-2.0-flash"
}

export function createGoogleAiProvider() {
  const apiKey = getGoogleGenerativeAiApiKey()
  if (!apiKey) return null
  return createGoogleGenerativeAI({ apiKey })
}
