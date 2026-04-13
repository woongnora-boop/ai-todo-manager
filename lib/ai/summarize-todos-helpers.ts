import type { Todo } from "@/components/todo/TodoCard"

import { formatSeoulYmd, getSeoulNowContext } from "./kst-due-date"

export type SummarizePeriod = "today" | "week"

const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"] as const

/** 서울 달력 날짜에 일수 가감 */
export function seoulYmdAddDays(ymd: string, deltaDays: number): string {
  const base = new Date(`${ymd}T12:00:00+09:00`)
  const ms = base.getTime() + deltaDays * 24 * 60 * 60 * 1000
  return formatSeoulYmd(new Date(ms))
}

/** 서울 달력 날짜의 해당일 00:00 KST → UTC ms */
function seoulDayStartMs(ymd: string): number {
  return new Date(`${ymd}T00:00:00+09:00`).getTime()
}

function seoulYmdOfInstant(iso: string | null | undefined): string | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return null
  return formatSeoulYmd(new Date(iso))
}

/** Intl로 서울 기준 요일 약어 → 월요일 시작 주의 월요일 YMD */
function mondayYmdOfSeoulWeekContaining(ymd: string): string {
  const ref = new Date(`${ymd}T12:00:00+09:00`)
  const short = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    weekday: "short",
    localeMatcher: "lookup",
  }).format(ref)
  const order = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  const idx = order.indexOf(short)
  const daysFromMonday = idx === -1 ? 0 : (idx + 6) % 7
  const mondayMs = ref.getTime() - daysFromMonday * 24 * 60 * 60 * 1000
  return formatSeoulYmd(new Date(mondayMs))
}

function weekRangeSeoulContaining(ymd: string): { startMs: number; endExclusiveMs: number } {
  const monYmd = mondayYmdOfSeoulWeekContaining(ymd)
  const startMs = seoulDayStartMs(monYmd)
  const endExclusiveMs = startMs + 7 * 24 * 60 * 60 * 1000
  return { startMs, endExclusiveMs }
}

/** 직전 주(서울 월~일) */
function previousWeekRangeFromToday(todayYmd: string): { startMs: number; endExclusiveMs: number } {
  const thisMon = mondayYmdOfSeoulWeekContaining(todayYmd)
  const prevMon = seoulYmdAddDays(thisMon, -7)
  const startMs = seoulDayStartMs(prevMon)
  return { startMs, endExclusiveMs: startMs + 7 * 24 * 60 * 60 * 1000 }
}

function instantInRange(iso: string | null | undefined, startMs: number, endExclusiveMs: number): boolean {
  if (!iso) return false
  const t = new Date(iso).getTime()
  return Number.isFinite(t) && t >= startMs && t < endExclusiveMs
}

export function filterTodosByPeriod(todos: Todo[], period: SummarizePeriod): Todo[] {
  const { dateYmd: todayYmd } = getSeoulNowContext()

  if (period === "today") {
    return todos.filter((t) => {
      if (t.due_date) {
        const y = seoulYmdOfInstant(t.due_date)
        return y === todayYmd
      }
      if (t.created_date) {
        const y = seoulYmdOfInstant(t.created_date)
        return y === todayYmd
      }
      return false
    })
  }

  const { startMs, endExclusiveMs } = weekRangeSeoulContaining(todayYmd)
  return todos.filter((t) => {
    if (t.due_date) return instantInRange(t.due_date, startMs, endExclusiveMs)
    if (t.created_date) return instantInRange(t.created_date, startMs, endExclusiveMs)
    return false
  })
}

/** 어제(서울 달력): 오늘 필터와 동일 규칙 */
export function filterTodosYesterday(allTodos: Todo[]): Todo[] {
  const { dateYmd: todayYmd } = getSeoulNowContext()
  const yday = seoulYmdAddDays(todayYmd, -1)
  return allTodos.filter((t) => {
    if (t.due_date) return seoulYmdOfInstant(t.due_date) === yday
    if (t.created_date) return seoulYmdOfInstant(t.created_date) === yday
    return false
  })
}

