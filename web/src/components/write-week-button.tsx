"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Runs the private AI for one week, only when clicked. */
export function WriteWeekButton({ week, label, aiReady, variant = "default" }: { week: string; label: string; aiReady: boolean; variant?: "default" | "outline" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [, start] = useTransition();
  async function write() {
    setBusy(true);
    const t = toast.loading(aiReady ? "The private AI on 0G is reading this week's sessions. Only a trimmed summary of each one goes to 0G, where the model runs in a TEE." : "Writing your week with simple rules");
    try {
      const r = await fetch("/api/week", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ week }) });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error);
      if (j.warning) toast.warning(j.warning, { id: t, duration: 8000 });
      else
        toast.success(
          `Done: ${j.items} things. ${j.judged ? `${j.judged} sessions and ` : ""}1 weekly call on 0G${j.verified ? ", all TEE verified" : ""}.${j.failed ? ` ${j.failed} sessions fell back to rules.` : ""}`,
          { id: t, duration: 6000 },
        );
      start(() => router.refresh());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e), { id: t });
    } finally {
      setBusy(false);
    }
  }
  return (
    <Button variant={variant} size="lg" onClick={write} disabled={busy}>
      <Sparkles className="size-4" aria-hidden="true" />
      {busy ? "Writing your week" : label}
    </Button>
  );
}
