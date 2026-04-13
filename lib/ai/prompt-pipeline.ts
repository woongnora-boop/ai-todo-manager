/** 제어 문자·NULL 등 제거(줄바꿈은 공백으로) */
const CONTROL_CHARS =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200D\uFEFF]/g

/** 사용자 입력 길이 제한은 UTF-16이 아니라 “보이는 글자”(그래프렘) 기준 */
export const PROMPT_MIN_GRAPHEMES = 1
export const PROMPT_MAX_GRAPHEMES = 500

export type PromptValidationError = {
  message: string
}

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

/**
 * 전처리: 앞뒤 공백, 연속 공백 통합, 유니코드 NFC,
 * 제어 문자·제로폭 문자 제거. 이모지·혼합 문자열 보존.
 * (입력 문맥·고유명사 보존을 위해 대소문자는 바꾸지 않음 — 제목 후처리에서 라틴만 정규화)
 */
export function preprocessPrompt(raw: string): string {
  let s = raw.replace(/\r\n|\r|\n/g, " ").replace(/\t/g, " ")
  s = s.normalize("NFC")
  s = s.replace(CONTROL_CHARS, "")
  s = s.replace(/\s+/g, " ").trim()
  return s
}

export function validatePromptProcessed(processed: string): { ok: true } | { ok: false; error: PromptValidationError } {
  if (!processed) {
    return { ok: false, error: { message: "할 일 내용을 입력해 주세요." } }
  }
  const n = countGraphemes(processed)
  if (n < PROMPT_MIN_GRAPHEMES) {
    return {
      ok: false,
      error: { message: "할 일 내용을 한 글자 이상 입력해 주세요." },
    }
  }
  if (n > PROMPT_MAX_GRAPHEMES) {
    return {
      ok: false,
      error: { message: `입력은 최대 ${PROMPT_MAX_GRAPHEMES}자(이모지 포함)까지 가능합니다.` },
    }
  }
  return { ok: true }
}

/** 제목 등에만 쓰는 라틴 알파벳 대소문자 정규화(고유명사 보존은 AI에 맡기고, ASCII 단어만 소문자 통일) */
export function normalizeLatinCaseInTitle(s: string): string {
  return s.replace(/[A-Za-z]+/g, (w) => w.toLowerCase())
}
