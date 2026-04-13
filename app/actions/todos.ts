"use server"

import { createClient } from "@/lib/supabase/server"
import type { Todo } from "@/components/todo/TodoCard"
import { coerceTodoPriority, type TodoPriority } from "@/lib/todos/priority"
import type { TodoFormValues } from "@/components/todo/TodoForm"

export type TodoQueryParams = {
  search: string
  statusFilter: "all" | "completed" | "incomplete"
  priorityFilter: "all" | TodoPriority
  sortKey: "created_date" | "due_date" | "priority" | "title"
}

function mapRow(row: Record<string, unknown>): Todo {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    title: String(row.title),
    description: (row.description as string | null) ?? null,
    created_date: (row.created_date as string | null) ?? null,
    due_date: (row.due_date as string | null) ?? null,
    priority: coerceTodoPriority(row.priority),
    category_id: (row.category_id as string | null) ?? null,
    completed: Boolean(row.completed),
  }
}

function friendlyError(e: { message?: string } | null): string {
  const raw = e?.message ?? ""
  const msg = raw.toLowerCase()
  if (msg.includes("jwt") || msg.includes("session") || msg.includes("auth")) {
    return "세션이 만료되었습니다. 다시 로그인해 주세요."
  }
  if (msg.includes("fetch failed") || msg.includes("econnrefused") || msg.includes("enotfound")) {
    return "데이터베이스(Supabase)에 연결할 수 없습니다. 인터넷 연결과 .env.local 의 NEXT_PUBLIC_SUPABASE_URL 이 올바른지 확인해 주세요."
  }
  if (msg.includes("relation") && msg.includes("todos")) {
    return "할 일 테이블(public.todos)이 없습니다. Supabase SQL 편집기에서 schema.sql 을 실행했는지 확인해 주세요."
  }
  if (msg.includes("invalid api key") || msg.includes("api key")) {
    return "Supabase API 키가 올바르지 않습니다. .env.local 의 NEXT_PUBLIC_SUPABASE_ANON_KEY(또는 PUBLISHABLE_KEY)를 확인해 주세요."
  }
  if (msg.includes("violates row-level security") || msg.includes("rls")) {
    return "권한 정책(RLS) 때문에 저장할 수 없습니다. schema.sql 의 todos 정책과 로그인 계정을 확인해 주세요."
  }
  return raw.trim()
    ? `요청을 처리하지 못했습니다: ${raw.slice(0, 200)}`
    : "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요."
}

function parseCategoryId(v: string | null | undefined): string | null {
  if (!v?.trim()) return null
  const u = v.trim()
  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      u
    )
  ) {
    return u
  }
  return null
}

async function requireSession() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) {
    return {
      supabase: null as Awaited<ReturnType<typeof createClient>> | null,
      user: null,
      error: "로그인이 필요합니다. 다시 로그인해 주세요." as string | null,
    }
  }
  return { supabase, user, error: null as string | null }
}

export async function fetchTodosAction(
  params: TodoQueryParams
): Promise<{ data: Todo[] | null; totalCount: number; error: string | null }> {
  const ctx = await requireSession()
  if (ctx.error || !ctx.supabase || !ctx.user) {
    return { data: null, totalCount: 0, error: ctx.error }
  }
  const { supabase, user } = ctx

  let query = supabase.from("todos").select("*").eq("user_id", user.id)

  if (params.statusFilter === "completed") query = query.eq("completed", true)
  if (params.statusFilter === "incomplete") query = query.eq("completed", false)
  if (params.priorityFilter !== "all") {
    query = query.eq("priority", params.priorityFilter)
  }

  const term = params.search.trim()
  if (term) {
    const safe = term.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_")
    query = query.ilike("title", `%${safe}%`)
  }

  switch (params.sortKey) {
    case "created_date":
      query = query.order("created_date", { ascending: false })
      break
    case "due_date":
      query = query.order("due_date", { ascending: true, nullsFirst: false })
      break
    case "priority":
      query = query.order("priority", { ascending: true })
      break
    case "title":
      query = query.order("title", { ascending: true })
      break
    default:
      query = query.order("created_date", { ascending: false })
  }

  const countPromise = supabase
    .from("todos")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)

  const [{ data, error }, countRes] = await Promise.all([query, countPromise])

  if (error) {
    return { data: null, totalCount: 0, error: friendlyError(error) }
  }
  if (countRes.error) {
    return { data: null, totalCount: 0, error: friendlyError(countRes.error) }
  }

  return {
    data: (data ?? []).map((row) => mapRow(row as Record<string, unknown>)),
    totalCount: countRes.count ?? (data ?? []).length,
    error: null,
  }
}

export async function createTodoAction(
  values: TodoFormValues
): Promise<{ error: string | null }> {
  const ctx = await requireSession()
  if (ctx.error || !ctx.supabase || !ctx.user) return { error: ctx.error }

  const { error } = await ctx.supabase.from("todos").insert({
    user_id: ctx.user.id,
    title: values.title,
    description: values.description ?? null,
    due_date: values.due_date ?? null,
    priority: values.priority,
    category_id: parseCategoryId(values.category_id ?? null),
    completed: values.completed ?? false,
  })

  if (error) return { error: friendlyError(error) }
  return { error: null }
}

export async function updateTodoAction(
  id: string,
  values: TodoFormValues
): Promise<{ error: string | null }> {
  const ctx = await requireSession()
  if (ctx.error || !ctx.supabase || !ctx.user) return { error: ctx.error }

  const { error } = await ctx.supabase
    .from("todos")
    .update({
      title: values.title,
      description: values.description ?? null,
      due_date: values.due_date ?? null,
      priority: values.priority,
      category_id: parseCategoryId(values.category_id ?? null),
      completed: values.completed ?? false,
    })
    .eq("id", id)
    .eq("user_id", ctx.user.id)

  if (error) return { error: friendlyError(error) }
  return { error: null }
}

export async function deleteTodoAction(id: string): Promise<{ error: string | null }> {
  const ctx = await requireSession()
  if (ctx.error || !ctx.supabase || !ctx.user) return { error: ctx.error }

  const { error } = await ctx.supabase
    .from("todos")
    .delete()
    .eq("id", id)
    .eq("user_id", ctx.user.id)

  if (error) return { error: friendlyError(error) }
  return { error: null }
}

export async function toggleTodoCompleteAction(
  id: string,
  completed: boolean
): Promise<{ error: string | null }> {
  const ctx = await requireSession()
  if (ctx.error || !ctx.supabase || !ctx.user) return { error: ctx.error }

  const { error } = await ctx.supabase
    .from("todos")
    .update({ completed })
    .eq("id", id)
    .eq("user_id", ctx.user.id)

  if (error) return { error: friendlyError(error) }
  return { error: null }
}