/** 직전 주(서울 월~일) */
export function filterTodosPreviousWeek(allTodos: Todo[]): Todo[] {
  const { dateYmd: todayYmd } = getSeoulNowContext()
  const { startMs, endExclusiveMs } = previousWeekRangeFromToday(todayYmd)
  return allTodos.filter((t) => {
    if (t.due_date) return instantInRange(t.due_date, startMs, endExclusiveMs)
    if (t.created_date) return instantInRange(t.created_date, startMs, endExclusiveMs)
    return false
  })
}

export type CompletionSnapshot = {
  total: number
  completed: number
  completionRatePercent: number | null
}

export function completionSnapshot(todos: Todo[]): CompletionSnapshot {
  const total = todos.length
  const completed = todos.filter((t) => t.completed).length
  return {
    total,
    completed,
    completionRatePercent: total > 0 ? Math.round((completed / total) * 1000) / 10 : null,
  }
}

export type PriorityCompletionRow = {
  total: number
  completed: number
  ratePercent: number | null
}

export function priorityCompletionBreakdown(todos: Todo[]): Record<"high" | "medium" | "low", PriorityCompletionRow> {
  const levels = ["high", "medium", "low"] as const
  const out = {} as Record<(typeof levels)[number], PriorityCompletionRow>
  for (const p of levels) {
    const sub = todos.filter((t) => t.priority === p)
    const tot = sub.length
    const done = sub.filter((t) => t.completed).length
    out[p] = {
      total: tot,
      completed: done,
      ratePercent: tot > 0 ? Math.round((done / tot) * 1000) / 10 : null,
    }
  }
  return out
}

function seoulHour(iso: string): number | null {
  const hourStr = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    hour12: false,
  }).format(new Date(iso))
  const h = Number.parseInt(hourStr.replace(/\s/g, ""), 10)
  return Number.isFinite(h) && h >= 0 && h < 24 ? h : null
}

function seoulWeekdayIndex(iso: string): number | null {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const short = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    weekday: "short",
    localeMatcher: "lookup",
  }).format(d)
  const order = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  const idx = order.indexOf(short)
  return idx >= 0 ? idx : null
}

export type RichAnalysisPayload = {
  current: TodoAnalytics
  /** 오늘↔어제, 주간↔직전 주 */
  comparison: {
    label: string
    snapshot: CompletionSnapshot
  } | null
  priorityCompletion: Record<"high" | "medium" | "low", PriorityCompletionRow>
  timeManagement: {
    overdueIncompleteCount: number
    todosWithDueDateInScope: number
    /** 마감이 이미 지난 항목 수(완료+미완료) */
    pastDueTotal: number
    pastDueCompleted: number
    /** 과거 마감 건 중 완료 비율(연기·처리 패턴 참고) */
    pastDueHandledPercent: number | null
    /** 기간 시작 이전에 만들어졌으나 마감이 이번 분석 기간에 드는 항목 수 */
    createdEarlierDueInScopeCount: number
  }
  productivity: {
    completedCountByDueWeekdayKo: Record<string, number>
    completedCountByDueHour: Record<number, number>
    peakWeekdayKo: string | null
    peakHour: number | null
  }
  titleSamples: {
    completedTitlesSample: string[]
    incompleteTitlesSample: string[]
  }
}

