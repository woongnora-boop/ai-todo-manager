/** API 응답(JSON)과 postProcess 입력에 공통으로 쓰는 형태 */
export type AiTodoPayload = {
  title: string
  description?: string
  due_date: string | null
  priority: "high" | "medium" | "low"
  category_id: null
  category: string | null
}
