import { normalizeLatinCaseInTitle } from "./prompt-pipeline"

import type { AiTodoPayload } from "./generate-todo-types"

const TITLE_MIN_GRAPHEMES = 2
const TITLE_MAX_GRAPHEMES = 200

function countGraphemes(s: string): number {
  try {
    const seg = new Intl.Segmenter("ko", { granularity: "grapheme" })
    let n = 0
    for (const _ of seg.segment(s)) n++
    return n
  } catch {
    return Array.from(s).length
  }
}

function truncateGraphemes(s: string, max: number): string {
  try {
    const seg = new Intl.Segmenter("ko", { granularity: "grapheme" })
    const parts: string[] = []
    let n = 0
    for (const { segment } of seg.segment(s)) {
      if (n >= max) break
      parts.push(segment)
      n++
    }
    return parts.join("")
  } catch {
    return s.slice(0, max)
  }
}

function normalizeTitle(raw: string): string {
  let t = raw.normalize("NFC").trim().replace(/\s+/g, " ")
  t = normalizeLatinCaseInTitle(t)
  if (!t) return "새 할 일"
  if (countGraphemes(t) > TITLE_MAX_GRAPHEMES) {
    t = `${truncateGraphemes(t, TITLE_MAX_GRAPHEMES - 1)}…`
  }
  if (countGraphemes(t) < TITLE_MIN_GRAPHEMES) {
    t = `${t} 할 일`
    if (countGraphemes(t) > TITLE_MAX_GRAPHEMES) {
      t = `${truncateGraphemes(t, TITLE_MAX_GRAPHEMES - 1)}…`
    }
  }
  return t
}

/** AI 결과·마감 결합 후 후처리 (과거 마감은 기록·복기용으로 유지 — null로 지우지 않음) */
export function postProcessGeneratedPayload(payload: AiTodoPayload): AiTodoPayload {
  let { title, due_date, description, priority, category, category_id } = payload

  title = normalizeTitle(title ?? "")

  if (!priority || !["high", "medium", "low"].includes(priority)) {
    priority = "medium"
  }

  if (description != null) {
    const d = String(description).normalize("NFC").trim().replace(/\s+/g, " ")
    description = d || undefined
  }

  return {
    title,
    description,
    due_date,
    priority,
    category_id: category_id ?? null,
    category: category ?? null,
  }
}
