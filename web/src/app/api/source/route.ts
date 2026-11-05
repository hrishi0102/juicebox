import { NextResponse } from "next/server";
import { SOURCE_COOKIE } from "@/lib/server/data";

export async function POST(req: Request) {
  const { source } = (await req.json()) as { source?: string };
  const res = NextResponse.json({ ok: true });
  if (source === "local" || source === "demo") res.cookies.set(SOURCE_COOKIE, source, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  return res;
}
