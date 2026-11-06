"use client";

// Join your company: pick which of your GitHub orgs and teams your receipts go to.
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export type JoinOption = { org: string; team: string; teamName: string };

export function JoinCompany({ options, current }: { options: JoinOption[]; current?: string }) {
  const router = useRouter();
  const [pick, setPick] = useState(current && options.some((o) => o.team === current) ? current : options[0]?.team);
  const [busy, setBusy] = useState(false);
  const [, start] = useTransition();
  if (!options.length) return null;

  async function save() {
    const o = options.find((x) => x.team === pick);
    if (!o) return;
    setBusy(true);
    try {
      const r = await fetch("/api/join", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ org: o.org, team: o.team, teamName: o.teamName }) });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error);
      toast.success(`Joined ${o.teamName} at ${o.org}`);
      start(() => router.refresh());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <fieldset className="space-y-1.5">
        <legend className="sr-only">Your company and team</legend>
        {options.map((o) => (
          <label key={o.team} className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border bg-background px-3 py-2 has-[:checked]:border-primary">
            <input type="radio" name="team" value={o.team} checked={pick === o.team} onChange={() => setPick(o.team)} className="accent-[var(--primary)]" />
            <span>
              <span className="font-medium">{o.teamName}</span> at {o.org}
            </span>
          </label>
        ))}
      </fieldset>
      <Button onClick={save} disabled={busy || !pick || pick === current}>
        {busy ? "Saving" : pick === current ? "Joined" : "Join this team"}
      </Button>
    </div>
  );
}
