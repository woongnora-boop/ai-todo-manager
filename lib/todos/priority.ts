export type TodoPriority = "high" | "medium" | "low"

export function coerceTodoPriority(v: unknown): TodoPriority {
  if (v === "high" || v === "medium" || v === "low") return v
  return "medium"
}
