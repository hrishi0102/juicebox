// Who signs: a key made on this laptop the first time you sign, so nobody needs a crypto wallet.
// It lives in ~/.receipts/identity.json, readable only by you, and never leaves the machine.
// The signed receipt also names your GitHub login (from the GitHub CLI or GITHUB_TOKEN), so the
// company can tell whose receipt it is.

import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import { resolveGithubToken } from "./github";
import { readJson, writeJson } from "./store";

type IdentityFile = { privateKey: Hex; address: Address; createdAt: string; github?: { login: string; name?: string; checkedAt: string } };

function load() {
  return readJson<IdentityFile | null>("local", "identity.json", null);
}

/** The laptop's signing account. With `create`, makes one on first use. */
export function laptopAccount(create: boolean) {
  const saved = load();
  if (saved?.privateKey) return privateKeyToAccount(saved.privateKey);
  if (!create) return undefined;
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  writeJson("local", "identity.json", { privateKey, address: account.address, createdAt: new Date().toISOString() } satisfies IdentityFile);
  return account;
}

/** The GitHub login behind the token this app already uses for pull requests (cached for a day). */
export async function githubLogin(): Promise<{ login: string; name?: string } | undefined> {
  const saved = load();
  if (saved?.github && Date.now() - Date.parse(saved.github.checkedAt) < 86400_000) return saved.github;
  const token = resolveGithubToken();
  if (!token) return undefined;
  try {
    const r = await fetch("https://api.github.com/user", { headers: { Authorization: `Bearer ${token}`, "User-Agent": "receipts-local" }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return undefined;
    const u = (await r.json()) as { login: string; name?: string };
    if (saved) writeJson("local", "identity.json", { ...saved, github: { login: u.login, name: u.name ?? undefined, checkedAt: new Date().toISOString() } });
    return { login: u.login, name: u.name ?? undefined };
  } catch {
    return undefined;
  }
}
