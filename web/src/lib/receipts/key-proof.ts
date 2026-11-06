// Proving that a signing key belongs to a GitHub account.
//
// A receipt names its author's GitHub login, but anyone can type a login. So the employee publishes
// one public gist on their own GitHub account, holding a short note signed by the key that signs
// their receipts. Anyone can then check it without trusting us: GitHub says who owns the gist, and
// the signature says which key wrote the note. Nothing about the person's work is in it.
//
// The file (`receipts-key.txt`):
//
//   Receipts key proof
//
//   I am @octocat on GitHub. The key 0xAbC… signs my weekly receipts in Receipts.
//
//   github: octocat
//   key: 0xAbC…
//   date: 2026-11-07
//
//   signature: 0x…   (EIP-191 personal_sign over everything above the blank line before it)

import { getAddress, isAddress, recoverMessageAddress, type Hex } from "viem";

export const PROOF_FILE = "receipts-key.txt";
export const PROOF_DESCRIPTION = "Receipts: the key that signs my weekly receipts";
const TITLE = "Receipts key proof";
const SIG = "\n\nsignature: ";

/** The note to sign. `date` is YYYY-MM-DD. */
export function proofStatement(login: string, address: string, date: string): string {
  const key = getAddress(address);
  return [TITLE, "", `I am @${login} on GitHub. The key ${key} signs my weekly receipts in Receipts.`, "", `github: ${login}`, `key: ${key}`, `date: ${date}`].join("\n");
}

/** The whole file: the note, then its signature. */
export function proofText(statement: string, signature: Hex): string {
  return `${statement}${SIG}${signature}\n`;
}

export type ParsedProof = { statement: string; login: string; address: string; signature: Hex };

/** Read a proof file. Undefined if it is not one. Tolerates Windows line endings. */
export function parseProof(text: string): ParsedProof | undefined {
  const t = text.replace(/\r\n/g, "\n");
  const at = t.lastIndexOf(SIG);
  if (at < 0) return undefined;
  const statement = t.slice(0, at);
  const signature = t.slice(at + SIG.length).trim();
  if (!statement.startsWith(TITLE) || !/^0x[0-9a-fA-F]{130}$/.test(signature)) return undefined;
  const line = (name: string) => statement.match(new RegExp(`^${name}: (.+)$`, "m"))?.[1]?.trim();
  const login = line("github");
  const address = line("key");
  if (!login || !address || !isAddress(address)) return undefined;
  return { statement, login, address, signature: signature as Hex };
}

/**
 * Does this file prove that `address` belongs to `login`? The note must name both, and its
 * signature must come from that key. (That GitHub says `login` owns the gist is checked by the
 * caller, which knows where the file came from.)
 */
export async function proves(text: string, login: string, address: string): Promise<boolean> {
  const p = parseProof(text);
  if (!p) return false;
  if (p.login.toLowerCase() !== login.toLowerCase() || p.address.toLowerCase() !== address.toLowerCase()) return false;
  try {
    const signer = await recoverMessageAddress({ message: p.statement, signature: p.signature });
    return signer.toLowerCase() === address.toLowerCase();
  } catch {
    return false;
  }
}

/** A gist as GitHub lists it: who owns it, and its files with where to read them. */
export type GistLike = { html_url: string; owner?: { login?: string } | null; files: Record<string, { filename?: string; raw_url?: string } | undefined> };

/**
 * Look through someone's public gists for a proof that `address` is theirs. `read` fetches a file
 * by its raw URL. Only gists GitHub says are owned by `login` count.
 */
export async function findProof(gists: GistLike[], login: string, address: string, read: (url: string) => Promise<string>): Promise<string | undefined> {
  for (const g of gists) {
    if (g.owner?.login?.toLowerCase() !== login.toLowerCase()) continue;
    const f = g.files[PROOF_FILE];
    if (!f?.raw_url) continue;
    try {
      if (await proves(await read(f.raw_url), login, address)) return g.html_url;
    } catch {
      // unreadable file: try the next gist
    }
  }
  return undefined;
}
