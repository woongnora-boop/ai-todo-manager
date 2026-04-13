"use client"

import * as React from "react"
import { LogOutIcon, SearchIcon } from "lucide-react"
import { useRouter } from "next/navigation"

import {
  createTodoAction,
  deleteTodoAction,
  fetchTodosAction,
  toggleTodoCompleteAction,
  updateTodoAction,
} from "@/app/actions/todos"
import { signOutAction } from "@/app/auth/actions"
import { useAuth } from "@/components/providers/auth-provider"
import { TodoAiSummarySection } from "@/components/todo/TodoAiSummarySection"
import { TodoForm, type TodoFormValues, type TodoGenerateResult } from "@/components/todo/TodoForm"
import { TodoList } from "@/components/todo/TodoList"
import type { Todo } from "@/components/todo/TodoCard"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { isSupabaseConfigured } from "@/lib/supabase/credentials"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

type StatusFilter = "all" | "completed" | "incomplete"
type PriorityFilter = "all" | "high" | "medium" | "low"
type SortKey = "created_date" | "due_date" | "priority" | "title"

export default function HomePage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const [todos, setTodos] = React.useState<Todo[]>([])
  const [totalCount, setTotalCount] = React.useState(0)
  const [listLoading, setListLoading] = React.useState(true)
  const [listError, setListError] = React.useState<string | null>(null)
  const [pageError, setPageError] = React.useState<string | null>(null)

  const [editingId, setEditingId] = React.useState<string | null>(null)
  /** 신규 추가 성공 시마다 올려 폼을 리마운트해 입력란을 비움 */
  const [createFormKey, setCreateFormKey] = React.useState(0)
  const [deleteTarget, setDeleteTarget] = React.useState<Todo | null>(null)
  const [deleteLoading, setDeleteLoading] = React.useState(false)

  const [search, setSearch] = React.useState("")
  const [debouncedSearch, setDebouncedSearch] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all")
  const [priorityFilter, setPriorityFilter] = React.useState<PriorityFilter>("all")
  const [sortKey, setSortKey] = React.useState<SortKey>("created_date")

  const [signOutError, setSignOutError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search), 300)
    return () => window.clearTimeout(t)
  }, [search])

  const loadTodos = React.useCallback(async () => {
    if (!user?.id) {
      setTodos([])
      setTotalCount(0)
      setListLoading(false)
      return
    }

    setListLoading(true)
    setListError(null)

    const { data, error, totalCount: tc } = await fetchTodosAction({
      search: debouncedSearch,
      statusFilter,
      priorityFilter,
      sortKey,
    })

    setListLoading(false)

    if (error) {
      setListError(error)
      setTodos([])
      setTotalCount(0)
      return
    }

    setTodos(data ?? [])
    setTotalCount(tc)

    setEditingId((eid) => {
      if (eid && data && !data.some((t) => t.id === eid)) return null
      return eid
    })
  }, [user?.id, debouncedSearch, statusFilter, priorityFilter, sortKey])

  React.useEffect(() => {
    void loadTodos()
  }, [loadTodos])

  const editingTodo = editingId ? todos.find((t) => t.id === editingId) : null
  const formInitial =
    editingTodo && editingTodo.id
      ? {
          id: editingTodo.id,
          title: editingTodo.title,
          description: editingTodo.description ?? undefined,
          due_date: editingTodo.due_date ?? undefined,
          priority: editingTodo.priority,
          category_id: editingTodo.category_id ?? null,
          completed: Boolean(editingTodo.completed),
        }
      : null

  const handleGenerateTodo = React.useCallback(async (prompt: string): Promise<TodoGenerateResult> => {
    const res = await fetch("/api/ai/generate-todo", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    })
    const data = (await res.json()) as {
      error?: string
      title?: string
      description?: string
      due_date?: string | null
      priority?: TodoFormValues["priority"]
      category_id?: string | null
      category?: string | null
    }
    if (!res.ok) {
      throw new Error(data.error ?? "AI 생성 요청에 실패했습니다.")
    }
    return {
      title: data.title,
      description: data.description,
      due_date: data.due_date ?? null,
      priority: data.priority,
      category_id: data.category_id ?? null,
      category: data.category ?? null,
    }
  }, [])

  async function handleSubmit(values: TodoFormValues) {
    setPageError(null)
    if (editingId) {
      const { error } = await updateTodoAction(editingId, values)
      if (error) {
        setPageError(error)
        return
      }
      setEditingId(null)
    } else {
      const { error } = await createTodoAction(values)
      if (error) {
        setPageError(error)
        return
      }
      setCreateFormKey((k) => k + 1)
    }
    await loadTodos()
  }

  function handleEdit(todo: Todo) {
    setEditingId(todo.id)
  }

  async function handleToggleCompleted(todo: Todo) {
    setPageError(null)
    const { error } = await toggleTodoCompleteAction(todo.id, !todo.completed)
    if (error) {
      setPageError(error)
      return
    }
    await loadTodos()
  }

  function handleDeleteRequest(todo: Todo) {
    setDeleteTarget(todo)
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return
    const id = deleteTarget.id
    setPageError(null)
    setDeleteLoading(true)
    const { error } = await deleteTodoAction(id)
    setDeleteLoading(false)
    setDeleteTarget(null)
    if (editingId === id) setEditingId(null)
    if (error) {
      setPageError(error)
      return
    }
    await loadTodos()
  }

  async function handleLogout() {
    setSignOutError(null)
    try {
      const supabase = createClient()
      await supabase.auth.signOut({ scope: "global" })
    } catch {
      /* env 미설정 등 */
    }
    const result = await signOutAction()
    if ("error" in result) {
      setSignOutError(result.error)
      return
    }
    router.push("/login")
    router.refresh()
  }

  const meta = user?.user_metadata as { full_name?: string } | undefined
  const headerName = authLoading
    ? "불러오는 중"
    : meta?.full_name?.trim() ||
      user?.email?.split("@")[0] ||
      "사용자"
  const headerEmail = authLoading ? "…" : (user?.email ?? "")

  const initials = authLoading
    ? "…"
    : headerName
        .split(/\s+/)
        .map((s) => s[0])
        .join("")
        .slice(0, 2)
        .toUpperCase() || "?"

  const bannerError = pageError
  const supabaseReady = isSupabaseConfigured()

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 border-b bg-card/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-5"
                aria-hidden
              >
                <path d="M9 11l3 3L22 4" />
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-tight">TaskAI</p>
              <p className="truncate text-xs text-muted-foreground">AI 할 일 관리</p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <div className="hidden min-w-0 text-right sm:block">
              <p className="truncate text-sm font-medium leading-tight">{headerName}</p>
              <p className="truncate text-xs text-muted-foreground">{headerEmail}</p>
            </div>
            <Avatar size="sm" className="hidden sm:flex">
              <AvatarFallback className="text-xs font-medium">{initials}</AvatarFallback>
            </Avatar>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={authLoading}
              onClick={() => void handleLogout()}
            >
              <LogOutIcon className="size-3.5" />
              <span className="hidden sm:inline">로그아웃</span>
            </Button>
          </div>
        </div>
        {signOutError && (
          <p className="px-4 pb-2 text-center text-xs text-destructive sm:px-6" role="alert">
            {signOutError}
          </p>
        )}
      </header>

      {!supabaseReady && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 sm:px-6 dark:border-amber-900 dark:bg-amber-950/40">
          <div className="mx-auto max-w-7xl text-sm text-amber-950 dark:text-amber-100">
            <p className="font-medium">Supabase(DB) 환경 변수가 없습니다.</p>
            <p className="mt-1 opacity-90">
              프로젝트 루트의 .env.local 에 NEXT_PUBLIC_SUPABASE_URL 과
              NEXT_PUBLIC_SUPABASE_ANON_KEY(또는 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)를 넣은 뒤 개발 서버를 다시
              실행하세요.
            </p>
          </div>
        </div>
      )}

      {bannerError && (
        <div className="border-b bg-destructive/5 px-4 py-3 sm:px-6">
          <Alert variant="destructive" className="mx-auto max-w-7xl">
            <AlertTitle>알림</AlertTitle>
            <AlertDescription>{bannerError}</AlertDescription>
          </Alert>
        </div>
      )}

      <div className="border-b bg-muted/30">
        <div className="mx-auto grid max-w-7xl gap-4 p-4 sm:px-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="space-y-2">
            <Label htmlFor="todo-search" className="text-xs text-muted-foreground">
              검색 (제목)
            </Label>
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="todo-search"
                placeholder="제목에 포함된 키워드"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div
            className={cn(
              "flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end lg:justify-end"
            )}
          >
            <div className="space-y-2 sm:min-w-[140px]">
              <Label className="text-xs text-muted-foreground">완료 상태</Label>
              <Select
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v as StatusFilter)}
              >
                <SelectTrigger className="w-full sm:w-[140px]">
                  <SelectValue placeholder="상태" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  <SelectItem value="incomplete">미완료</SelectItem>
                  <SelectItem value="completed">완료</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 sm:min-w-[140px]">
              <Label className="text-xs text-muted-foreground">우선순위</Label>
              <Select
                value={priorityFilter}
                onValueChange={(v) => setPriorityFilter(v as PriorityFilter)}
              >
                <SelectTrigger className="w-full sm:w-[140px]">
                  <SelectValue placeholder="우선순위" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  <SelectItem value="high">high</SelectItem>
                  <SelectItem value="medium">medium</SelectItem>
                  <SelectItem value="low">low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 sm:min-w-[160px]">
              <Label className="text-xs text-muted-foreground">정렬</Label>
              <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="정렬 기준" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="created_date">생성일순 (최신)</SelectItem>
                  <SelectItem value="due_date">마감일순</SelectItem>
                  <SelectItem value="priority">우선순위순 (높은 순)</SelectItem>
                  <SelectItem value="title">제목순 (가나다)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-4 sm:px-6 lg:gap-8 lg:py-6">
        <TodoAiSummarySection disabled={authLoading || !user} />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
        <section className="flex min-h-0 flex-col gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">할 일 입력</h2>
            <p className="text-sm text-muted-foreground">
              새 항목을 추가하거나 목록에서 수정할 항목을 선택하세요.
            </p>
          </div>
          <TodoForm
            key={editingId ? `edit-${editingId}` : `new-${createFormKey}`}
            initialValues={formInitial}
            categories={[]}
            onSubmit={handleSubmit}
            onCancel={editingId ? () => setEditingId(null) : undefined}
            onGenerate={handleGenerateTodo}
          />
        </section>

        <section className="flex min-h-0 flex-col gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">할 일 목록</h2>
            <p className="text-sm text-muted-foreground">
              {todos.length}건 표시 (전체 {totalCount}건)
            </p>
          </div>
          <TodoList
            todos={todos}
            isLoading={listLoading}
            errorMessage={listError}
            onEdit={handleEdit}
            onToggleCompleted={(t) => void handleToggleCompleted(t)}
            onDelete={handleDeleteRequest}
            emptyText="조건에 맞는 할 일이 없습니다. 검색어나 필터를 바꿔 보세요."
          />
        </section>
        </div>
      </main>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open && !deleteLoading) setDeleteTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>이 할 일을 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget ? `「${deleteTarget.title}」을(를) 삭제합니다. 이 작업은 되돌릴 수 없습니다.` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>취소</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={deleteLoading}
              onClick={() => void handleConfirmDelete()}
            >
              {deleteLoading ? "삭제 중…" : "삭제"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
