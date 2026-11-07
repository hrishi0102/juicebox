"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
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
    <div>
      <div className="pnl mt-7 p-[22px]">
        <label className="mb-2 block text-[15px] font-semibold" htmlFor="receipt-input">
          Receipt JSON or Arkiv entity key
        </label>
        <textarea
          id="receipt-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={8}
          spellCheck={false}
          placeholder='{"kind":"receipts.v1", ...}  or  0x3f9a...'
          className="ta"
        />
        <div className="mt-[18px] flex flex-wrap items-center gap-5">
          <Button size="lg" onClick={verify} disabled={busy || !input.trim()}>
            {busy ? "Checking" : "Check receipt"}
          </Button>
          {busy && <span className="spin" aria-hidden="true" />}
        </div>
      </div>

      {res && (
        <div className="pnl ticks mt-5" role="status">
          <div className="flex items-start gap-3.5 px-[22px] py-5">
            <span className={`ck ck-lg ${res.ok ? "ck-done" : "ck-bad"}`} aria-hidden="true">
              {res.ok ? <Check className="size-4" strokeWidth={3} /> : <X className="size-4" strokeWidth={3} />}
            </span>
            <div className="min-w-0">
              <div className="text-[21px] font-[620] leading-tight [font-stretch:110%]">{res.ok ? "This receipt checks out." : res.error ? "Could not check this receipt." : "This receipt does not check out."}</div>
              {res.error && <p className="mt-1 text-[var(--ink-2)]">{res.error}</p>}
              {res.headline && (
                <p className="mt-1 text-[var(--mute)]">
                  {res.period}: {res.headline}
                </p>
              )}
            </div>
          </div>
          {res.checks && (
            <ol>
              {res.checks.map((c) => (
                <li key={c.name} className="check-row">
                  <span className={`ck ${c.ok ? "ck-done" : "ck-bad"}`} aria-hidden="true">
                    {c.ok ? <Check className="size-[13px]" strokeWidth={3} /> : <X className="size-[13px]" strokeWidth={3} />}
                  </span>
                  <span>
                    <span className="sr-only">{c.ok ? "Passed" : "Failed"}: </span>
                    {c.name}
                    {c.detail && <span className="d">{c.detail}</span>}
                  </span>
                </li>
              ))}
            </ol>
          )}
          {(res.judge || res.arkiv || res.evidence !== undefined) && (
            <div className="space-y-1 border-t border-[var(--line)] px-[22px] py-4 text-sm text-[var(--ink-2)]">
              {res.judge && <p>Judge: {res.judge}</p>}
              {res.arkiv && (
                <p className="break-all">
                  Loaded from Arkiv entity {res.arkiv.key}. Owned by {res.arkiv.owner}
                  {res.arkiv.owner && res.signer && res.arkiv.owner.toLowerCase() === res.signer.toLowerCase() ? " (the person who signed it)" : ""}
                  {res.arkiv.creator && res.arkiv.creator.toLowerCase() !== res.arkiv.owner?.toLowerCase() ? `, written by ${res.arkiv.creator} (which only paid the fee)` : ""}
                  {res.arkiv.readonly ? ". Read-only: nobody can change it." : "."}
                </p>
              )}
              {res.evidence !== undefined && (
                <p>
                  {res.evidence} evidence items and {res.judges} judge records included.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
