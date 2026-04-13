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

import { type SignUpState, signUpAction } from "./actions"

const MIN_PASSWORD_LENGTH = 8

const INITIAL_SIGN_UP_STATE: SignUpState = {}

const EMAIL_CONFIRM_COPY =
  "입력하신 이메일로 인증 링크를 보냈습니다. 메일함을 확인한 뒤 링크를 눌러 가입을 완료해 주세요. 메일이 보이지 않으면 스팸함도 확인해 주세요."

export default function SignupPage() {
  const [state, formAction, isPending] = useActionState(
    signUpAction,
    INITIAL_SIGN_UP_STATE
  )
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordError, setPasswordError] = useState("")

  function validatePasswords(pw: string, confirmPw: string) {
    if (confirmPw && pw !== confirmPw) {
      setPasswordError("비밀번호가 일치하지 않습니다.")
    } else {
      setPasswordError("")
    }
  }

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
            자연어로 할 일을 입력하면 AI가 자동으로 정리해 드립니다.
          </p>
        </div>
      </div>

      <Card className="w-full max-w-sm shadow-md">
        <CardHeader>
          <CardTitle className="text-lg">회원가입</CardTitle>
          <CardDescription>계정을 만들어 시작해 보세요.</CardDescription>
        </CardHeader>

        <CardContent>
          {state.needsEmailConfirmation ? (
            <Alert className="border-primary/30 bg-primary/5">
              <AlertTitle>이메일을 확인해 주세요</AlertTitle>
              <AlertDescription className="text-muted-foreground">
                {EMAIL_CONFIRM_COPY}
              </AlertDescription>
              <div className="pt-3">
                <Button asChild className="w-full">
                  <Link href="/login">로그인 페이지로 이동</Link>
                </Button>
              </div>
            </Alert>
          ) : (
            <form
              action={formAction}
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                if (passwordError) {
                  e.preventDefault()
                }
              }}
            >
              {state.error && (
                <Alert variant="destructive">
                  <AlertTitle>가입할 수 없습니다</AlertTitle>
                  <AlertDescription>{state.error}</AlertDescription>
                </Alert>
              )}

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="name">이름</Label>
                <Input
                  id="name"
                  name="name"
                  type="text"
                  placeholder="홍길동"
                  autoComplete="name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isPending}
                />
              </div>

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
                <Label htmlFor="password">비밀번호</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="8자 이상 입력하세요"
                  autoComplete="new-password"
                  minLength={MIN_PASSWORD_LENGTH}
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    validatePasswords(e.target.value, confirmPassword)
                  }}
                  disabled={isPending}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="confirm-password">비밀번호 확인</Label>
                <Input
                  id="confirm-password"
                  name="confirmPassword"
                  type="password"
                  placeholder="비밀번호를 한 번 더 입력하세요"
                  autoComplete="new-password"
                  required
                  aria-invalid={!!passwordError}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value)
                    validatePasswords(password, e.target.value)
                  }}
                  disabled={isPending}
                />
                {passwordError && (
                  <p className="text-xs text-destructive">{passwordError}</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full mt-1 gap-2"
                disabled={isPending || !!passwordError}
              >
                {isPending ? (
                  <>
                    <Spinner />
                    계정 생성 중…
                  </>
                ) : (
                  "계정 만들기"
                )}
              </Button>
            </form>
          )}
        </CardContent>

        <CardFooter className="flex flex-col gap-3">
          <Separator />
          <p className="text-sm text-muted-foreground text-center w-full">
            이미 계정이 있으신가요?{" "}
            <Link
              href="/login"
              className="font-medium text-foreground underline-offset-4 hover:underline transition-colors"
            >
              로그인
            </Link>
          </p>
        </CardFooter>
      </Card>
    </main>
  )
}
