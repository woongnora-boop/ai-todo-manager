"use client"

import * as React from "react"
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Lightbulb,
  Minus,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import type { SummaryMetrics } from "@/lib/ai/summarize-todos-helpers"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

export type TodoSummaryResult = {
  summary: string
  urgentTasks: string[]
  insights: string[]
  recommendations: string[]
  nextWeekSuggestions: string[]
  metrics: SummaryMetrics
}

type Period = "today" | "week"

const INSIGHT_ROWS: Array<{
  emoji: string
  Icon: React.ComponentType<{ className?: string }>
  ring: string
}> = [
  { emoji: "💡", Icon: Lightbulb, ring: "border-sky-200/70 bg-sky-50/50 dark:border-sky-900/50 dark:bg-sky-950/25" },
  { emoji: "⚠️", Icon: AlertTriangle, ring: "border-amber-200/70 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/25" },
  { emoji: "🎯", Icon: Target, ring: "border-violet-200/70 bg-violet-50/50 dark:border-violet-900/50 dark:bg-violet-950/25" },
  { emoji: "📊", Icon: BarChart3, ring: "border-emerald-200/70 bg-emerald-50/50 dark:border-emerald-900/50 dark:bg-emerald-950/25" },
  { emoji: "✨", Icon: Sparkles, ring: "border-rose-200/70 bg-rose-50/50 dark:border-rose-900/50 dark:bg-rose-950/25" },
]

function priorityLabel(p: string): string {
  if (p === "high") return "높음"
  if (p === "medium") return "보통"
  return "낮음"
}

function priorityBadgeVariant(p: string): "destructive" | "secondary" | "outline" {
  if (p === "high") return "destructive"
  if (p === "medium") return "secondary"
  return "outline"
}

function TrendBadge({ trend }: { trend: SummaryMetrics["trend"] }) {
  if (trend === "up") {
    return (
      <Badge variant="secondary" className="gap-1 border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
        <TrendingUp className="size-3.5" />
        개선
      </Badge>
    )
  }
  if (trend === "down") {
    return (
      <Badge variant="secondary" className="gap-1 border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
        <TrendingDown className="size-3.5" />
        주의
      </Badge>
    )
  }
  if (trend === "same") {
    return (
      <Badge variant="outline" className="gap-1">
        <Minus className="size-3.5" />
        유사
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="gap-1 text-muted-foreground">
      비교 불가
    </Badge>
  )
}

function ChartTooltipContent({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value?: number }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-md border bg-popover px-2 py-1.5 text-xs shadow-md">
      <span className="font-medium text-foreground">{label}</span>
      <span className="text-muted-foreground"> · {payload[0]?.value ?? 0}</span>
    </div>
  )
}

