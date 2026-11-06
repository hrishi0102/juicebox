import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import type { CardInput } from "@/lib/receipts/card";
import { CATEGORIES } from "@/lib/receipts/types";

// The share card: a receipt slip on a blue background, 1080x1350 (fits X, LinkedIn and Instagram).
// Drawn on demand from what the person picked.

const fontDir = join(process.cwd(), "assets", "fonts");
const fonts = Promise.all([
  readFile(join(fontDir, "FragmentMono-Regular.ttf")),
  readFile(join(fontDir, "SchibstedGrotesk-Medium.ttf")),
  readFile(join(fontDir, "SchibstedGrotesk-Bold.ttf")),
]);

const INK = "#22252b";
const FAINT = "#8a8f99";
const PAPER = "#fcfcfa";
const BLUE = "#2c46c9";
const COLOR: Record<string, string> = {
  Built: "#18794e",
  Fixed: "#2c46c9",
  "Figured out": "#0f7c8c",
  Researched: "#7a3fc6",
  Wrote: "#b45309",
  Planned: "#475569",
  Wasted: "#be185d",
};

const W = 1080;
const H = 1350;
const SLIP = 840;

function zigzag(width: number, tooth = 24, depth = 22) {
  let d = `M0 0 L${width} 0`;
  for (let x = width; x > 0; x -= tooth) d += ` L${x - tooth / 2} ${depth} L${x - tooth} 0`;
  return d + " Z";
}

function bars(seed: string, width: number) {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const out: { x: number; w: number }[] = [];
  let x = 0;
  while (x < width) {
    h = (h * 1103515245 + 12345) >>> 0;
    const w = 2 + (h % 3) * 2;
    out.push({ x, w });
    x += w + 3 + ((h >> 8) % 4);
  }
  return out;
}

