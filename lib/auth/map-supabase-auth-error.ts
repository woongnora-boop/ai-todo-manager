import type { AuthError } from "@supabase/supabase-js"

const MIN_PASSWORD_LENGTH = 8

export function mapSupabaseAuthError(error: AuthError): string {
  const msg = (error.message ?? "").toLowerCase()
  if (
    msg.includes("already registered") ||
    msg.includes("user already registered") ||
    msg.includes("already been registered")
  ) {
    return "이미 가입된 이메일입니다. 로그인을 시도해 주세요."
  }
  if (msg.includes("invalid email") || msg.includes("unable to validate email")) {
    return "이메일 형식을 확인해 주세요."
  }
  if (
    (msg.includes("password") && (msg.includes("least") || msg.includes("short"))) ||
    msg.includes("weak password")
  ) {
    return `비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상으로 설정해 주세요.`
  }
  if (msg.includes("rate limit") || msg.includes("too many")) {
    return "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요."
  }
  return "회원가입에 실패했습니다. 입력 정보를 확인한 뒤 다시 시도해 주세요."
}

/** 로그인(signInWithPassword) 실패 시 메시지 */
export function mapSupabaseSignInError(error: AuthError): string {
  const msg = (error.message ?? "").toLowerCase()
  if (
    msg.includes("invalid login credentials") ||
    msg.includes("invalid_credentials") ||
    msg.includes("invalid grant")
  ) {
    return "이메일 또는 비밀번호가 올바르지 않습니다."
  }
  if (msg.includes("email not confirmed") || msg.includes("not confirmed")) {
    return "이메일 인증을 완료한 뒤 로그인해 주세요. 메일함을 확인해 주세요."
  }
  if (msg.includes("invalid email") || msg.includes("unable to validate email")) {
    return "이메일 형식을 확인해 주세요."
  }
  if (msg.includes("rate limit") || msg.includes("too many")) {
    return "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요."
  }
  return "로그인에 실패했습니다. 잠시 후 다시 시도해 주세요."
}
