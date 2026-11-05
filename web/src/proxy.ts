import { NextResponse, type NextRequest } from "next/server";

// Receipts serves private data (session titles, costs) and can sign and publish receipts, so by
// default it only answers requests addressed to this machine. This blocks DNS-rebinding tricks,
// where a website points its own domain at 127.0.0.1 to read local pages.
// For a hosted demo, list its host names in RECEIPTS_ALLOWED_HOSTS (comma separated).
const LOCAL = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function proxy(request: NextRequest) {
  const host = (request.headers.get("host") ?? "").replace(/:\d+$/, "").toLowerCase();
  const extra = (process.env.RECEIPTS_ALLOWED_HOSTS ?? "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  if (LOCAL.has(host) || extra.includes(host) || (process.env.VERCEL && host.endsWith(".vercel.app"))) return NextResponse.next();
  return new NextResponse("Receipts only answers on localhost. Set RECEIPTS_ALLOWED_HOSTS to allow another host name.", { status: 403 });
}

export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico).*)",
};
