import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { encodeSession, githubOAuthReady, githubProfile, SESSION_COOKIE, STATE_COOKIE } from "@/lib/server/session";

// GitHub sends the person back here. We swap the code for a token, read who they are and which
// orgs and teams they are in, keep that in a signed cookie, and drop the token.
export async function GET(req: Request) {
  const url = new URL(req.url);
  if (!githubOAuthReady()) return NextResponse.json({ ok: false, error: "GitHub sign-in is not set up." }, { status: 400 });
  const jar = await cookies();
  let saved: { state?: string; back?: string } = {};
  try {
    saved = JSON.parse(jar.get(STATE_COOKIE)?.value ?? "{}");
  } catch {
    /* treated as missing */
  }
  const code = url.searchParams.get("code");
  if (!code || !saved.state || url.searchParams.get("state") !== saved.state) {
    return NextResponse.json({ ok: false, error: "Sign-in expired or was started elsewhere. Try again." }, { status: 400 });
  }
  try {
    const r = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: process.env.GITHUB_CLIENT_ID, client_secret: process.env.GITHUB_CLIENT_SECRET, code, redirect_uri: `${url.origin}/api/auth/callback` }),
      signal: AbortSignal.timeout(10_000),
    });
    const tok = (await r.json()) as { access_token?: string; error_description?: string };
    if (!tok.access_token) throw new Error(tok.error_description ?? "GitHub did not return a token");
    const profile = await githubProfile(tok.access_token);
    const res = NextResponse.redirect(new URL(saved.back ?? "/org", url.origin));
    res.cookies.set(SESSION_COOKIE, encodeSession({ ...profile, at: new Date().toISOString() }), {
      httpOnly: true,
      sameSite: "lax",
      secure: url.protocol === "https:",
      path: "/",
      maxAge: 7 * 86400,
    });
    res.cookies.delete(STATE_COOKIE);
    return res;
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
