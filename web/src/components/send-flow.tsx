"use client";

// Sign, then send: the employee's whole week goes to the company, exactly as the AI wrote it.
// Nothing can be picked out or edited, so the receipt stays evidence.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createWalletClient, custom, type Address, type EIP1193Provider } from "viem";
import { Building2, Check, Eye, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
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
    <div className="space-y-12">
      <section className="mw-next" aria-label="Sign and send">
        <ol className="space-y-6">
          <Step n={1} title="Sign it" done={p.signed} sign>
            {p.signed ? (
              <div className="space-y-2">
                <p>
                  Signed{p.signedAt ? ` on ${p.signedAt}` : ""} by <span className="mono">{p.signer ? `${p.signer.slice(0, 6)}…${p.signer.slice(-4)}` : "you"}</span>. Nobody,
                  including {org} or us, can change the list or the numbers now.
                </p>
                <div className="flex flex-wrap gap-x-5 gap-y-1 text-[15px]">
                  <button type="button" onClick={download} className="quiet">
                    Download the receipt file
                  </button>
                  {!sentOk && (
                    <button type="button" onClick={signLocal} disabled={!!busy} className="quiet text-[var(--mute)]!">
                      Sign again
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <Button onClick={signLocal} disabled={!!busy} className="btn-sign h-11 px-[18px]">
                  {busy === "sign" ? "Signing" : p.demo ? "Sign it (demo key)" : "Sign it"}
                </Button>
                <p className="help">
                  {p.stale ? "Your week changed since you last signed. Sign again to update it." : "Signing locks every line and every number. No wallet needed: the key was made on this laptop and never leaves it."}{" "}
                  <button type="button" onClick={signWallet} disabled={!!busy} className="quiet">
                    {busy === "wallet" ? "Waiting for wallet" : "Use a wallet instead"}
                  </button>
                </p>
              </div>
            )}
          </Step>

          <Step n={2} title={`Send it to ${org}`} done={sentOk}>
            {!p.company ? (
              <p>
                You have not joined your company yet.{" "}
                <Link href="/me/setup" className="quiet">
                  Join it in Setup
                </Link>{" "}
                first.
              </p>
            ) : sentOk ? (
              <div>
                <p className="done-t">
                  Sent to {p.company.teamName} at {p.company.orgName}
                  {p.sent?.publishedAt ? ` on ${p.sent.publishedAt}` : ""}.
                </p>
                <div className="done-links">
                  <Link href={`/company/people?week=${p.week}${p.signer ? `&who=${p.signer}` : ""}`} className="plink">
                    See it as {org} sees it
                  </Link>
                  <Link href={`/r/${p.sent!.arkivKey}`} className="plink">
                    What anyone sees
                  </Link>
                </div>
              </div>
            ) : (
              <div>
                <Button size="lg" onClick={send} disabled={!!busy || !p.signed || !p.arkivReady}>
                  {busy === "send" ? "Sending" : `Send to ${p.company.orgName}`}
                </Button>
                <p className="help">
                  {!p.arkivReady
                    ? `${p.company.orgName} has not turned on receipts in this copy yet (it needs the company wallet in .env.local). Ask whoever set up Juicebox there.`
                    : !p.signed
                      ? "Sign it first."
                      : `Goes to ${p.company.teamName} at ${p.company.orgName}: one read-only record on Arkiv, owned by you. The company wallet only pays the fee.`}
                </p>
              </div>
            )}
          </Step>
        </ol>

        <ul className="gets">
          <li>
            <Building2 className="size-4" aria-hidden="true" />
            <span>
              <b>{org} gets</b> the whole receipt: every line, the pull requests and the totals.
              {p.sealed ? ` The list is encrypted on this laptop and stored on Swarm, and only ${org}'s key opens it.` : ""}
            </span>
          </li>
          <li>
            <Eye className="size-4" aria-hidden="true" />
            <span>
              <b>Anyone can check</b> the signed totals on Arkiv: {p.totals.done} things done, {p.totals.spend} of AI, {p.totals.merged} shipped changes (merged PRs and pushes to main).
            </span>
          </li>
          <li>
            <Lock className="size-4" aria-hidden="true" />
            <span>
              <b>Stays on this laptop:</b> your prompts, the AI&apos;s answers, session titles and file names.
            </span>
          </li>
        </ul>
      </section>

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
    </div>
  );
}

function Step({ n, title, done, sign, children }: { n: number; title: string; done: boolean; sign?: boolean; children: React.ReactNode }) {
  return (
    <li className="grid grid-cols-[30px_minmax(0,1fr)] gap-3" aria-labelledby={`step-${n}`}>
      <span className={`ok-dot ${done ? (sign ? "is-sign" : "") : "border-[1.5px] bg-[var(--paper)]! text-[var(--ink)]!"}`} style={done ? undefined : { borderColor: sign ? "var(--stamp)" : "var(--ink)", color: sign ? "var(--stamp)" : undefined }} aria-hidden="true">
        {done ? <Check className="size-4" strokeWidth={2.6} /> : <span className="text-[13px] font-semibold">{n}</span>}
      </span>
      <div className="min-w-0 text-[16px]">
        <h2 id={`step-${n}`} className="h-small mb-2 mt-0.5">
          {title}
          {done && <span className="sr-only"> (done)</span>}
        </h2>
        {children}
      </div>
    </li>
  );
}
