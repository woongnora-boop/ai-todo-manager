import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/credentials"

export async function createClient() {
  const cookieStore = await cookies()

  const url = getSupabaseUrl()
  const key = getSupabaseAnonKey()

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL and anon/publishable key. .env.local 을 확인한 뒤 서버를 재시작하세요."
    )
  }

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            // Supabase는 로그아웃 시 value: "" 로 청크를 지움. Next cookieStore.set("",)는
            // 삭제가 안 될 수 있어 delete를 쓴다.
            if (value === "" || value == null) {
              cookieStore.delete(name)
            } else {
              cookieStore.set(name, value, options)
            }
          })
        } catch (e) {
          if (process.env.NODE_ENV === "development") {
            console.error("[supabase server] cookie setAll failed:", e)
          }
        }
      },
    },
  })
}
