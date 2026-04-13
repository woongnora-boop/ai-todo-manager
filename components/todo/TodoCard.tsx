"use client"

import * as React from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import type { TodoPriority } from "@/lib/todos/priority"
import { cn } from "@/lib/utils"

export type { TodoPriority } from "@/lib/todos/priority"

export type TodoStatus = "진행중" | "완료" | "지연"

export type Todo = {
  id: string
  user_id: string
  title: string
  description?: string | null
  created_date?: string | null
  due_date?: string | null
  priority: TodoPriority
  category_id?: string | null
  completed?: boolean | null
}

// 개별 할 일을 카드 형태로 렌더링한다.
/**
 * 개별 할 일 정보를 카드로 표시한다.
 *
 * @param todo 할 일 데이터
 * @param onEdit 수정 버튼 클릭 시 호출되는 콜백(선택)
 * @param onToggleCompleted 완료 토글 클릭 시 호출되는 콜백(선택)
 * @param onDelete 삭제 버튼 클릭 시 호출되는 콜백(선택)
 * @param now 상태 계산 기준 시간(테스트/일관성 용도, 선택)
 */
export const TodoCard = ({
  todo,
  onEdit,
  onToggleCompleted,
  onDelete,
  now = new Date(),
  className,
}: {
  todo: Todo
  onEdit?: (todo: Todo) => void
  onToggleCompleted?: (todo: Todo) => void
  onDelete?: (todo: Todo) => void
  now?: Date
  className?: string
}) => {
  const getStatus = (t: Todo, reference: Date): TodoStatus => {
    if (t.completed) return "완료"
    const due = t.due_date ? new Date(t.due_date) : null
    if (!due || Number.isNaN(due.getTime())) return "진행중"
    if (due.getTime() < reference.getTime()) return "지연"
    return "진행중"
  }

  const status = getStatus(todo, now)

  const priorityVariant =
    todo.priority === "high" ? "destructive" : todo.priority === "medium" ? "secondary" : "outline"

  // SSR과 브라우저의 Intl.DateTimeFormat("ko-KR") 결과가 달라 하이드레이션 오류가 나지 않도록,
  // 마감일 문자열은 마운트 이후(클라이언트)에서만 계산한다.
  const [dueText, setDueText] = React.useState("-")

  React.useEffect(() => {
    if (!todo.due_date) {
      setDueText("-")
      return
    }
    const due = new Date(todo.due_date)
    if (Number.isNaN(due.getTime())) {
      setDueText("-")
      return
    }
    setDueText(
      new Intl.DateTimeFormat("ko-KR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(due)
    )
  }, [todo.due_date])

  const categoryFromDescription = todo.description?.match(/카테고리:\s*([^\n]+)/)?.[1]?.trim()
  const categoryDisplay =
    todo.category_id?.trim() || categoryFromDescription || "-"

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="min-w-0">
          <CardTitle className="line-clamp-1">{todo.title || "-"}</CardTitle>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant={priorityVariant}>{todo.priority === "high" ? "High" : todo.priority}</Badge>
            <Badge
              variant={status === "완료" ? "default" : status === "진행중" ? "outline" : "destructive"}
            >
              {status}
            </Badge>
          </div>
        </div>

        <div className="shrink-0 text-right">
          <div className="text-xs text-muted-foreground">마감</div>
          <div className="text-sm font-medium">{dueText}</div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <p className="whitespace-pre-wrap text-sm text-muted-foreground">
          {todo.description?.trim() ? todo.description : "설명이 없습니다."}
        </p>
      </CardContent>

      <CardFooter className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground">카테고리: {categoryDisplay}</div>

        <div className="flex items-center gap-2">
          {onToggleCompleted && (
            <Button variant="secondary" size="sm" onClick={() => onToggleCompleted(todo)}>
              {todo.completed ? "완료 취소" : "완료로 표시"}
            </Button>
          )}
          {onEdit && (
            <Button variant="outline" size="sm" onClick={() => onEdit(todo)}>
              수정
            </Button>
          )}
          {onDelete && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => onDelete(todo)}
              disabled={!onDelete}
            >
              삭제
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  )
}

