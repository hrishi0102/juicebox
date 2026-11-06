// Checking and publishing GitHub key proofs (server only). The format and the checks themselves
// are in lib/receipts/key-proof.ts; this file talks to GitHub and keeps a small cache, so a company
// page with many people stays fast and inside GitHub's rate limits.
import { resolveGithubToken } from "@/lib/receipts/github";
import { githubLogin } from "@/lib/receipts/identity";
import { findProof, proofStatement, proofText, PROOF_DESCRIPTION, PROOF_FILE, type GistLike } from "@/lib/receipts/key-proof";
import { readJson, writeJson, type Source } from "@/lib/receipts/store";
import { ensureSignerAddress, signWithReceiptKey } from "./receipts-store";

/** proven: a public gist on that account proves the key. none: no proof found. demo: a made-up person. */
export type KeyProof = { status: "proven"; url: string } | { status: "none" } | { status: "unknown"; reason: string } | { status: "demo" };

const CACHE = "cache/key-proofs.json";
type Cached = { status: "proven" | "none"; url?: string; at: string };
// A proof is stable; a missing one may be published any minute, so check again soon.
const TTL = { proven: 24 * 3600_000, none: 10 * 60_000 };
const keyOf = (login: string, address: string) => `${login.toLowerCase()}|${address.toLowerCase()}`;

function fromCache(c?: Cached): KeyProof | undefined {
  if (!c || Date.now() - Date.parse(c.at) > TTL[c.status]) return undefined;
  return c.status === "proven" && c.url ? { status: "proven", url: c.url } : { status: "none" };
}

async function github(path: string, token?: string, init: RequestInit = {}) {
  return fetch(`https://api.github.com${path}`, {
    ...init,
    headers: { Accept: "application/vnd.github+json", "User-Agent": "receipts", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(6000),
  });
}

/** Ask GitHub: does `login` have a public gist proving `address`? */
async function lookup(login: string, address: string, token?: string): Promise<KeyProof> {
  try {
    const r = await github(`/users/${encodeURIComponent(login)}/gists?per_page=100`, token);
    if (r.status === 404) return { status: "none" };
    if (!r.ok) return { status: "unknown", reason: r.status === 403 || r.status === 429 ? "GitHub's rate limit" : `GitHub answered ${r.status}` };
    const gists = (await r.json()) as GistLike[];
    const url = await findProof(gists, login, address, async (raw) => {
      const f = await fetch(raw, { signal: AbortSignal.timeout(6000) });
      if (!f.ok) throw new Error(String(f.status));
      return (await f.text()).slice(0, 4000);
    });
    return url ? { status: "proven", url } : { status: "none" };
  } catch (e) {
    return { status: "unknown", reason: e instanceof Error ? e.message : String(e) };
  }
}

function remember(entries: [string, KeyProof][]) {
  const cache = readJson<Record<string, Cached>>("local", CACHE, {});
  const at = new Date().toISOString();
  for (const [k, p] of entries) if (p.status === "proven" || p.status === "none") cache[k] = { status: p.status, url: p.status === "proven" ? p.url : undefined, at };
  writeJson("local", CACHE, cache);
}

/** One person's proof. `fresh` skips the cache (the employee's own "Check again"). */
export async function keyProofFor(login: string, address: string, opts: { fresh?: boolean } = {}): Promise<KeyProof> {
  const k = keyOf(login, address);
  const hit = opts.fresh ? undefined : fromCache(readJson<Record<string, Cached>>("local", CACHE, {})[k]);
  if (hit) return hit;
  const p = await lookup(login, address, resolveGithubToken());
  remember([[k, p]]);
  return p;
}

/** Proofs for many people at once (a company page). Demo people are never looked up on GitHub. */
export async function keyProofsFor(people: { login?: string; address: string; demo?: boolean }[]): Promise<Map<string, KeyProof>> {
  const out = new Map<string, KeyProof>();
  const cache = readJson<Record<string, Cached>>("local", CACHE, {});
  const todo: { k: string; login: string; address: string }[] = [];
  for (const p of people) {
    if (!p.login) continue;
    const k = keyOf(p.login, p.address);
    if (out.has(k)) continue;
    if (p.demo) out.set(k, { status: "demo" });
    else {
      const hit = fromCache(cache[k]);
      if (hit) out.set(k, hit);
      else todo.push({ k, login: p.login, address: p.address });
    }
  }
  if (todo.length) {
    const token = resolveGithubToken();
    const found = await Promise.all(todo.map(async (t) => [t.k, await lookup(t.login, t.address, token)] as [string, KeyProof]));
    for (const [k, p] of found) out.set(k, p);
    remember(found);
  }
  return out;
}

export function proofKey(login: string | undefined, address: string) {
  return login ? keyOf(login, address) : "";
}

/** The signed proof file for this laptop's key and GitHub login, ready to publish. */
export async function ownProofText(source: Source, login: string) {
  const address = ensureSignerAddress(source);
  const statement = proofStatement(login, address, new Date().toISOString().slice(0, 10));
  const { signature } = await signWithReceiptKey(source, statement);
  return { address, text: proofText(statement, signature) };
}

export type PublishResult = { ok: true; url: string; existed: boolean } | { ok: false; error: string; text?: string };

/**
 * Publish the proof as a public gist on the employee's own GitHub account, with the GitHub login
 * this laptop already has. If a valid proof is already there, nothing new is made.
 */
export async function publishKeyProof(source: Source): Promise<PublishResult> {
  if (source === "demo") return { ok: false, error: "The demo engineer has no GitHub account to prove." };
  const me = await githubLogin();
  if (!me) return { ok: false, error: "Connect GitHub first: run gh auth login in a terminal." };
  const { address, text } = await ownProofText(source, me.login);
  const existing = await keyProofFor(me.login, address, { fresh: true });
  if (existing.status === "proven") return { ok: true, url: existing.url, existed: true };
  const token = resolveGithubToken();
  if (!token) return { ok: false, error: "No GitHub login on this laptop. Run gh auth login, or make the gist yourself with the text below.", text };
  try {
    const r = await github("/gists", token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: PROOF_DESCRIPTION, public: true, files: { [PROOF_FILE]: { content: text } } }),
    });
    if (!r.ok)
      return {
        ok: false,
        error:
          r.status === 403 || r.status === 404
            ? "Your GitHub login on this laptop cannot create gists. Run gh auth refresh -s gist, or make the gist yourself with the text below."
            : `GitHub answered ${r.status}. You can make the gist yourself with the text below.`,
        text,
      };
    const g = (await r.json()) as { html_url: string };
    remember([[keyOf(me.login, address), { status: "proven", url: g.html_url }]]);
    return { ok: true, url: g.html_url, existed: false };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e), text };
  }
}
