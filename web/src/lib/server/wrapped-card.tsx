import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { PERSONAS, SEGMENT_COPY, hourLabel, minutesLabel } from "@/lib/receipts/wrapped";
import { WrappedCardInput } from "@/lib/receipts/wrapped-schema";

// The AI Wrapped card, 1080x1350 (a portrait post). Numbers and the persona only: no messages,
// no words, no spend.

const fontDir = join(process.cwd(), "assets", "fonts");
const fonts = Promise.all([
  readFile(join(fontDir, "FragmentMono-Regular.ttf")),
  readFile(join(fontDir, "SchibstedGrotesk-Medium.ttf")),
  readFile(join(fontDir, "SchibstedGrotesk-Bold.ttf")),
]);

export { WrappedCardInput };

const W = 1080;
const H = 1350;

function Stat({ big, small }: { big: string; small: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "22px 24px", borderRadius: 24, background: "rgba(255,255,255,0.13)" }}>
      <div style={{ display: "flex", fontSize: 54, fontWeight: 700, letterSpacing: -1 }}>{big}</div>
      <div style={{ display: "flex", fontSize: 24, opacity: 0.85, marginTop: 4 }}>{small}</div>
    </div>
  );
}

export async function renderWrappedCard(c: WrappedCardInput) {
  const [mono, medium, bold] = await fonts;
  const persona = PERSONAS[c.p];
  // Fit everything in 1350 px: a two-line name or a long roast leaves room for fewer rows.
  const long = persona.name.length > 22;
  const rows = c.s.slice(0, 4 - (long ? 1 : 0) - (c.r && c.r.length > 150 ? 1 : 0));
  const maxMin = Math.max(1, ...rows.map((s) => s[2]));
  const nameSize = long ? 78 : 96;
  const chartHeight = c.r || long ? 64 : 88;
  const traits = c.t.slice(0, 2).map((t) => PERSONAS[t].name.replace(/^The /, ""));
  const quote = c.r ? `"${c.r.replace(/^"|"$/g, "")}"` : persona.line;
  return new ImageResponse(
    (
      <div
        style={{
          width: W,
          height: H,
          display: "flex",
          flexDirection: "column",
          padding: "70px 80px 64px",
          backgroundImage: "linear-gradient(155deg, #2c46c9 0%, #6d3fc6 52%, #be185d 100%)",
          color: "#ffffff",
          fontFamily: "Grotesk",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "Mono", fontSize: 26, letterSpacing: 3, opacity: 0.85 }}>
          <div style={{ display: "flex" }}>MY AI WRAPPED</div>
          <div style={{ display: "flex" }}>{c.l.toUpperCase()}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginTop: 64 }}>
          <div style={{ display: "flex", fontSize: 34, opacity: 0.8 }}>My AI personality</div>
          <div style={{ display: "flex", fontSize: nameSize, fontWeight: 700, lineHeight: 1.02, marginTop: 12, letterSpacing: -2 }}>{persona.name}</div>
          <div style={{ display: "flex", fontSize: c.r ? 32 : 36, lineHeight: 1.3, marginTop: 22, opacity: 0.93 }}>{quote}</div>
        </div>

        <div style={{ display: "flex", gap: 18, marginTop: 48 }}>
          <Stat big={minutesLabel(c.m)} small="with AI" />
          <Stat big={c.n.toLocaleString("en-US")} small="messages" />
          <Stat big={`${c.st}`} small={c.st === 1 ? "day streak" : "days in a row"} />
          <Stat big={`${c.ns}%`} small="after midnight" />
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginTop: 46 }}>
          <div style={{ display: "flex", fontFamily: "Mono", fontSize: 24, letterSpacing: 3, opacity: 0.8 }}>WHERE THE TIME WENT</div>
          {rows.map(([key, n, min]) => (
            <div key={key} style={{ display: "flex", flexDirection: "column", marginTop: 22 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 31 }}>
                <div style={{ display: "flex", fontWeight: 700 }}>{SEGMENT_COPY[key].label}</div>
                <div style={{ display: "flex", opacity: 0.9 }}>{`${minutesLabel(min)} · ${n.toLocaleString("en-US")} ${n === 1 ? SEGMENT_COPY[key].one : SEGMENT_COPY[key].many}`}</div>
              </div>
              <div style={{ display: "flex", height: 14, marginTop: 10, borderRadius: 7, background: "rgba(255,255,255,0.18)" }}>
                <div style={{ display: "flex", width: `${Math.max(3, Math.round((min / maxMin) * 100))}%`, height: 14, borderRadius: 7, background: "#ffffff" }} />
              </div>
            </div>
          ))}
        </div>

        {c.h && (
          <div style={{ display: "flex", flexDirection: "column", marginTop: c.r ? 30 : 44 }}>
            <div style={{ display: "flex", fontFamily: "Mono", fontSize: 24, letterSpacing: 3, opacity: 0.8 }}>{`WHEN I TALK TO AI · BUSIEST AT ${hourLabel(c.ph).toUpperCase()}`}</div>
            <div style={{ display: "flex", alignItems: "flex-end", height: chartHeight, marginTop: 16 }}>
              {c.h.map((v, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    flex: 1,
                    marginLeft: i ? 5 : 0,
                    height: `${v ? Math.max(6, v) : 2}%`,
                    borderRadius: 4,
                    background: i === c.ph ? "#ffffff" : i < 5 ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.32)",
                  }}
                />
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "Mono", fontSize: 18, opacity: 0.7, marginTop: 8 }}>
              <div style={{ display: "flex" }}>midnight</div>
              <div style={{ display: "flex" }}>6 a.m.</div>
              <div style={{ display: "flex" }}>noon</div>
              <div style={{ display: "flex" }}>6 p.m.</div>
              <div style={{ display: "flex" }}>11 p.m.</div>
            </div>
          </div>
        )}

        <div style={{ display: "flex", marginTop: "auto", justifyContent: "space-between", fontFamily: "Mono", fontSize: 23, opacity: 0.85 }}>
          <div style={{ display: "flex" }}>{traits.length ? `Also: ${traits.join(", ")}` : c.h ? "" : `Busiest hour: ${hourLabel(c.ph)}`}</div>
          <div style={{ display: "flex" }}>{traits.length ? "Receipts" : "Counted on my laptop · Receipts"}</div>
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
    },
  );
}
