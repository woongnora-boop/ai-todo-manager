"use client"

import * as React from "react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"

import { TodoCard, type Todo } from "./TodoCard"

// 할 일 목록을 UI로 렌더링한다.
/**
 * 할 일 목록을 카드 형태로 렌더링한다.
 *
 * @param todos 할 일 배열
 * @param isLoading 로딩 상태 여부(선택)
 * @param errorMessage 오류 메시지(선택)
 * @param onEdit 카드의 수정 버튼 콜백(선택)
 * @param onToggleCompleted 카드의 완료 토글 콜백(선택)
 * @param onDelete 카드의 삭제 콜백(선택)
 * @param emptyText 빈 상태일 때 표시할 문구(선택)
 */
export const TodoList = ({
  todos,
  isLoading = false,
  errorMessage = null,
  onEdit,
  onToggleCompleted,
  onDelete,
  emptyText = "등록된 할 일이 없습니다.",
}: {
  todos: Todo[]
  isLoading?: boolean
  errorMessage?: string | null
  onEdit?: (todo: Todo) => void
  onToggleCompleted?: (todo: Todo) => void
  onDelete?: (todo: Todo) => void
  emptyText?: string
}) => {
  if (isLoading) {
    return (
      <div className="flex w-full flex-col gap-3">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    )
  }

  if (errorMessage) {
    return (
      <Alert variant="destructive">
        <AlertTitle>요청을 처리하지 못했어요.</AlertTitle>
        <AlertDescription>{errorMessage}</AlertDescription>
      </Alert>
    )
  }

  if (!todos.length) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>아직 할 일이 없어요</EmptyTitle>
          <EmptyDescription>{emptyText}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent className="pt-2 text-sm text-muted-foreground" />
      </Empty>
    )
  }

  return (
    <div className="flex w-full flex-col gap-3">
      {todos.map((todo) => (
        <TodoCard
          key={todo.id}
          todo={todo}
          onEdit={onEdit}
          onToggleCompleted={onToggleCompleted}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}

