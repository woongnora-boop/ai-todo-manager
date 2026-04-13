/** Asia/Seoul 기준 날짜·시각 문자열 (상대 날짜 해석용) */
export function getSeoulNowContext(): { dateYmd: string; timeHm: string; weekdayKo: string } {
  const now = new Date()
  const dateYmd = formatSeoulYmd(now)
  const timeHm = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now)
  const hm = timeHm.replace(/\s/g, "")
  const weekdayKo = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    weekday: "long",
  }).format(now)
  return { dateYmd, timeHm: hm.length === 5 ? hm : "09:00", weekdayKo }
}

export function formatSeoulYmd(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d)
  const y = parts.find((p) => p.type === "year")?.value
  const m = parts.find((p) => p.type === "month")?.value
  const day = parts.find((p) => p.type === "day")?.value
  if (!y || !m || !day) return new Date().toISOString().slice(0, 10)
  return `${y}-${m}-${day}`
}

/** KST wall time을 UTC ISO 문자열로 변환 (DB timestamptz 저장용) */
export function kstDateTimeToIso(dateYmd: string, timeHm: string): string {
  const [h, m] = timeHm.split(":").map((x) => Number.parseInt(x, 10))
  if (!Number.isFinite(h) || !Number.isFinite(m)) {
    return new Date(`${dateYmd}T09:00:00+09:00`).toISOString()
  }
  const hh = `${h}`.padStart(2, "0")
  const mm = `${m}`.padStart(2, "0")
  return new Date(`${dateYmd}T${hh}:${mm}:00+09:00`).toISOString()
}
