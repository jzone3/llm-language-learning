import { ImageResponse } from "next/og";
import { BrandMark } from "@/components/BrandMark";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";

export const alt = `${SITE_NAME} — ${SITE_TAGLINE}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const QUIZ_LINES = ['1. "water" in Hebrew?', '2. "thank you" in Hebrew?', "3. New — guess the meaning:"];

// Satori lays Hebrew out left-to-right, so feed it the glyphs in visual order.
const SHALOM_VISUAL = Array.from("שלום").reverse().join("");

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#fafaf7",
          color: "#171717",
          padding: 72,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <BrandMark size={64} />
            <div style={{ fontSize: 36, fontWeight: 600, letterSpacing: -0.5 }}>{SITE_NAME}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 640 }}>
            <div style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2 }}>
              Learn a language one WhatsApp quiz a day.
            </div>
            <div style={{ fontSize: 28, color: "#525252", lineHeight: 1.35 }}>
              Reply by text or voice note. Spaced repetition does the rest. 10 languages, including Hebrew.
            </div>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            width: 380,
            marginLeft: 40,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 14,
              background: "#ffffff",
              border: "2px solid #e5e5e5",
              borderRadius: 28,
              padding: 32,
              fontSize: 24,
              lineHeight: 1.3,
              color: "#404040",
              boxShadow: "0 12px 40px rgba(0,0,0,0.08)",
            }}
          >
            <div style={{ display: "flex", color: "#737373", fontSize: 20 }}>Today, 8:00 AM</div>
            {QUIZ_LINES.map((line) => (
              <div key={line} style={{ display: "flex" }}>
                {line}
              </div>
            ))}
            <div style={{ display: "flex", fontSize: 30, fontWeight: 700, color: "#171717" }}>{SHALOM_VISUAL}</div>
            <div style={{ display: "flex", color: "#737373" }}>shalom</div>
            <div style={{ display: "flex" }}>a) hello&nbsp;&nbsp;b) bread&nbsp;&nbsp;c) water</div>
          </div>
        </div>
      </div>
    ),
    size
  );
}
