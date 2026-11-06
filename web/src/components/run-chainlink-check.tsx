"use client";

// "Run the check now": asks this laptop's server to run the Chainlink CRE workflow with Chainlink's
// CLI (the same simulation as in cre/README.md), which posts a new score to Sepolia. Then the card
// reloads with it. On the Chainlink network a monthly cron runs the same workflow.

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { sepoliaTxUrl } from "@/lib/proof-urls";

const STEPS = [
  "Compiling the workflow to WASM",
  "Reading the team's receipts from Arkiv",
  "Checking every signature",
  "Asking GitHub about merged PRs and pushes to main",
  "Writing the score to Sepolia",
  "Waiting for Sepolia to confirm",
];

export function RunChainlinkCheck() {
  const router = useRouter();
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [, start] = useTransition();

  useEffect(() => {
    if (startedAt === null) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [startedAt]);

  const seconds = startedAt === null ? 0 : Math.max(0, Math.floor((now - startedAt) / 1000));
  // Roughly where a run is: compile and checks take a few seconds, the Sepolia write the rest.
  const step = STEPS[Math.min(STEPS.length - 1, seconds < 3 ? 0 : seconds < 5 ? 1 + Math.floor((seconds - 3) / 1) : seconds < 8 ? 3 : seconds < 12 ? 4 : 5)];

  async function run() {
    setStartedAt(Date.now());
    setNow(Date.now());
    try {
      const r = await fetch("/api/cre/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const j = (await r.json()) as { ok: boolean; txHash?: string; error?: string };
      if (!j.ok) throw new Error(j.error ?? "The check did not run.");
      toast.success("Chainlink posted a new score to Sepolia", {
        description: j.txHash ? `Transaction ${j.txHash.slice(0, 10)}…${j.txHash.slice(-4)}` : undefined,
        action: j.txHash ? { label: "Etherscan", onClick: () => window.open(sepoliaTxUrl(j.txHash!), "_blank", "noopener") } : undefined,
      });
      start(() => router.refresh());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setStartedAt(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button onClick={run} disabled={startedAt !== null}>
        {startedAt !== null ? "Running on Chainlink CRE" : "Run the check now"}
      </Button>
      <span className="text-sm text-muted-foreground" aria-live="polite">
        {startedAt !== null ? `${step}… ${seconds} s` : "Runs the workflow with Chainlink's CLI on this laptop and posts a new score. Takes about 20 seconds."}
      </span>
    </div>
  );
}
