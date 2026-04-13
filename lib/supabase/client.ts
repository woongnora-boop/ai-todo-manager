import { createBrowserClient } from "@supabase/ssr"

import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/credentials"

/**
 * 브라우저 번들에서 `process.env` 치환이 확실히 되도록,
 * NEXT_PUBLIC_* 는 next.config / 이 모듈에서 참조합니다.
 */
export function createClient() {
  const url = getSupabaseUrl()
  const key = getSupabaseAnonKey()

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL and anon/publishable key. .env.local 에 URL과 NEXT_PUBLIC_SUPABASE_ANON_KEY(또는 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)를 넣은 뒤 dev 서버를 재시작하세요."
    )
  }

  return createBrowserClient(url, key)
}
