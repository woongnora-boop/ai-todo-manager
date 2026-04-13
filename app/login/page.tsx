"use client"

import Link from "next/link"
import { useActionState, useState } from "react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"

import { type LoginState, loginAction } from "./actions"

const INITIAL_LOGIN_STATE: LoginState = {}

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(
    loginAction,
    INITIAL_LOGIN_STATE
  )
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background via-muted/30 to-background px-4 py-12">
      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <div className="flex items-center justify-center size-14 rounded-2xl bg-primary text-primary-foreground shadow-lg">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-7"
            aria-hidden="true"
          >
            <path d="M9 11l3 3L22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">TaskAI</h1>
          <p className="mt-1 text-sm text-muted-foreground max-w-xs">
            AI가 도와주는 스마트한 할 일 관리
          </p>
        </div>
      </div>

      <Card className="w-full max-w-sm shadow-md">
        <CardHeader>
          <CardTitle className="text-lg">로그인</CardTitle>
          <CardDescription>이메일과 비밀번호로 계속하세요.</CardDescription>
        </CardHeader>

        <CardContent>
          <form action={formAction} className="flex flex-col gap-4">
            {state.error && (
              <Alert variant="destructive">
                <AlertTitle>로그인할 수 없습니다</AlertTitle>
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">이메일</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="name@example.com"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isPending}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">비밀번호</Label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-muted-foreground underline-offset-4 hover:underline hover:text-foreground transition-colors"
                >
                  비밀번호를 잊으셨나요?
                </Link>
              </div>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isPending}
              />
            </div>

            <Button
              type="submit"
              className="w-full mt-1 gap-2"
              disabled={isPending}
            >
              {isPending ? (
                <>
                  <Spinner />
                  로그인 중…
                </>
              ) : (
                "로그인"
              )}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="flex flex-col gap-3">
          <Separator />
          <p className="text-sm text-muted-foreground text-center w-full">
            아직 계정이 없으신가요?{" "}
            <Link
              href="/signup"
              className="font-medium text-foreground underline-offset-4 hover:underline transition-colors"
            >
              회원가입
            </Link>
          </p>
        </CardFooter>
      </Card>
    </main>
  )
}
