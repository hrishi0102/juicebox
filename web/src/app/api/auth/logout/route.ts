import { NextResponse } from "next/server";
import { rejectCrossSite } from "@/lib/server/guard";
import { SESSION_COOKIE } from "@/lib/server/session";

export async function POST(req: Request) {
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
