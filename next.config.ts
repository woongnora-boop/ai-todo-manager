import { loadEnvConfig } from "@next/env"
import type { NextConfig } from "next"

// next.config 평가 시점에 .env* 를 확실히 로드 (Turbopack/클라이언트 번들 이슈 완화)
loadEnvConfig(process.cwd())

const supabaseAnonOrPublishable =
  (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim() ||
  (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "").trim()

const nextConfig: NextConfig = {
  /** 브라우저가 기본으로 요청하는 경로를 동적 아이콘으로 연결 */
  async rewrites() {
    return [{ source: "/favicon.ico", destination: "/icon" }]
  },
  /** 개발 중 파비콘·아이콘 캐시 완화 (교체 후에도 바로 보이게) */
  async headers() {
    if (process.env.NODE_ENV !== "development") return []
    return [
      {
        source: "/icon",
        headers: [{ key: "Cache-Control", value: "no-store, must-revalidate" }],
      },
      {
        source: "/apple-icon",
        headers: [{ key: "Cache-Control", value: "no-store, must-revalidate" }],
      },
      {
        source: "/favicon.ico",
        headers: [{ key: "Cache-Control", value: "no-store, must-revalidate" }],
      },
    ]
  },
  env: {
    NEXT_PUBLIC_SUPABASE_URL: (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim(),
    /** 클라이언트 번들: 둘 중 하나만 있어도 연결되도록 병합된 키를 노출 */
    NEXT_PUBLIC_SUPABASE_ANON_KEY: supabaseAnonOrPublishable,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: (
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? ""
    ).trim(),
  },
}

export default nextConfig
