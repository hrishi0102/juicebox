"use client";

// Review, sign, send: the employee's receipt for the company, one step at a time.
//   Review  what the company will see, what everyone can see, what stays on this laptop.
//           Any line can be kept private; it still counts in the signed totals.
//   Sign    lock the list and the numbers with the key on this laptop (or a wallet).
//   Send    one read-only Arkiv record, owned by you; the list sealed for the company on Swarm.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createWalletClient, custom, type Address, type EIP1193Provider } from "viem";
import { Check, EyeOff, Lock } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { CategoryBadge } from "@/components/category-badge";
import { typedDataFor, type SignedReceipt } from "@/lib/receipts/receipt";
import type { Category } from "@/lib/receipts/types";

export type SendFlowProps = {
  week: string;
  weekLabel: string;
  demo: boolean;
  company: { org: string; orgName: string; teamName: string } | null;
  items: { index: number; category: Category; title: string; cost: string }[];
  prs: { key: string; title: string; url: string; state: string }[];
  totals: { done: number; spend: string; merged: number; sessions: number; tools: string };
  signed: boolean;
  stale: boolean;
  signer?: string;
  signedAt?: string;
  sent: { arkivKey?: string; level: string; hidden?: number; publishedAt?: string } | null;
  arkivReady: boolean;
  sealed: boolean;
  savedJson?: string;
};

