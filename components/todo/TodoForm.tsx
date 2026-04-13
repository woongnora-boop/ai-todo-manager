"use client"

import * as React from "react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"

import { cn } from "@/lib/utils"

import { coerceTodoPriority, type TodoPriority } from "@/lib/todos/priority"
import type { Todo } from "./TodoCard"

export type TodoFormValues = {
  title: string
  description?: string
  due_date?: string | null
  priority: TodoPriority
  category_id?: string | null
  completed?: boolean
}

/** AI 생성 API가 돌려주는 추가 필드(폼 상태에만 사용, category는 카테고리 라벨) */
export type TodoGenerateResult = Partial<TodoFormValues> & {
  category?: string | null
}

// 할 일 추가/편집 폼을 렌더링한다.
/**
 * 할 일 추가/편집 폼 컴포넌트다.
 *
 * @param initialValues 편집 모드 초기값(선택)
 * @param categories 카테고리 선택지(선택)
 * @param onSubmit 폼 저장 제출 콜백
 * @param onCancel 취소 버튼 콜백(선택)
 * @param onGenerate 자연어 입력 -> 필드 생성 콜백(선택)
 * @param submitLabel 제출 버튼 문구(선택)
 */
export const TodoForm = ({
  initialValues = null,
  categories = [],
  onSubmit,
  onCancel,
  onGenerate,
  submitLabel,
}: {
  initialValues?: (Pick<Todo, "id" | "title" | "description" | "due_date" | "priority" | "category_id" | "completed"> & {
    id?: string
  }) | null
  categories?: Array<{ id: string; name: string }>
  onSubmit: (values: TodoFormValues) => Promise<void> | void
  onCancel?: () => void
  onGenerate?: (prompt: string) => Promise<TodoGenerateResult> | TodoGenerateResult
  submitLabel?: string
}) => {
  const isEditMode = Boolean(initialValues?.id)

  const [title, setTitle] = React.useState(initialValues?.title ?? "")
  const [description, setDescription] = React.useState(initialValues?.description ?? "")
  const [dueDate, setDueDate] = React.useState<string | null>(
    initialValues?.due_date ? toDateTimeLocalValue(initialValues?.due_date) : null
  )
  const [priority, setPriority] = React.useState<TodoPriority>(() =>
    coerceTodoPriority(initialValues?.priority)
  )
  const [categoryId, setCategoryId] = React.useState<string | null>(initialValues?.category_id ?? null)
  /** categories 목록이 없을 때 한글 라벨(업무 등) 표시·저장용 */
  const [categoryLabelDisplay, setCategoryLabelDisplay] = React.useState("")
  const [completed, setCompleted] = React.useState<boolean>(Boolean(initialValues?.completed))

  const [prompt, setPrompt] = React.useState("")
  const [isGenerating, setIsGenerating] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)

  React.useEffect(() => {
    setTitle(initialValues?.title ?? "")
    setDescription(initialValues?.description ?? "")
    setDueDate(initialValues?.due_date ? toDateTimeLocalValue(initialValues?.due_date) : null)
    setPriority(coerceTodoPriority(initialValues?.priority))
    setCategoryId(initialValues?.category_id ?? null)
    setCategoryLabelDisplay("")
    setCompleted(Boolean(initialValues?.completed))
    setErrorMessage(null)
  }, [initialValues])

  const descriptionForSubmit = React.useMemo(() => {
    const base = description.trim()
    if (categories.length > 0) return base || undefined
    const cat = categoryLabelDisplay.trim()
    if (!cat) return base || undefined
    const line = `카테고리: ${cat}`
    if (base.includes(line)) return base || undefined
    return base ? `${base}\n${line}` : line
  }, [description, categoryLabelDisplay, categories.length])

  const values = React.useMemo<TodoFormValues>(
    () => ({
      title: title.trim(),
      description: descriptionForSubmit,
      due_date: dueDate ? fromDateTimeLocalValue(dueDate) : null,
      priority,
      category_id: categoryId ? categoryId : null,
      completed,
    }),
    [title, descriptionForSubmit, dueDate, priority, categoryId, completed]
  )

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isSubmitting || isGenerating) return

    const validationError = validate(values)
    if (validationError) {
      setErrorMessage(validationError)
      return
    }

    try {
      setErrorMessage(null)
      setIsSubmitting(true)
      await onSubmit(values)
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error(error)
      }
      setErrorMessage("저장 중 오류가 발생했어요. 다시 시도해 주세요.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleGenerate = async () => {
    if (!onGenerate) return
    if (isGenerating || isSubmitting) return
    if (!prompt.trim()) {
      setErrorMessage("위 입력란에 할 일을 문장으로 적은 뒤 「AI로 생성」을 눌러 주세요.")
      return
    }

    try {
      setErrorMessage(null)
      setIsGenerating(true)
      const generated = await onGenerate(prompt.trim())

      if (generated.title !== undefined) setTitle(generated.title ?? "")
      if (generated.description !== undefined) setDescription(generated.description ?? "")
      if (generated.due_date !== undefined) {
        setDueDate(generated.due_date ? toDateTimeLocalValue(generated.due_date) : null)
      }
      if (generated.priority !== undefined) setPriority(coerceTodoPriority(generated.priority))
      if (generated.category_id !== undefined) setCategoryId(generated.category_id ?? null)

      const aiCat = generated.category?.trim() ?? ""
      if (categories.length > 0) {
        if (aiCat) {
          const found = categories.find((c) => c.name === aiCat)
          setCategoryId(found?.id ?? null)
        } else {
          setCategoryId(null)
        }
        setCategoryLabelDisplay("")
      } else {
        setCategoryLabelDisplay(aiCat)
      }

      if (generated.completed !== undefined) setCompleted(Boolean(generated.completed))
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error(error)
      }
      const msg =
        error instanceof Error && error.message.trim()
          ? error.message
          : "AI 생성 중 오류가 발생했어요. 다른 표현으로 다시 시도해 주세요."
      setErrorMessage(msg)
    } finally {
      setIsGenerating(false)
    }
  }

  const titleText = isEditMode ? "할 일 수정" : "할 일 추가"
  const submitText = submitLabel ?? (isEditMode ? "수정" : "추가")

  return (
    <Card className="overflow-visible">
      <CardHeader>
        <CardTitle>{titleText}</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {errorMessage && (
          <Alert variant="destructive">
            <AlertTitle>처리 실패</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}

        {onGenerate && (
          <div className="space-y-2">
            <Label htmlFor="ai-prompt">자연어 입력</Label>
            <Textarea
              id="ai-prompt"
              placeholder="예: 내일 오전 10시에 팀 회의 준비"
              value={prompt}
              onChange={(e) => {
                setPrompt(e.target.value)
              }}
              disabled={isGenerating || isSubmitting}
            />
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => void handleGenerate()}
                disabled={isGenerating || isSubmitting}
              >
                {isGenerating ? (
                  <>
                    <Spinner />
                    생성 중...
                  </>
                ) : (
                  "AI로 생성"
                )}
              </Button>
              <p className="text-xs text-muted-foreground">
                문장을 입력한 뒤 버튼을 누르면 됩니다. 수정 모드에서도 폼을 다시 채울 수 있어요.
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="todo-title">제목</Label>
            <Input
              id="todo-title"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value)
              }}
              placeholder="예: 팀 회의 준비"
              disabled={isSubmitting || isGenerating}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="todo-description">설명</Label>
            <Textarea
              id="todo-description"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value)
              }}
              placeholder="예: 회의 자료/체크리스트 정리"
              disabled={isSubmitting || isGenerating}
            />
          </div>

          <div className="grid min-w-0 gap-4 md:grid-cols-2">
            <div className="min-w-0 space-y-2">
              <Label htmlFor="todo-due" suppressHydrationWarning>
                마감일 (선택)
              </Label>
              <Input
                id="todo-due"
                type="datetime-local"
                value={dueDate ?? ""}
                onChange={(e) => {
                  const next = e.target.value
                  setDueDate(next ? next : null)
                }}
                disabled={isSubmitting || isGenerating}
                suppressHydrationWarning
              />
            </div>

            <fieldset className="min-w-0 space-y-2 border-0 p-0">
              <legend className="mb-2 text-sm font-medium leading-none">우선순위</legend>
              <div className="flex flex-row flex-wrap gap-x-5 gap-y-2">
                {(
                  [
                    { value: "high" as const, label: "높음" },
                    { value: "medium" as const, label: "보통" },
                    { value: "low" as const, label: "낮음" },
                  ] as const
                ).map(({ value: pv, label }) => (
                  <label
                    key={pv}
                    className="flex cursor-pointer items-center gap-2 text-sm font-normal has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50"
                  >
                    <input
                      type="radio"
                      name="todo-priority"
                      value={pv}
                      checked={priority === pv}
                      disabled={isSubmitting || isGenerating}
                      onChange={() => setPriority(pv)}
                      className="size-4 accent-primary"
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </div>

          <div className="space-y-2">
            <Label>카테고리</Label>
            {categories.length ? (
              <Select
                value={categoryId ?? undefined}
                onValueChange={(v) => {
                  setCategoryId(v)
                }}
                disabled={isSubmitting || isGenerating}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="카테고리를 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={categoryLabelDisplay}
                onChange={(e) => {
                  setCategoryLabelDisplay(e.target.value)
                }}
                placeholder="예: 업무, 개인, 건강, 학습 (AI 생성 시 자동 입력)"
                disabled={isSubmitting || isGenerating}
              />
            )}
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              checked={completed}
              onCheckedChange={(next) => {
                if (typeof next === "boolean") setCompleted(next)
              }}
              disabled={isSubmitting || isGenerating}
            />
            <span className="text-sm text-muted-foreground">완료로 표시</span>
          </div>

          <CardFooter className="flex flex-col items-stretch gap-2 px-0 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              {onCancel && (
                <Button type="button" variant="outline" onClick={() => onCancel()} disabled={isSubmitting || isGenerating}>
                  취소
                </Button>
              )}
              <Button type="submit" disabled={isSubmitting || isGenerating} className={cn("justify-center")}>
                {isSubmitting ? (
                  <>
                    <Spinner />
                    저장 중...
                  </>
                ) : (
                  submitText
                )}
              </Button>
            </div>

            <div className="text-xs text-muted-foreground">
              입력 내용은 서버에서 검증된 뒤 저장됩니다.
            </div>
          </CardFooter>
        </form>
      </CardContent>
    </Card>
  )
}

const toDateTimeLocalValue = (iso?: string | null): string => {
  if (!iso) return ""
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""

  const pad = (n: number) => `${n}`.padStart(2, "0")
  const year = date.getFullYear()
  const month = pad(date.getMonth() + 1)
  const day = pad(date.getDate())
  const hour = pad(date.getHours())
  const minute = pad(date.getMinutes())
  return `${year}-${month}-${day}T${hour}:${minute}`
}

const fromDateTimeLocalValue = (value: string): string => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return new Date().toISOString()
  return date.toISOString()
}

const validate = (values: TodoFormValues): string | null => {
  if (!values.title.trim()) return "제목을 입력해 주세요."
  if (!values.priority) return "우선순위를 선택해 주세요."
  return null
}