/** Draw the share card as a PNG response. */
export async function renderCard(c: CardInput) {
  const [mono, medium, bold] = await fonts;

  const groups = CATEGORIES.filter((cat) => c.items.some((i) => i.category === cat));
  const rows = c.items.length + groups.length;
  const size = rows <= 7 ? 31 : rows <= 11 ? 27 : rows <= 15 ? 23 : 20;
  const done = c.items.filter((i) => i.category !== "Wasted").length;
  const showCost = c.items.some((i) => i.costUsd !== undefined);

  return new ImageResponse(
    (
      <div
        style={{
          width: W,
          height: H,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundImage: "linear-gradient(160deg, #3552dd 0%, #2c46c9 45%, #1d2f8f 100%)",
          fontFamily: "Mono",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", width: SLIP, transform: "rotate(-1.2deg)" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              background: PAPER,
              color: INK,
              padding: "52px 60px 30px",
              boxShadow: "0 40px 80px rgba(8, 14, 50, 0.45)",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ display: "flex", fontSize: 24, letterSpacing: 8, color: FAINT }}>RECEIPTS</div>
              <div style={{ display: "flex", fontFamily: "Grotesk", fontWeight: 700, fontSize: 46, marginTop: 14, textAlign: "center", lineHeight: 1.1, letterSpacing: -1 }}>
                What did I get done this week?
              </div>
              <div style={{ display: "flex", fontSize: 22, marginTop: 14, color: INK }}>{`Week ${c.week.split("-W")[1]}, ${c.range}`}</div>
              {c.name ? <div style={{ display: "flex", fontSize: 22, color: FAINT, marginTop: 2 }}>{c.name}</div> : null}
            </div>

            <div style={{ display: "flex", borderTop: `3px dashed ${FAINT}`, margin: "26px 0 20px" }} />

            <div style={{ display: "flex", flexDirection: "column" }}>
              {groups.map((cat) => (
                <div key={cat} style={{ display: "flex", flexDirection: "column", marginBottom: Math.round(size * 0.55) }}>
                  <div style={{ display: "flex", alignItems: "center", fontSize: Math.round(size * 0.72), letterSpacing: 3, color: COLOR[cat] }}>
                    <div style={{ display: "flex", width: 12, height: 12, borderRadius: 6, background: COLOR[cat], marginRight: 12 }} />
                    <div style={{ display: "flex" }}>{cat.toUpperCase()}</div>
                  </div>
                  {c.items
                    .filter((i) => i.category === cat)
                    .map((i, n) => (
                      <div key={n} style={{ display: "flex", alignItems: "flex-end", fontSize: size, lineHeight: 1.3, marginTop: 4 }}>
                        <div style={{ display: "flex", flexShrink: 1 }}>{i.title}</div>
                        {i.costUsd !== undefined ? (
                          <>
                            <div style={{ display: "flex", flexGrow: 1, minWidth: 24, borderBottom: `2px dotted ${FAINT}`, margin: `0 10px ${Math.round(size * 0.32)}px` }} />
                            <div style={{ display: "flex" }}>{`$${i.costUsd.toFixed(2)}`}</div>
                          </>
                        ) : null}
                      </div>
                    ))}
                </div>
              ))}
            </div>

            <div style={{ display: "flex", borderTop: `3px dashed ${FAINT}`, margin: "10px 0 18px" }} />

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", flexDirection: "column", fontSize: 22, lineHeight: 1.45 }}>
                <div style={{ display: "flex" }}>{`${c.sessions} AI session${c.sessions === 1 ? "" : "s"}`}</div>
                <div style={{ display: "flex", color: FAINT }}>{c.tools.join(" + ") || "AI tools"}</div>
                {showCost && c.totalUsd !== undefined ? <div style={{ display: "flex", fontSize: 26, marginTop: 4 }}>{`Total $${c.totalUsd.toFixed(2)}`}</div> : null}
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  border: `5px solid ${BLUE}`,
                  borderRadius: 10,
                  color: BLUE,
                  padding: "8px 22px",
                  transform: "rotate(-6deg)",
                }}
              >
                <div style={{ display: "flex", fontSize: 52, lineHeight: 1 }}>{done}</div>
                <div style={{ display: "flex", fontSize: 18, letterSpacing: 2 }}>{done === 1 ? "THING DONE" : "THINGS DONE"}</div>
              </div>
            </div>

            {c.sentence ? (
              <div style={{ display: "flex", fontFamily: "Grotesk", fontWeight: 500, fontSize: 28, lineHeight: 1.3, marginTop: 26, color: INK }}>
                {`\u201c${c.sentence}\u201d`}
              </div>
            ) : null}

            <div style={{ display: "flex", marginTop: 26, height: 44 }}>
              <svg width={SLIP - 120} height={44} viewBox={`0 0 ${SLIP - 120} 44`}>
                {bars(c.week + c.items.map((i) => i.title).join(""), SLIP - 120).map((b, i) => (
                  <rect key={i} x={b.x} y={0} width={b.w} height={44} fill={INK} />
                ))}
              </svg>
            </div>
            <div style={{ display: "flex", justifyContent: "center", fontSize: 18, color: FAINT, marginTop: 10 }}>
              {`Written by ${c.writtenBy}. Prompts not included.`}
            </div>
          </div>
          <svg width={SLIP} height={22} viewBox={`0 0 ${SLIP} 22`} style={{ marginTop: -1 }}>
            <path d={zigzag(SLIP)} fill={PAPER} />
          </svg>
        </div>
        <div style={{ display: "flex", marginTop: 46, fontFamily: "Grotesk", fontWeight: 500, fontSize: 26, color: "rgba(255,255,255,0.86)" }}>
          receipts: what did you get done this week?
        </div>
      </div>
    ),
    {
      width: W,
      height: H,
      fonts: [
        { name: "Mono", data: mono, weight: 400, style: "normal" },
        { name: "Grotesk", data: medium, weight: 500, style: "normal" },
        { name: "Grotesk", data: bold, weight: 700, style: "normal" },
      ],
      headers: { "Cache-Control": "no-store" },
    },
  );
}
