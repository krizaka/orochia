import { ImageResponse } from "next/og";

import { getI18n } from "@/lib/i18n-server";

// i18n-ignore: Next reads `alt` statically, once, with no request to learn a language from — the picture itself speaks the language of its request.
export const alt = "Orochia — the video platform independent creators own";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The social preview: the brand on Obsidian Velvet Noir, no photo, nothing explicit. */
export default async function OpengraphImage() {
  const { t } = await getI18n();
  const points = t("seo.ogImagePoints").split(",").map((p) => p.trim());
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
          {t("seo.ogImageTagline")}
        </div>
        <div style={{ marginTop: 36, display: "flex", gap: 18, fontSize: 24, color: "#d4d4d8" }}>
          {points.map((point, i) => (
            <span key={point} style={{ display: "flex", gap: 18 }}>
              {i > 0 && <span style={{ color: "#d946ef" }}>·</span>}
              <span>{point}</span>
            </span>
          ))}
        </div>
        <div style={{ marginTop: "auto", fontSize: 22, color: "#a1a1aa" }}>{t("seo.ogImageFooter")}</div>
      </div>
    ),
    size,
  );
}
