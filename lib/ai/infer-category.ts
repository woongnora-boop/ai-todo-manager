/** AI가 category를 빠뜨렸을 때 제목·입력에서 키워드로 보갑 */
const LABELS = ["업무", "개인", "건강", "학습"] as const
export type CategoryLabel = (typeof LABELS)[number]

const RULES: Array<{ label: CategoryLabel; keywords: string[] }> = [
  { label: "업무", keywords: ["회의", "보고서", "프로젝트", "업무"] },
  { label: "개인", keywords: ["쇼핑", "친구", "가족", "개인"] },
  { label: "건강", keywords: ["운동", "병원", "건강", "요가"] },
  { label: "학습", keywords: ["공부", "책", "강의", "학습"] },
]

export function normalizeCategoryLabel(raw: string | null | undefined): CategoryLabel | null {
  if (!raw?.trim()) return null
  const t = raw.trim()
  if ((LABELS as readonly string[]).includes(t)) return t as CategoryLabel
  return null
}

export function inferCategoryLabel(text: string): CategoryLabel | null {
  const t = text.toLowerCase()
  for (const { label, keywords } of RULES) {
    if (keywords.some((k) => t.includes(k.toLowerCase()))) return label
  }
  return null
}
