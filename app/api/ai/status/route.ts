import { NextResponse } from "next/server"

import {
  getGoogleGenerativeAiApiKey,
  getGoogleGenerativeAiModelId,
} from "@/lib/env/google-ai"
import { isSupabaseConfigured } from "@/lib/supabase/credentials"

export const runtime = "nodejs"

/**
 * AI·Supabase 설정 여부만 반환합니다(키 값은 노출하지 않음).
 * 브라우저에서 /api/ai/status 로 열어 디버깅할 수 있습니다.
 */
export async function GET() {
  const googleKey = Boolean(getGoogleGenerativeAiApiKey())
  const modelId = getGoogleGenerativeAiModelId()

  return NextResponse.json({
    supabaseEnvOk: isSupabaseConfigured(),
    googleAiKeySet: googleKey,
    modelId,
    hint: googleKey
      ? "서버가 Google AI 키를 읽었습니다. AI가 여전히 실패하면 터미널 로그·모델명·할당량을 확인하세요."
      : "서버에 GOOGLE_GENERATIVE_AI_API_KEY 또는 GEMINI_API_KEY 가 없습니다. .env.local 저장 후 dev 서버를 재시작하세요.",
  })
}
