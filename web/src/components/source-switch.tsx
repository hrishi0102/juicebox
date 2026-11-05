"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function SourceSwitch({ source, hasLocal }: { source: "local" | "demo"; hasLocal: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const set = (s: "local" | "demo") =>
    start(async () => {
      await fetch("/api/source", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source: s }) });
      router.refresh();
    });
  return (
    <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-0.5 text-sm" role="group" aria-label="Data source">
      <button
        type="button"
        onClick={() => set("local")}
        disabled={pending}
        aria-pressed={source === "local"}
        title={hasLocal ? "Your own Claude Code logs" : "Run a scan first (Scan my logs on the home page)"}
        className={`rounded-md px-2.5 py-1 transition-colors ${source === "local" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
      >
        My logs
      </button>
      <button
        type="button"
        onClick={() => set("demo")}
        disabled={pending}
        aria-pressed={source === "demo"}
        className={`rounded-md px-2.5 py-1 transition-colors ${source === "demo" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
      >
        Demo team
      </button>
    </div>
  );
}

export function UseDemoButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await fetch("/api/source", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source: "demo" }) });
          router.refresh();
        })
      }
      className="inline-flex h-8 items-center rounded-lg border border-border bg-background px-2.5 text-sm font-medium hover:bg-muted"
    >
      Look at the demo team
    </button>
  );
}