export function TodoAiSummarySection({ disabled = false }: { disabled?: boolean }) {
  const [tab, setTab] = React.useState<Period>("today")
  const [loading, setLoading] = React.useState<Record<Period, boolean>>({
    today: false,
    week: false,
  })
  const [results, setResults] = React.useState<Record<Period, TodoSummaryResult | null>>({
    today: null,
    week: null,
  })
  const [errors, setErrors] = React.useState<Record<Period, string | null>>({
    today: null,
    week: null,
  })

  const runSummary = React.useCallback(async (period: Period) => {
    setErrors((e) => ({ ...e, [period]: null }))
    setLoading((l) => ({ ...l, [period]: true }))
    try {
      const res = await fetch("/api/ai/summarize-todos", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period }),
      })
      const data = (await res.json()) as Partial<TodoSummaryResult> & { error?: string }
      if (!res.ok) {
        throw new Error(data.error ?? "요약을 가져오지 못했습니다.")
      }
      if (!data.metrics) {
        throw new Error("응답 형식이 올바르지 않습니다.")
      }
      setResults((r) => ({
        ...r,
        [period]: {
          summary: data.summary ?? "",
          urgentTasks: data.urgentTasks ?? [],
          insights: data.insights ?? [],
          recommendations: data.recommendations ?? [],
          nextWeekSuggestions: data.nextWeekSuggestions ?? [],
          metrics: data.metrics,
        },
      }))
    } catch (err) {
      setErrors((e) => ({
        ...e,
        [period]: err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.",
      }))
    } finally {
      setLoading((l) => ({ ...l, [period]: false }))
    }
  }, [])

  const renderBody = (period: Period) => {
    const load = loading[period]
    const err = errors[period]
    const data = results[period]
    const m = data?.metrics

    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <Button
            type="button"
            disabled={disabled || load}
            onClick={() => void runSummary(period)}
            variant="default"
            className="w-full gap-2 sm:w-auto"
          >
            {load ? (
              <>
                <Spinner />
                분석 중…
              </>
            ) : (
              "AI 요약 보기"
            )}
          </Button>
          <p className="text-xs text-muted-foreground sm:max-w-md">
            {period === "today"
              ? "오늘 마감·오늘 생성된 할 일만 당일 집중 분석합니다."
              : "이번 주(월~일, 서울) 할 일의 주간 패턴을 분석합니다."}
          </p>
        </div>

        {err && (
          <Card className="border-destructive/40 bg-destructive/5">
            <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-destructive">{err}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled || load}
                onClick={() => void runSummary(period)}
                className="shrink-0"
              >
                재시도
              </Button>
            </CardContent>
          </Card>
        )}

        {data && m && !load && (
          <div className="space-y-6">
            {period === "today" ? (
              <TodayResultView data={data} metrics={m} />
            ) : (
              <WeekResultView data={data} metrics={m} />
            )}

            <Separator />

            <div>
              <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                <span aria-hidden>📝</span>
                한줄 요약
              </h4>
              <p className="whitespace-pre-wrap rounded-lg border bg-muted/30 p-4 text-sm leading-relaxed text-muted-foreground">
                {data.summary}
              </p>
            </div>

            <div>
              <h4 className="mb-3 text-sm font-semibold text-foreground">인사이트</h4>
              <ul className="grid list-none gap-3 p-0 sm:grid-cols-1 lg:grid-cols-2">
                {data.insights.map((text, i) => {
                  const row = INSIGHT_ROWS[i % INSIGHT_ROWS.length]
                  const Icon = row.Icon
                  return (
                    <li key={`${i}-${text.slice(0, 24)}`}>
                      <Card className={cn("h-full border shadow-none", row.ring)}>
                        <CardContent className="flex gap-3 pt-4">
                          <span className="text-lg leading-none" aria-hidden>
                            {row.emoji}
                          </span>
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center gap-1.5 text-xs font-medium text-foreground/80">
                              <Icon className="size-3.5 shrink-0 opacity-70" />
                              인사이트 {i + 1}
                            </div>
                            <p className="text-sm leading-relaxed text-muted-foreground">{text}</p>
                          </div>
                        </CardContent>
                      </Card>
                    </li>
                  )
                })}
              </ul>
            </div>

            <div>
              <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                <Zap className="size-4 text-primary" />
                실행 추천
              </h4>
              <ol className="space-y-2">
                {data.recommendations.map((t, i) => (
                  <li
                    key={`${i}-${t.slice(0, 20)}`}
                    className="flex gap-3 rounded-lg border bg-card px-3 py-2.5 text-sm text-muted-foreground"
                  >
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {i + 1}
                    </span>
                    <span className="pt-0.5 leading-relaxed">{t}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}

        {!data && !load && !err && (
          <p className="rounded-lg border border-dashed bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
            「AI 요약 보기」를 누르면 이 탭에 분석 결과가 표시됩니다.
          </p>
        )}
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI 요약 및 분석</CardTitle>
        <CardDescription>
          완료율·마감·우선순위·시간대 패턴을 시각화하고, 실행 가능한 제안과 긍정적인 피드백을 드립니다.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs
          value={tab}
          onValueChange={(v) => {
            setTab(v as Period)
          }}
        >
          <TabsList variant="line" className="mb-6 w-full justify-start gap-1 sm:w-auto">
            <TabsTrigger value="today" className="flex-1 sm:flex-none">
              오늘의 요약
            </TabsTrigger>
            <TabsTrigger value="week" className="flex-1 sm:flex-none">
              이번주 요약
            </TabsTrigger>
          </TabsList>
          <TabsContent value="today" className="mt-0 focus-visible:outline-none">
            {renderBody("today")}
          </TabsContent>
          <TabsContent value="week" className="mt-0 focus-visible:outline-none">
            {renderBody("week")}
          </TabsContent>
        </Tabs>
        {disabled && (
          <p className="mt-4 text-xs text-muted-foreground">로그인 후 이용할 수 있습니다.</p>
        )}
      </CardContent>
    </Card>
  )
}

function TodayResultView({ data, metrics: m }: { data: TodoSummaryResult; metrics: SummaryMetrics }) {
  const rate = m.completionRatePercent ?? 0
  const focusSet = new Set(data.urgentTasks)

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">오늘의 완료율</CardTitle>
          <CardDescription>당일 해당 할 일 기준</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-2">
            <span className="text-4xl font-bold tracking-tight text-foreground tabular-nums sm:text-5xl">
              {m.completionRatePercent != null ? rate : "—"}
            </span>
            {m.completionRatePercent != null && <span className="pb-1 text-2xl font-medium text-muted-foreground">%</span>}
          </div>
          <Progress value={m.completionRatePercent != null ? Math.min(100, rate) : 0} className="h-2.5" />
          <p className="text-xs text-muted-foreground">
            완료 {m.completed}건 · 남음 {m.incomplete}건 · 전체 {m.total}건
          </p>
        </CardContent>
      </Card>

      {data.urgentTasks.length > 0 && (
        <Card className="border-primary/40 bg-primary/[0.06] shadow-sm ring-1 ring-primary/15">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <span aria-hidden>🔥</span>
              오늘 집중할 작업
            </CardTitle>
            <CardDescription>AI가 우선 처리를 권하는 항목이에요.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.urgentTasks.map((t) => (
                <li
                  key={t}
                  className="flex items-start gap-2 rounded-md border border-primary/20 bg-background/80 px-3 py-2 text-sm font-medium text-foreground"
                >
                  <Zap className="mt-0.5 size-4 shrink-0 text-primary" />
                  {t}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div>
        <h4 className="mb-2 text-sm font-semibold text-foreground">남은 할 일</h4>
        {m.remainingTasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">남은 할 일이 없어요. 잘하셨어요! 🎉</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {m.remainingTasks.map((t, idx) => (
              <li
                key={`${idx}-${t.title}`}
                className={cn(
                  "flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between",
                  focusSet.has(t.title) && "bg-primary/[0.04]"
                )}
              >
                <span className="min-w-0 text-sm font-medium text-foreground">{t.title}</span>
                <Badge variant={priorityBadgeVariant(t.priority)} className="w-fit shrink-0">
                  {priorityLabel(t.priority)}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function WeekResultView({ data, metrics: m }: { data: TodoSummaryResult; metrics: SummaryMetrics }) {
  const rate = m.completionRatePercent ?? 0
  const chartPrimary = "hsl(var(--primary))"

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base">주간 완료율 & 트렌드</CardTitle>
                <CardDescription>직전 주 대비 완료율(%)</CardDescription>
              </div>
              <TrendBadge trend={m.trend} />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold tabular-nums sm:text-4xl">
                {m.completionRatePercent != null ? rate : "—"}
              </span>
              {m.completionRatePercent != null && <span className="text-muted-foreground">%</span>}
            </div>
            <div className="h-[200px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={m.weekTrendBars} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                  <YAxis
                    domain={[0, 100]}
                    width={32}
                    tick={{ fontSize: 11 }}
                    className="text-muted-foreground"
                    tickFormatter={(v) => `${v}`}
                  />
                  <Tooltip content={<ChartTooltipContent />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.35 }} />
                  <Bar dataKey="rate" fill={chartPrimary} radius={[6, 6, 0, 0]} maxBarSize={48} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-muted-foreground">
              완료 {m.completed}건 / 전체 {m.total}건
              {m.comparisonCompletionRatePercent != null && (
                <> · 이전 기간 완료율 {m.comparisonCompletionRatePercent}%</>
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">요일별 생산성</CardTitle>
            <CardDescription>완료된 할 일의 마감 요일(서울 기준) 분포</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[220px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={m.weekdayProductivity} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} width={28} tick={{ fontSize: 11 }} />
                  <Tooltip content={<ChartTooltipContent />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.35 }} />
                  <Bar dataKey="count" fill={chartPrimary} radius={[6, 6, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {m.peakHour != null && (
              <p className="mt-2 text-xs text-muted-foreground">
                완료 항목 마감 시각이 가장 많이 몰린 시간대: 약 {m.peakHour}시
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-dashed">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <span aria-hidden>📅</span>
            다음 주 계획 제안
          </CardTitle>
          <CardDescription>AI가 제안하는 다음 주 준비 포인트예요.</CardDescription>
        </CardHeader>
        <CardContent>
          {data.nextWeekSuggestions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              제안이 비어 있어요. 위 요약·추천을 참고해 직접 한 줄씩 적어 보셔도 좋아요.
            </p>
          ) : (
            <ul className="space-y-2">
              {data.nextWeekSuggestions.map((t, i) => (
                <li
                  key={`${i}-${t.slice(0, 16)}`}
                  className="flex gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground"
                >
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span className="leading-relaxed">{t}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
