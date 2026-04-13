"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { mapSupabaseAuthError } from "@/lib/auth/map-supabase-auth-error"
import { createClient } from "@/lib/supabase/server"

const MIN_PASSWORD_LENGTH = 8

export type SignUpState = {
  error?: string
  /** 이메일 인증 링크 발송 후 (세션 없음) */
  needsEmailConfirmation?: boolean
}

function isValidEmail(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)
}

async function requestOrigin(): Promise<string> {
  const h = await headers()
  const host = h.get("x-forwarded-host") ?? h.get("host")
  const proto = h.get("x-forwarded-proto") ?? "http"
  if (host) {
    return `${proto}://${host}`
  }
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
}

export async function signUpAction(
  _prevState: SignUpState,
  formData: FormData
): Promise<SignUpState> {
  const name = String(formData.get("name") ?? "").trim()
  const email = String(formData.get("email") ?? "").trim()
  const password = String(formData.get("password") ?? "")
  const confirmPassword = String(formData.get("confirmPassword") ?? "")

  if (!name) {
    return { error: "이름을 입력해 주세요." }
  }
  if (!isValidEmail(email)) {
    return { error: "올바른 이메일 형식이 아닙니다." }
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.` }
  }
  if (password !== confirmPassword) {
    return { error: "비밀번호 확인이 일치하지 않습니다." }
  }

  let supabase
  try {
    supabase = await createClient()
  } catch {
    return {
      error:
        "Supabase 연결 설정을 확인해 주세요. .env.local에 URL·anon 키가 있는지 확인한 뒤 개발 서버를 재시작해 주세요.",
    }
  }
  const origin = await requestOrigin()

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/`,
      data: {
        full_name: name,
      },
    },
  })

  if (error) {
    return { error: mapSupabaseAuthError(error) }
  }

  if (data.session) {
    redirect("/")
  }

  return { needsEmailConfirmation: true }
}
