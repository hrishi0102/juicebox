// "Sign in with GitHub": one login for everyone. The company is a GitHub org, a team is a GitHub
// team. We keep only who you are and which orgs and teams you are in, in a signed cookie. The
// GitHub token is used once during sign-in and then dropped.
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "receipts-session";
export const STATE_COOKIE = "receipts-oauth-state";

export type GithubTeam = { org: string; slug: string; name: string };
export type Session = {
  login: string;
  name?: string;
  avatar?: string;
  orgs: string[];
  teams: GithubTeam[];
  at: string;
};

export function githubOAuthReady() {
  return !!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);
}

function secret() {
  const s = process.env.AUTH_SECRET || process.env.GITHUB_CLIENT_SECRET;
  if (!s) throw new Error("Set AUTH_SECRET (or GITHUB_CLIENT_SECRET) to sign sessions");
  return s;
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function encodeSession(s: Session) {
  const payload = Buffer.from(JSON.stringify(s)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function decodeSession(value: string | undefined): Session | undefined {
  if (!value) return undefined;
  const [payload, mac] = value.split(".");
  if (!payload || !mac) return undefined;
  try {
    const want = Buffer.from(sign(payload));
    const got = Buffer.from(mac);
    if (want.length !== got.length || !timingSafeEqual(want, got)) return undefined;
    const s = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Session;
    // Sessions last a week, like a receipt.
    if (Date.now() - Date.parse(s.at) > 7 * 86400_000) return undefined;
    return s;
  } catch {
    return undefined;
  }
}

export async function getSession(): Promise<Session | undefined> {
  if (!githubOAuthReady() && !process.env.AUTH_SECRET) return undefined;
  return decodeSession((await cookies()).get(SESSION_COOKIE)?.value);
}

export function newState() {
  return randomBytes(16).toString("base64url");
}

/** Read who someone is from GitHub, with the token from sign-in. */
export async function githubProfile(token: string): Promise<Omit<Session, "at">> {
  const gh = async <T,>(path: string): Promise<T> => {
    const r = await fetch(`https://api.github.com${path}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "receipts" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok) throw new Error(`GitHub ${path} answered ${r.status}`);
    return (await r.json()) as T;
  };
  const user = await gh<{ login: string; name?: string | null; avatar_url?: string }>("/user");
  // Orgs that restrict OAuth apps only show up after an owner approves this app.
  const orgs = await gh<{ login: string }[]>("/user/orgs?per_page=100").catch(() => []);
  const teams = await gh<{ slug: string; name: string; organization: { login: string } }[]>("/user/teams?per_page=100").catch(() => []);
  return {
    login: user.login,
    name: user.name ?? undefined,
    avatar: user.avatar_url,
    orgs: [...new Set([...orgs.map((o) => o.login), ...teams.map((t) => t.organization.login)])],
    teams: teams.map((t) => ({ org: t.organization.login, slug: t.slug, name: t.name })),
  };
}
