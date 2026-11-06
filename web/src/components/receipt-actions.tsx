"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createWalletClient, custom, type Address, type EIP1193Provider } from "viem";
import { Button } from "@/components/ui/button";
import { typedDataFor, type SignedReceipt } from "@/lib/receipts/receipt";

type Props = {
  week: string;
  source: "local" | "demo";
  signed: boolean;
  stale?: boolean;
  shared?: { level: string; arkivKey?: string } | null;
  canSignLocally: boolean;
  arkivReady: boolean;
  savedJson?: string;
};

export function ReceiptActions(p: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [, start] = useTransition();

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

  const signLocal = () =>
    run("sign", async () => {
      const r = await fetch("/api/receipt/sign-local", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ week: p.week }) });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error);
      toast.success(p.source === "demo" ? "Signed with the demo key" : "Receipt signed");
    });

  const signWallet = () =>
    run("wallet", async () => {
      const eth = (window as unknown as { ethereum?: EIP1193Provider }).ethereum;
      if (!eth) throw new Error("No browser wallet found. Install one (for example Rabby or MetaMask), or use the local key.");
      const wallet = createWalletClient({ transport: custom(eth) });
      const [account] = (await wallet.requestAddresses()) as Address[];
      const built = await fetch(`/api/receipt?week=${p.week}&owner=${account}`).then((r) => r.json());
      const receipt = built.receipt as SignedReceipt;
      const signature = await wallet.signTypedData({ account, ...typedDataFor(receipt) });
      const saved = await fetch("/api/receipt", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ receipt: { ...receipt, signature } }) }).then((r) => r.json());
      if (!saved.ok) throw new Error(saved.error);
      toast.success("Receipt signed with your wallet");
    });

  const share = () =>
    run("share", async () => {
      const r = await fetch("/api/share", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ week: p.week }) });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error);
      toast.success("Shared with your team", { description: "Receipt and PR list are on Arkiv." });
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

  // One step at a time: sign first, then share. Everything else is a small link.
  return (
    <div className="space-y-3">
      {!p.signed ? (
        <>
          <div className="flex flex-wrap gap-2">
            {p.canSignLocally ? (
              <Button onClick={signLocal} disabled={!!busy}>
                {busy === "sign" ? "Signing" : p.source === "demo" ? "Sign this receipt (demo key)" : "Sign this receipt"}
              </Button>
            ) : null}
            <Button variant={p.canSignLocally ? "outline" : "default"} onClick={signWallet} disabled={!!busy}>
              {busy === "wallet" ? "Waiting for wallet" : "Sign with my wallet"}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            {p.stale ? "Your numbers changed since you last signed. Sign again to update it." : "Signing locks the numbers so nobody can change them later."}
          </p>
        </>
      ) : !p.shared?.arkivKey ? (
        <>
          <Button onClick={share} disabled={!!busy || !p.arkivReady}>
            {busy === "share" ? "Sharing" : "Share with my team"}
          </Button>
          <p className="text-sm text-muted-foreground">
            {p.arkivReady ? "Your team sees the totals and the PR list. Never your prompts." : "Sharing is not set up yet (needs an Arkiv key in .env.local)."}
          </p>
        </>
      ) : (
        <p className="text-sm">
          Signed and shared with your team.{" "}
          <a className="text-primary hover:underline" href={`/r/${p.shared.arkivKey}`}>
            Open the shared receipt
          </a>
        </p>
      )}
      {p.signed && (
        <div className="flex flex-wrap gap-x-4 text-sm">
          <button type="button" onClick={download} className="text-primary hover:underline">
            Download receipt
          </button>
          <button type="button" onClick={p.canSignLocally ? signLocal : signWallet} disabled={!!busy} className="text-muted-foreground hover:text-foreground">
            Sign again
          </button>
        </div>
      )}
    </div>
  );
}
