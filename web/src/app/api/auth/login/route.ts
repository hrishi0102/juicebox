import { NextResponse } from "next/server";
import { githubOAuthReady, newState, STATE_COOKIE } from "@/lib/server/session";

// Start "Sign in with GitHub". Scopes: read:user (who you are) and read:org (your orgs and teams).
export async function GET(req: Request) {
  if (!githubOAuthReady()) return NextResponse.json({ ok: false, error: "GitHub sign-in is not set up (GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET)." }, { status: 400 });
  const url = new URL(req.url);
  const state = newState();
  const back = url.searchParams.get("next") ?? "/company";
  const authorize = new URL("https://github.com/login/oauth/authorize");
  authorize.searchParams.set("client_id", process.env.GITHUB_CLIENT_ID!);
  authorize.searchParams.set("redirect_uri", `${url.origin}/api/auth/callback`);
  authorize.searchParams.set("scope", "read:user read:org");
  authorize.searchParams.set("state", state);
  authorize.searchParams.set("allow_signup", "false");
  const res = NextResponse.redirect(authorize);
  res.cookies.set(STATE_COOKIE, JSON.stringify({ state, back: back.startsWith("/") && !back.startsWith("//") ? back : "/company" }), {
    httpOnly: true,
    sameSite: "lax",
    secure: url.protocol === "https:",
    path: "/",
    maxAge: 600,
  });
  return res;
}
