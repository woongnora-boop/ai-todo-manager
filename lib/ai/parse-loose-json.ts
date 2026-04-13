/**
 * 모델이 마크다운·앞뒤 잡담과 함께 JSON을 줄 때 첫 번째 최상위 객체를 파싱한다.
 */
export function parseLooseJson(text: string): unknown {
  let s = text.trim()
  const fenced = /^```(?:json)?\s*\n?([\s\S]*?)\n?```/im.exec(s)
  if (fenced) s = fenced[1].trim()

  const start = s.indexOf("{")
  if (start === -1) {
    throw new SyntaxError("JSON 객체 시작 { 가 없습니다.")
  }

  let depth = 0
  let inString = false
  let escape = false

  for (let i = start; i < s.length; i++) {
    const c = s[i]
    if (escape) {
      escape = false
      continue
    }
    if (c === "\\" && inString) {
      escape = true
      continue
    }
    if (c === '"') {
      inString = !inString
      continue
    }
    if (inString) continue
    if (c === "{") depth++
    else if (c === "}") {
      depth--
      if (depth === 0) {
        return JSON.parse(s.slice(start, i + 1)) as unknown
      }
    }
  }

  throw new SyntaxError("JSON 중괄호가 맞지 않습니다.")
}
