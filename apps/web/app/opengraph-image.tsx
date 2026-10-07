import { ImageResponse } from "next/og";

export const alt = "Orochia — the open-source video platform independent creators own";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The social preview: the brand on Obsidian Velvet Noir, no photo, nothing explicit. */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "radial-gradient(circle at 80% 20%, #4c1d95 0%, #09090b 55%), #09090b",
          color: "#fafafa",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 92, fontWeight: 900, letterSpacing: -2 }}>
          OROCHIA<span style={{ color: "#a78bfa" }}>.</span>
        </div>
        <div style={{ marginTop: 24, fontSize: 40, fontWeight: 600, maxWidth: 900, lineHeight: 1.25 }}>
          The video platform independent creators own.
        </div>
        <div style={{ marginTop: 36, display: "flex", gap: 18, fontSize: 24, color: "#d4d4d8" }}>
          <span>Signed 4K streams</span>
          <span style={{ color: "#d946ef" }}>·</span>
          <span>Gateway-confirmed payments</span>
          <span style={{ color: "#d946ef" }}>·</span>
          <span>Open source</span>
        </div>
        <div style={{ marginTop: "auto", fontSize: 22, color: "#a1a1aa" }}>orochia.com · by Krizaka · 18+</div>
      </div>
    ),
    size,
  );
}
