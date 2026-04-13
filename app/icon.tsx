import { ImageResponse } from "next/og"

export const runtime = "edge"

export const size = { width: 32, height: 32 }
export const contentType = "image/png"

/** 브랜드 색(#2563EB) 기반 — 바이너리 favicon 캐시 이슈 없이 빌드마다 갱신됨 */
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#2563EB",
          borderRadius: "6px",
          color: "white",
          fontSize: 20,
          fontWeight: 700,
        }}
      >
        ✓
      </div>
    ),
    { ...size }
  )
}