export function buildRichAnalysisPayload(
  allTodos: Todo[],
  scopedTodos: Todo[],
  period: SummarizePeriod
): RichAnalysisPayload {
  const analytics = buildAnalytics(scopedTodos, period)
  const nowMs = Date.now()

  let comparison: RichAnalysisPayload["comparison"] = null
  if (period === "today") {
    const prev = filterTodosYesterday(allTodos)
    if (prev.length > 0 || scopedTodos.length > 0) {
      comparison = { label: "어제(동일 규칙: 마감·생성이 어제인 할 일)", snapshot: completionSnapshot(prev) }
    }
  } else {
    const prev = filterTodosPreviousWeek(allTodos)
    if (prev.length > 0 || scopedTodos.length > 0) {
      comparison = { label: "직전 주 월~일(서울)", snapshot: completionSnapshot(prev) }
    }
  }

  const priorityCompletion = priorityCompletionBreakdown(scopedTodos)

  const withDue = scopedTodos.filter((t) => t.due_date)
  const overdueIncomplete = withDue.filter(
    (t) => !t.completed && new Date(t.due_date!).getTime() < nowMs
  )
  const pastDue = withDue.filter((t) => new Date(t.due_date!).getTime() < nowMs)
  const pastDueDone = pastDue.filter((t) => t.completed).length
  const pastDueHandledPercent =
    pastDue.length > 0 ? Math.round((pastDueDone / pastDue.length) * 1000) / 10 : null

  const { dateYmd: todayYmd } = getSeoulNowContext()
  const periodStartMs =
    period === "today" ? seoulDayStartMs(todayYmd) : weekRangeSeoulContaining(todayYmd).startMs

  const createdEarlierDueInScope = scopedTodos.filter((t) => {
    if (!t.due_date || !t.created_date) return false
    const c = new Date(t.created_date).getTime()
    return Number.isFinite(c) && c < periodStartMs
  })

  const completedScoped = scopedTodos.filter((t) => t.completed && t.due_date)
  const completedCountByDueWeekdayKo: Record<string, number> = {}
  const completedCountByDueHour: Record<number, number> = {}
  for (let h = 0; h < 24; h++) completedCountByDueHour[h] = 0

  for (const t of completedScoped) {
    const wd = seoulWeekdayIndex(t.due_date!)
    if (wd !== null) {
      const label = WEEKDAY_KO[wd]
      completedCountByDueWeekdayKo[label] = (completedCountByDueWeekdayKo[label] ?? 0) + 1
    }
    const h = seoulHour(t.due_date!)
    if (h !== null) completedCountByDueHour[h] += 1
  }

  let peakWeekdayKo: string | null = null
  let peakW = -1
  for (const [k, v] of Object.entries(completedCountByDueWeekdayKo)) {
    if (v > peakW) {
      peakW = v
      peakWeekdayKo = k
    }
  }
  if (peakW <= 0) peakWeekdayKo = null

  let peakHour: number | null = null
  let peakH = -1
  for (let h = 0; h < 24; h++) {
    const v = completedCountByDueHour[h] ?? 0
    if (v > peakH) {
      peakH = v
      peakHour = h
    }
  }
  if (peakH <= 0) peakHour = null

  const completedTitles = scopedTodos.filter((t) => t.completed).map((t) => t.title)
  const incompleteTitles = scopedTodos.filter((t) => !t.completed).map((t) => t.title)

  return {
    current: analytics,
    comparison,
    priorityCompletion,
    timeManagement: {
      overdueIncompleteCount: overdueIncomplete.length,
      todosWithDueDateInScope: withDue.length,
      pastDueTotal: pastDue.length,
      pastDueCompleted: pastDueDone,
      pastDueHandledPercent,
      createdEarlierDueInScopeCount: createdEarlierDueInScope.length,
    },
    productivity: {
      completedCountByDueWeekdayKo,
      completedCountByDueHour,
      peakWeekdayKo,
      peakHour,
    },
    titleSamples: {
      completedTitlesSample: completedTitles.slice(0, 18),
      incompleteTitlesSample: incompleteTitles.slice(0, 18),
    },
  }
}

export type TodoAnalytics = {
  period: SummarizePeriod
  seoulTodayYmd: string
  total: number
  completed: number
  incomplete: number
  completionRatePercent: number | null
  byPriority: { high: number; medium: number; low: number }
  /** 마감이 있는 항목만, 서울 시(0–23) → 개수 */
  dueHourDistribution: Record<number, number>
  todosBrief: Array<{
    title: string
    completed: boolean
    priority: string
    due_date: string | null
  }>
}

