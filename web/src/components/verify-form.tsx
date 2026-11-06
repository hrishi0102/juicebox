"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type Result = {
  ok: boolean;
  error?: string;
  checks?: { name: string; ok: boolean; detail?: string }[];
  signer?: string;
  headline?: string;
  period?: string;
  judge?: string;
  arkiv?: { key: string; owner?: string; creator?: string; readonly?: boolean };
  evidence?: number;
  judges?: number;
};

export function VerifyForm() {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<Result | null>(null);

  async function verify() {
    setBusy(true);
    setRes(null);
    try {
      const text = input.trim();
      let body: Record<string, unknown>;
      if (text.startsWith("{")) body = { receipt: JSON.parse(text) };
      else if (/^0x[0-9a-fA-F]{64}$/.test(text)) body = { entityKey: text };
      else throw new Error("Paste a receipt JSON file, or an Arkiv entity key (0x followed by 64 hex characters).");
      const r = await fetch("/api/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      setRes(await r.json());
    } catch (e) {
      setRes({ ok: false, error: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <label className="block text-sm font-medium" htmlFor="receipt-input">
        Receipt JSON or Arkiv entity key
      </label>
      <textarea
        id="receipt-input"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        rows={8}
        spellCheck={false}
        placeholder='{"kind":"receipts.v1", ...}  or  0x3f9a...'
        className="w-full rounded-lg border border-input bg-card p-3 font-mono text-xs"
      />
      <Button onClick={verify} disabled={busy || !input.trim()}>
        {busy ? "Checking" : "Check receipt"}
      </Button>

      {res && (
        <div className={`rounded-lg border p-5 ${res.ok ? "border-[var(--l-shipped)]/50" : "border-destructive/50"} bg-card`} role="status">
          <div className="text-lg font-semibold">{res.ok ? "This receipt checks out." : res.error ? "Could not check this receipt." : "This receipt does not check out."}</div>
          {res.error && <p className="mt-1 text-muted-foreground">{res.error}</p>}
          {res.headline && (
            <p className="mt-2">
              {res.period}: {res.headline}
            </p>
          )}
          {res.checks && (
            <ul className="mt-3 space-y-1 text-sm">
              {res.checks.map((c) => (
                <li key={c.name} className="flex gap-2">
                  <span className={c.ok ? "text-[var(--l-shipped)]" : "text-destructive"} aria-hidden="true">
                    {c.ok ? "✓" : "✗"}
                  </span>
                  <span>
                    {c.name}
                    {c.detail && <span className="text-muted-foreground"> ({c.detail})</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {res.judge && <p className="mt-3 text-sm text-muted-foreground">Judge: {res.judge}</p>}
          {res.arkiv && (
            <p className="mt-1 break-all text-sm text-muted-foreground">
              Loaded from Arkiv entity {res.arkiv.key}. Owned by {res.arkiv.owner}
              {res.arkiv.owner && res.signer && res.arkiv.owner.toLowerCase() === res.signer.toLowerCase() ? " (the person who signed it)" : ""}
              {res.arkiv.creator && res.arkiv.creator.toLowerCase() !== res.arkiv.owner?.toLowerCase() ? `, written by ${res.arkiv.creator} (which only paid the fee)` : ""}
              {res.arkiv.readonly ? ". Read-only: nobody can change it." : "."}
            </p>
          )}
          {res.evidence !== undefined && (
            <p className="mt-1 text-sm text-muted-foreground">
              {res.evidence} evidence items and {res.judges} judge records included.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