export function SendFlow(p: SendFlowProps) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<number>>(new Set());
  const [, start] = useTransition();
  const org = p.company?.orgName ?? "your company";
  const sentOk = !!p.sent?.arkivKey;

  async function run(name: string, fn: () => Promise<void>) {
    setBusy(name);
    try {
      await fn();
      start(() => router.refresh());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  const post = async (url: string, body: unknown) => {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json();
    if (!j.ok) throw new Error(j.error);
    return j;
  };

  const signLocal = () =>
    run("sign", async () => {
      await post("/api/receipt/sign-local", { week: p.week });
      toast.success(p.demo ? "Signed with the demo engineer's key" : "Signed with this laptop's key");
    });

  const signWallet = () =>
    run("wallet", async () => {
      const eth = (window as unknown as { ethereum?: EIP1193Provider }).ethereum;
      if (!eth) throw new Error("No browser wallet found. Install one (for example Rabby or MetaMask), or use the key on this laptop.");
      const wallet = createWalletClient({ transport: custom(eth) });
      const [account] = (await wallet.requestAddresses()) as Address[];
      const built = await fetch(`/api/receipt?week=${p.week}&owner=${account}`).then((r) => r.json());
      const receipt = built.receipt as SignedReceipt;
      const signature = await wallet.signTypedData({ account, ...typedDataFor(receipt) });
      await post("/api/receipt", { receipt: { ...receipt, signature } });
      toast.success("Signed with your wallet");
    });

  const send = () =>
    run("send", async () => {
      await post("/api/share", { week: p.week, hide: [...hidden] });
      toast.success(`Sent to ${org}`, { description: p.sealed ? `Your list is sealed for ${org} on Swarm. Arkiv has a read-only record of your signed totals, owned by you.` : "The record on Arkiv is read-only and owned by you." });
    });

  const download = () => {
    if (!p.savedJson) return;
    const blob = new Blob([p.savedJson], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `receipt-${p.week}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const toggle = (i: number) =>
    setHidden((h) => {
      const n = new Set(h);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });

  const reviewDone = p.signed;
  return (
    <div className="space-y-5">
      {/* 1. Review */}
      <Step n={1} title={`Review what ${org} will see`} done={reviewDone}>
        <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
          <div className="rounded-lg border border-border bg-background p-4">
            <h3 className="font-medium">{org} will see</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">Your list, the pull requests behind it, and the totals. Untick a line to keep it private; it still counts in the totals.</p>
            <ul className="mt-3 divide-y divide-border">
              {p.items.map((i) => {
                const off = hidden.has(i.index);
                return (
                  <li key={i.index} className="flex items-start gap-3 py-2">
                    <input
                      type="checkbox"
                      className="mt-1 size-4 accent-[var(--primary)]"
                      checked={!off}
                      disabled={sentOk}
                      onChange={() => toggle(i.index)}
                      aria-label={off ? `Share "${i.title}"` : `Keep "${i.title}" private`}
                    />
                    <div className={`min-w-0 flex-1 ${off ? "opacity-50" : ""}`}>
                      <div className="flex flex-wrap items-center gap-2">
                        <CategoryBadge category={i.category} />
                        {off && (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <EyeOff className="size-3" aria-hidden="true" /> kept private
                          </span>
                        )}
                      </div>
                      <div className={`mt-1 text-[15px] ${off ? "line-through" : ""}`}>{i.title}</div>
                    </div>
                    <div className="shrink-0 text-sm text-muted-foreground">{i.cost}</div>
                  </li>
                );
              })}
            </ul>
            {p.prs.length > 0 && (
              <div className="mt-3 border-t border-border pt-3">
                <div className="text-sm font-medium">Pull requests (always shared; {org} can see them on GitHub anyway)</div>
                <ul className="mt-1 space-y-0.5 text-sm">
                  {p.prs.map((pr) => (
                    <li key={pr.key}>
                      <a href={pr.url} target="_blank" rel="noreferrer" className="hover:underline">
                        {pr.title}
                      </a>{" "}
                      <span className="text-muted-foreground">{pr.state}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-background p-4">
              <h3 className="font-medium">Everyone can see</h3>
              <p className="mt-0.5 text-sm text-muted-foreground">Arkiv is public, so anyone can read and check your signed totals:</p>
              <p className="mt-2 text-[15px]">
                {p.totals.done} things done, {p.totals.spend} of AI, {p.totals.merged} merged PRs, {p.totals.sessions} sessions{p.totals.tools ? ` (${p.totals.tools})` : ""}.
              </p>
              <p className={`mt-2 text-sm ${p.sealed ? "text-muted-foreground" : "font-medium text-destructive"}`}>
                {p.sealed
                  ? `Not the list: it is encrypted on this laptop and stored on Swarm, and only ${org}'s key can open it.`
                  : `Swarm is not set up here, so your list would be public on Arkiv too. Ask whoever set up Receipts at ${org}.`}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-background p-4">
              <h3 className="flex items-center gap-1.5 font-medium">
                <Lock className="size-4" aria-hidden="true" /> Stays on this laptop
              </h3>
              <p className="mt-0.5 text-sm text-muted-foreground">Your prompts, the AI&apos;s answers, session titles and file names. Never sent to anyone.</p>
            </div>
          </div>
        </div>
      </Step>

      {/* 2. Sign */}
      <Step n={2} title="Sign it" done={p.signed}>
        {p.signed ? (
          <div className="space-y-2 text-sm">
            <p>
              Signed{p.signedAt ? ` on ${new Date(p.signedAt).toLocaleString()}` : ""} by <code>{p.signer ? `${p.signer.slice(0, 6)}…${p.signer.slice(-4)}` : "you"}</code>. Nobody,
              including {org} or us, can change the list or the numbers now.
            </p>
            <div className="flex flex-wrap gap-x-4">
              <button type="button" onClick={download} className="text-primary hover:underline">
                Download the receipt file
              </button>
              <button type="button" onClick={signLocal} disabled={!!busy} className="text-muted-foreground hover:text-foreground">
                Sign again
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <Button onClick={signLocal} disabled={!!busy}>
              {busy === "sign" ? "Signing" : p.demo ? "Sign it (demo key)" : "Sign it"}
            </Button>
            <p className="text-sm text-muted-foreground">
              {p.stale ? "Your week changed since you last signed. Sign again to update it." : "Signing locks the list and the numbers. No wallet needed: the key was made on this laptop and never leaves it."}{" "}
              <button type="button" onClick={signWallet} disabled={!!busy} className="text-primary hover:underline">
                {busy === "wallet" ? "Waiting for wallet" : "Use a wallet instead"}
              </button>
            </p>
          </div>
        )}
      </Step>

      {/* 3. Send */}
      <Step n={3} title={`Send it to ${org}`} done={sentOk}>
        {!p.company ? (
          <p className="text-sm">
            You have not joined your company yet.{" "}
            <Link href="/me/setup" className="text-primary hover:underline">
              Join it in Setup
            </Link>{" "}
            first.
          </p>
        ) : sentOk ? (
          <div className="space-y-3 text-sm">
            <p>
              Sent to {p.company.teamName} at {p.company.orgName}
              {p.sent?.publishedAt ? ` on ${new Date(p.sent.publishedAt).toLocaleString()}` : ""}.
              {p.sent?.hidden ? ` ${p.sent.hidden === 1 ? "1 line was" : `${p.sent.hidden} lines were`} kept private.` : ""}
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href={`/company/people?week=${p.week}${p.signer ? `&who=${p.signer}` : ""}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                See it as {org} sees it
              </Link>
              <Link href={`/r/${p.sent!.arkivKey}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                Open the public link
              </Link>
            </div>
            <p className="border-t border-border pt-3 text-muted-foreground">
              Want to post your week too?{" "}
              <Link href={`/card?week=${p.week}`} className="text-primary hover:underline">
                Make a card for socials
              </Link>
              . It is a picture, not this receipt: not signed, and you can edit it.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <Button onClick={send} disabled={!!busy || !p.signed || !p.arkivReady}>
              {busy === "send" ? "Sending" : `Send to ${p.company.orgName}`}
            </Button>
            <p className="text-sm text-muted-foreground">
              {!p.arkivReady
                ? `${p.company.orgName} has not turned on receipts in this copy yet (it needs the company wallet in .env.local). Ask whoever set up Receipts there.`
                : !p.signed
                  ? "Sign it first."
                  : `Goes to ${p.company.teamName} at ${p.company.orgName}. One read-only record on Arkiv, owned by you. The company wallet only pays the fee.${hidden.size ? ` ${hidden.size === 1 ? "1 line stays" : `${hidden.size} lines stay`} private.` : ""}`}
            </p>
          </div>
        )}
      </Step>
    </div>
  );
}

function Step({ n, title, done, children }: { n: number; title: string; done: boolean; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-4 sm:p-5" aria-labelledby={`step-${n}`}>
      <h2 id={`step-${n}`} className="flex items-center gap-2.5 text-lg font-semibold tracking-tight">
        <span
          className={`inline-flex size-7 items-center justify-center rounded-full border text-sm ${done ? "border-transparent bg-[var(--c-built)] text-white" : "border-primary text-primary"}`}
          aria-hidden="true"
        >
          {done ? <Check className="size-4" /> : n}
        </span>
        {title}
        {done && <span className="sr-only">(done)</span>}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}
