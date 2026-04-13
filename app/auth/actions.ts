"use server"

import { createClient } from "@/lib/supabase/server"

export type SessionUser = {
  email: string
  name: string
}

export type SignOutResult = { ok: true } | { error: string }

/** 현재 세션 사용자 (없으면 null) */
export async function getSessionUserAction(): Promise<SessionUser | null> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()
    if (error || !user) return null
    const meta = user.user_metadata as { full_name?: string } | undefined
    const name =
      meta?.full_name?.trim() ||
      user.email?.split("@")[0] ||
      "사용자"
    return {
      email: user.email ?? "",
      name,
    }
  } catch {
    return null
  }
}

export async function signOutAction(): Promise<SignOutResult> {
  let supabase
  try {
    supabase = await createClient()
  } catch {
    return {
      error:
        "연결 설정을 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.",
    }
  }

  const { error } = await supabase.auth.signOut({ scope: "global" })

  if (error) {
    return {
      error: "로그아웃에 실패했습니다. 잠시 후 다시 시도해 주세요.",
    }
  }

  return { ok: true }
}
