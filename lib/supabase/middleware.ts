import { createServerClient } from "@supabase/ssr"
import { type NextRequest, NextResponse } from "next/server"

import type { User } from "@supabase/supabase-js"

import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/credentials"

function getSupabaseEnv() {
  const url = getSupabaseUrl()
  const key = getSupabaseAnonKey()
  return { url, key }
}

/**
 * 요청 쿠키 기준으로 Supabase 세션을 갱신하고, 현재 사용자를 반환합니다.
 * (미들웨어에서 getUser() 호출 전후에 다른 로직을 끼우지 않는 것이 권장됩니다.)
 */
export async function updateSession(request: NextRequest): Promise<{
  response: NextResponse
  user: User | null
}> {
  const { url, key } = getSupabaseEnv()

  let response = NextResponse.next({ request })

  if (!url || !key) {
    return { response, user: null }
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value)
        })
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => {
          if (value === "" || value == null) {
            response.cookies.delete(name)
          } else {
            response.cookies.set(name, value, options)
          }
        })
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  return { response, user }
}
