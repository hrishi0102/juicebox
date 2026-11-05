import { NextResponse } from "next/server";
import { judgeConfigFromEnv } from "@/lib/receipts/judge";
import { rejudge } from "@/lib/receipts/pipeline";

export const maxDuration = 300;

// Sends private digests of the chosen sessions to the 0G Private Computer judge.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { sessionIds?: string[] };
  const cfg = judgeConfigFromEnv();
  if (cfg.engine !== "0g" || !cfg.apiKey) {
    return NextResponse.json(
      { ok: false, error: "The private judge is not set up. Add ZG_API_KEY (from pc.0g.ai) to web/.env.local and restart the app." },
      { status: 400 },
    );
  }
  try {
    const only = body.sessionIds?.length ? new Set(body.sessionIds) : undefined;
    const d = await rejudge("local", cfg, only);
    const judged = d.judgements.filter((j) => (!only || only.has(j.sessionId)) && j.judge.engine === "0g-tee");
    return NextResponse.json({
      ok: true,
      judged: judged.length,
      requested: only?.size ?? d.sessions.length,
      requestIds: judged.map((j) => j.judge.requestId).filter(Boolean),
      verified: judged.filter((j) => j.judge.verified).length,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
