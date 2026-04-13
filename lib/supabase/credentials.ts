/**
 * Supabase URL·anon 키는 .env 에 서로 다른 이름으로 올 수 있어 한곳에서 병합합니다.
 * (NEXT_PUBLIC_SUPABASE_ANON_KEY 가 비어 있고 PUBLISHABLE 만 있는 경우 등)
 */
export function getSupabaseUrl(): string {
  return (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim()
}

export function getSupabaseAnonKey(): string {
  const anon = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim()
  const publishable = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "").trim()
  return anon || publishable
}

export function isSupabaseConfigured(): boolean {
  return Boolean(getSupabaseUrl() && getSupabaseAnonKey())
}
