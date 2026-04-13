"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import type { User } from "@supabase/supabase-js"

import { createClient } from "@/lib/supabase/client"

type AuthContextValue = {
  user: User | null
  loading: boolean
}

const AuthContext = React.createContext<AuthContextValue | null>(null)

type AuthProviderProps = {
  children: React.ReactNode
  /** 서버(RootLayout)에서 읽은 사용자 — 첫 페인트부터 헤더에 반영 */
  initialUser: User | null
}

export function AuthProvider({ children, initialUser }: AuthProviderProps) {
  const router = useRouter()
  const [user, setUser] = React.useState<User | null>(initialUser)
  // 서버 스냅샷이 있으면 첫 화면부터 로딩 아님 (클라이언트 getSession 지연으로 "한 번 더 들어가야 함" 방지)
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    setUser(initialUser)
  }, [initialUser?.id, initialUser?.email])

  React.useEffect(() => {
    let cancelled = false
    let subscription: { unsubscribe: () => void } | undefined

    try {
      const supabase = createClient()

      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!cancelled) {
          setUser((prev) => session?.user ?? prev)
        }
      })

      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user ?? null)
        setLoading(false)
        router.refresh()
      })
      subscription = data.subscription
    } catch {
      if (!cancelled) setLoading(false)
    }

    return () => {
      cancelled = true
      subscription?.unsubscribe()
    }
  }, [router])

  const value = React.useMemo(
    () => ({ user, loading }),
    [user, loading]
  )

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext)
  if (!ctx) {
    throw new Error("useAuth는 AuthProvider 안에서만 사용할 수 있습니다.")
  }
  return ctx
}
