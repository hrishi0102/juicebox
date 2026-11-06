"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function ScanButton({ label = "Scan my logs", variant = "default" }: { label?: string; variant?: "default" | "outline" | "secondary" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [, start] = useTransition();
  async function scan() {
    setBusy(true);
    const t = toast.loading("Reading ~/.claude/projects and matching sessions to GitHub. This can take a minute.");
    try {
      const r = await fetch("/api/scan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ days: 30 }) });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error);
      toast.success(`Scanned ${j.sessions} sessions, linked ${j.links} to ${j.changes} pull requests or commits`, { id: t });
      start(() => router.refresh());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e), { id: t });
    } finally {
      setBusy(false);
    }
  }
  return (
    <Button variant={variant} onClick={scan} disabled={busy}>
      {busy ? "Scanning" : label}
    </Button>
  );
}
