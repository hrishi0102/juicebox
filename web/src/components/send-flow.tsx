"use client";

// Sign, then send: the employee's whole week goes to the company, exactly as the AI wrote it.
// Nothing can be picked out or edited, so the receipt stays evidence.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createWalletClient, custom, type Address, type EIP1193Provider } from "viem";
import { Check, Lock } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { ProofLinks } from "@/components/proof-links";
import { arkivEntityUrl, arkivTxUrl, swarmProofPath } from "@/lib/proof-urls";
import { typedDataFor, type SignedReceipt } from "@/lib/receipts/receipt";

export type SendFlowProps = {
  week: string;
  demo: boolean;
  company: { org: string; orgName: string; teamName: string } | null;
  totals: { done: number; spend: string; merged: number };
  signed: boolean;
  stale: boolean;
  signer?: string;
  /** Already formatted on the server, so the page renders the same text on both sides. */
  signedAt?: string;
  sent: { arkivKey?: string; arkivTx?: string; swarm?: string; publishedAt?: string } | null;
  arkivReady: boolean;
  sealed: boolean;
  savedJson?: string;
};

export function SendFlow(p: SendFlowProps) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
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
      await post("/api/share", { week: p.week });
      toast.success(`Sent to ${org}`, { description: "One read-only record on Arkiv, owned by you. The list is sealed for the company on Swarm." });
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

  return (
    <div className="space-y-4">
      <Step n={1} title="Sign it" done={p.signed}>
        {p.signed ? (
          <div className="space-y-2 text-sm">
            <p>
              Signed{p.signedAt ? ` on ${p.signedAt}` : ""} by <code>{p.signer ? `${p.signer.slice(0, 6)}…${p.signer.slice(-4)}` : "you"}</code>. Nobody,
              including {org} or us, can change the list or the numbers now.
            </p>
            <div className="flex flex-wrap gap-x-4">
              <button type="button" onClick={download} className="text-primary hover:underline">
                Download the receipt file
              </button>
              {!sentOk && (
                <button type="button" onClick={signLocal} disabled={!!busy} className="text-muted-foreground hover:text-foreground">
                  Sign again
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <Button size="lg" onClick={signLocal} disabled={!!busy}>
              {busy === "sign" ? "Signing" : p.demo ? "Sign it (demo key)" : "Sign it"}
            </Button>
            <p className="text-sm text-muted-foreground">
              {p.stale ? "Your week changed since you last signed. Sign again to update it." : "Signing locks every line and every number. No wallet needed: the key was made on this laptop and never leaves it."}{" "}
              <button type="button" onClick={signWallet} disabled={!!busy} className="text-primary hover:underline">
                {busy === "wallet" ? "Waiting for wallet" : "Use a wallet instead"}
              </button>
            </p>
          </div>
        )}
      </Step>

      <Step n={2} title={`Send it to ${org}`} done={sentOk}>
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
              {p.sent?.publishedAt ? ` on ${p.sent.publishedAt}` : ""}.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link href={`/company/people?week=${p.week}${p.signer ? `&who=${p.signer}` : ""}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                See it as {org} sees it
              </Link>
              <Link href={`/r/${p.sent!.arkivKey}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                What anyone sees
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <Button size="lg" onClick={send} disabled={!!busy || !p.signed || !p.arkivReady}>
              {busy === "send" ? "Sending" : `Send to ${p.company.orgName}`}
            </Button>
            <p className="text-sm text-muted-foreground">
              {!p.arkivReady
                ? `${p.company.orgName} has not turned on receipts in this copy yet (it needs the company wallet in .env.local). Ask whoever set up Receipts there.`
                : !p.signed
                  ? "Sign it first."
                  : `Goes to ${p.company.teamName} at ${p.company.orgName}: one read-only record on Arkiv, owned by you. The company wallet only pays the fee.`}
            </p>
          </div>
        )}
      </Step>

      {sentOk && p.sent && (
        <ProofLinks
          groups={[
            {
              service: "Arkiv",
              what: "The record: read-only, owned by you, with the signed totals",
              links: [
                { label: "The record on the Arkiv explorer", href: arkivEntityUrl(p.sent.arkivKey!) },
                ...(p.sent.arkivTx ? [{ label: "The transaction that wrote it", href: arkivTxUrl(p.sent.arkivTx) }] : []),
              ],
            },
            {
              service: "Swarm",
              what: "Your full week, encrypted on this laptop before it left",
              links: p.sent.swarm ? [{ label: "Fetch it from Swarm now", href: swarmProofPath(p.sent.swarm, p.sent.arkivKey) }] : [],
            },
          ]}
        />
      )}

      <ul className="space-y-1.5 rounded-xl border border-border p-4 text-sm text-muted-foreground">
        <li>
          <span className="font-medium text-foreground">{org} gets</span> the whole receipt: every line, the pull requests and the totals.
          {p.sealed ? ` The list is encrypted on this laptop and stored on Swarm, and only ${org}'s key opens it.` : ""}
        </li>
        <li>
          <span className="font-medium text-foreground">Anyone can check</span> the signed totals on Arkiv: {p.totals.done} things done, {p.totals.spend} of AI, {p.totals.merged} shipped changes (merged PRs and pushes to main).
        </li>
        <li className="inline-flex items-start gap-1.5">
          <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>
            <span className="font-medium text-foreground">Stays on this laptop:</span> your prompts, the AI&apos;s answers, session titles and file names.
          </span>
        </li>
      </ul>
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
      <div className="mt-3">{children}</div>
    </section>
  );
}
