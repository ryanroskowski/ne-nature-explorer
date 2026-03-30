import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "New England Nature Explorer";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #f5f0e8 0%, #e8e0d0 100%)",
          fontFamily: "serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "20px",
            marginBottom: "24px",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: "72px",
            }}
          >
            🌲
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize: "56px",
              fontWeight: 700,
              color: "#2d5a27",
              lineHeight: 1.1,
            }}
          >
            <span>New England</span>
            <span>Nature Explorer</span>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            fontSize: "24px",
            color: "#6b5e50",
            maxWidth: "700px",
            textAlign: "center",
            lineHeight: 1.4,
          }}
        >
          An interactive field guide to plants, fungi, birds, mammals, insects, and more across all six New England states
        </div>
        <div
          style={{
            display: "flex",
            gap: "16px",
            marginTop: "32px",
            fontSize: "32px",
          }}
        >
          <span>🌿</span>
          <span>🍄</span>
          <span>🐦</span>
          <span>🦌</span>
          <span>🦋</span>
          <span>🐸</span>
          <span>🐍</span>
          <span>🕷️</span>
          <span>🐟</span>
        </div>
      </div>
    ),
    { ...size }
  );
}