export function buildAnalytics(todos: Todo[], period: SummarizePeriod): TodoAnalytics {
  const { dateYmd: seoulTodayYmd } = getSeoulNowContext()
  const total = todos.length
  const completed = todos.filter((t) => t.completed).length
  const incomplete = total - completed
  const completionRatePercent = total > 0 ? Math.round((completed / total) * 1000) / 10 : null

  const byPriority = { high: 0, medium: 0, low: 0 }
  const dueHourDistribution: Record<number, number> = {}
  for (let h = 0; h < 24; h++) dueHourDistribution[h] = 0

  for (const t of todos) {
    if (t.priority === "high") byPriority.high++
    else if (t.priority === "medium") byPriority.medium++
    else byPriority.low++

    if (t.due_date) {
      const hourStr = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Seoul",
        hour: "2-digit",
        hour12: false,
      }).format(new Date(t.due_date))
      const h = Number.parseInt(hourStr.replace(/\s/g, ""), 10)
      if (Number.isFinite(h) && h >= 0 && h < 24) {
        dueHourDistribution[h] = (dueHourDistribution[h] ?? 0) + 1
      }
    }
  }

  const todosBrief = todos.map((t) => ({
    title: t.title,
    completed: Boolean(t.completed),
    priority: t.priority,
    due_date: t.due_date ?? null,
  }))

  return {
    period,
    seoulTodayYmd,
    total,
    completed,
    incomplete,
    completionRatePercent,
    byPriority,
    dueHourDistribution,
    todosBrief,
  }
}

/** UI 차트용: 월요일 시작 */
const CHART_DAY_ORDER = ["월", "화", "수", "목", "금", "토", "일"] as const

export type SummaryMetrics = {
  period: SummarizePeriod
  total: number
  completed: number
  incomplete: number
  completionRatePercent: number | null
  remainingTasks: Array<{ title: string; priority: "high" | "medium" | "low" }>
  comparisonCompletionRatePercent: number | null
  trend: "up" | "down" | "same" | "unknown"
  weekdayProductivity: Array<{ day: string; count: number }>
  /** 이전 기간 vs 현재 기간 완료율(%) 비교 막대 그래프용 */
  weekTrendBars: Array<{ name: string; rate: number }>
  peakHour: number | null
}

export function emptySummaryMetrics(period: SummarizePeriod): SummaryMetrics {
  const trendNames = period === "today" ? (["어제", "오늘"] as const) : (["직전 주", "이번 주"] as const)
  return {
    period,
    total: 0,
    completed: 0,
    incomplete: 0,
    completionRatePercent: null,
    remainingTasks: [],
    comparisonCompletionRatePercent: null,
    trend: "unknown",
    weekdayProductivity: [...CHART_DAY_ORDER].map((day) => ({ day, count: 0 })),
    weekTrendBars: [
      { name: trendNames[0], rate: 0 },
      { name: trendNames[1], rate: 0 },
    ],
    peakHour: null,
  }
}

export function buildSummaryMetrics(scopedTodos: Todo[], rich: RichAnalysisPayload): SummaryMetrics {
  const c = rich.current
  const prevRate = rich.comparison?.snapshot.completionRatePercent ?? null
  const curRate = c.completionRatePercent

  let trend: SummaryMetrics["trend"] = "unknown"
  if (curRate != null && prevRate != null) {
    if (curRate > prevRate) trend = "up"
    else if (curRate < prevRate) trend = "down"
    else trend = "same"
  }

  const prioOrder = { high: 0, medium: 1, low: 2 } as const
  const remainingTasks = scopedTodos
    .filter((t) => !t.completed)
    .sort((a, b) => prioOrder[a.priority] - prioOrder[b.priority])
    .map((t) => ({ title: t.title, priority: t.priority }))

  const weekdayProductivity = [...CHART_DAY_ORDER].map((day) => ({
    day,
    count: rich.productivity.completedCountByDueWeekdayKo[day] ?? 0,
  }))

  const trendNames =
    c.period === "today" ? (["어제", "오늘"] as const) : (["직전 주", "이번 주"] as const)
  const weekTrendBars = [
    { name: trendNames[0], rate: prevRate ?? 0 },
    { name: trendNames[1], rate: curRate ?? 0 },
  ]

  return {
    period: c.period,
    total: c.total,
    completed: c.completed,
    incomplete: c.incomplete,
    completionRatePercent: curRate,
    remainingTasks,
    comparisonCompletionRatePercent: prevRate,
    trend,
    weekdayProductivity,
    weekTrendBars,
    peakHour: rich.productivity.peakHour,
  }
}
