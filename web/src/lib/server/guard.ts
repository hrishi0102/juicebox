// Protects the local API from other websites. The app runs on the user's machine and can sign
// receipts and publish them, so a page on another origin must never be able to trigger that
// (for example with a no-cors POST that skips the CORS preflight).
import { NextResponse } from "next/server";

export function rejectCrossSite(req: Request): NextResponse | undefined {
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") {
    return NextResponse.json({ ok: false, error: "Cross-site requests are not allowed." }, { status: 403 });
  }
  const origin = req.headers.get("origin");
  if (origin) {
    const host = req.headers.get("host");
    try {
      if (new URL(origin).host !== host) return NextResponse.json({ ok: false, error: "Cross-origin requests are not allowed." }, { status: 403 });
    } catch {
      return NextResponse.json({ ok: false, error: "Bad origin." }, { status: 403 });
    }
  }
  const type = req.headers.get("content-type") ?? "";
  if (req.method === "POST" && !type.includes("application/json")) {
    return NextResponse.json({ ok: false, error: "Expected application/json." }, { status: 415 });
  }
  return undefined;
}
