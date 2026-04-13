"use server"

import { redirect } from "next/navigation"

import { mapSupabaseSignInError } from "@/lib/auth/map-supabase-auth-error"
import { createClient } from "@/lib/supabase/server"

export type LoginState = {
  error?: string
}

function isValidEmail(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)
}

export async function loginAction(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim()
  const password = String(formData.get("password") ?? "")

  if (!email) {
    return { error: "이메일을 입력해 주세요." }
  }
  if (!isValidEmail(email)) {
    return { error: "올바른 이메일 형식이 아닙니다." }
  }
  if (!password) {
    return { error: "비밀번호를 입력해 주세요." }
  }

  let supabase
  try {
    supabase = await createClient()
  } catch {
    return {
      error:
        "Supabase 연결 설정을 확인해 주세요. .env.local과 개발 서버 재시작이 필요할 수 있습니다.",
    }
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { error: mapSupabaseSignInError(error) }
  }

  redirect("/")
}
