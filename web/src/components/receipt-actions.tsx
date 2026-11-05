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

  const share = (level: "totals" | "full") =>
    run(`share-${level}`, async () => {
      const r = await fetch("/api/share", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ week: p.week, level }) });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error);
      toast.success(level === "full" ? "Shared with evidence on Arkiv" : "Shared totals on Arkiv", { description: `Entity ${String(j.entityKey).slice(0, 14)}…` });
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
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {p.canSignLocally && (
          <Button onClick={signLocal} disabled={!!busy}>
            {busy === "sign" ? "Signing" : p.signed ? "Sign again" : p.source === "demo" ? "Sign as demo user" : "Sign receipt"}
          </Button>
        )}
        <Button variant={p.canSignLocally ? "outline" : "default"} onClick={signWallet} disabled={!!busy}>
          {busy === "wallet" ? "Waiting for wallet" : "Sign with wallet"}
        </Button>
        {p.signed && (
          <Button variant="outline" onClick={download}>
            Download JSON
          </Button>
        )}
      </div>
      {p.stale && <p className="text-sm text-muted-foreground">The numbers changed since you signed this week (a rescan or new labels). Sign again to update the receipt.</p>}
      {p.signed && (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={() => share("totals")} disabled={!!busy || !p.arkivReady}>
            {busy === "share-totals" ? "Publishing" : "Share totals with team"}
          </Button>
          <Button variant="secondary" onClick={() => share("full")} disabled={!!busy || !p.arkivReady}>
            {busy === "share-full" ? "Publishing" : "Share with evidence"}
          </Button>
          {!p.arkivReady && <span className="text-xs text-muted-foreground">Sharing needs ARKIV_PRIVATE_KEY (Rabdi testnet) in .env.local</span>}
        </div>
      )}
      {p.shared?.arkivKey && (
        <p className="text-xs text-muted-foreground">
          Shared on Arkiv ({p.shared.level === "full" ? "with evidence" : "totals only"}).{" "}
          <a className="text-primary hover:underline" href={`/r/${p.shared.arkivKey}`}>
            Link to this receipt
          </a>
        </p>
      )}
    </div>
  );
}
