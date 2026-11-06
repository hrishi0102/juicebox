import { BadgeCheck } from "lucide-react";
import type { KeyProof } from "@/lib/server/key-proofs";

/** "@octocat, key proven on GitHub" with a link to the gist, or why it is only claimed. */
export function GithubProof({ login, proof }: { login: string; proof?: KeyProof }) {
  if (proof?.status === "proven")
    return (
      <a href={proof.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[var(--c-built)] hover:underline" title="A public gist on this GitHub account is signed by the key that signed this receipt">
        <BadgeCheck className="size-4" aria-hidden="true" />@{login}, key proven on GitHub
      </a>
    );
  if (proof?.status === "demo") return <span>@{login}, a demo member known by key</span>;
  if (proof?.status === "unknown") return <span title={proof.reason}>@{login}, could not check GitHub just now</span>;
  if (proof?.status === "none") return <span title="Anyone can type a login; no public gist on this account proves the key">@{login} is claimed, not proven on GitHub</span>;
  return <span>signed as @{login}</span>;
}
