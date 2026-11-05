import { NextResponse } from "next/server";
import { runPipeline } from "@/lib/receipts/pipeline";
import { SOURCE_COOKIE } from "@/lib/server/data";

export const maxDuration = 300;

// Reads ~/.claude/projects on this machine. Only works when the app runs locally.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { days?: number };
  const log: string[] = [];
  try {
    const d = await runPipeline({ days: Math.min(Math.max(body.days ?? 30, 1), 90), skipJudge: true, progress: (s, m) => log.push(`[${s}] ${m ?? ""}`) });
    const res = NextResponse.json({ ok: true, sessions: d.sessions.length, changes: d.changes.length, links: d.matches.length, log: log.slice(-12) });
    res.cookies.set(SOURCE_COOKIE, "local", { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
    return res;
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e), log }, { status: 500 });
  }
}
