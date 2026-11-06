import Link from "next/link";
import { Check } from "lucide-react";
import type { StepState } from "@/lib/receipts/flow";

export type FlowStep = { label: string; state?: StepState; href?: string };

/** "1 Write · 2 Review · 3 Sign · 4 Send", with the done steps ticked and the next one ringed. */
export function FlowSteps({ steps, label = "Steps" }: { steps: FlowStep[]; label?: string }) {
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-2 text-sm" aria-label={label}>
      {steps.map((s, i) => {
        const state = s.state ?? "todo";
        const dot =
          state === "done"
            ? "border-transparent bg-[var(--c-built)] text-white"
            : state === "current"
              ? "border-primary text-primary ring-2 ring-primary/20"
              : "border-border text-muted-foreground";
        const body = (
          <>
            <span className={`inline-flex size-6 items-center justify-center rounded-full border text-xs font-semibold ${dot}`} aria-hidden="true">
              {state === "done" ? <Check className="size-3.5" /> : i + 1}
            </span>
            <span className={state === "todo" ? "text-muted-foreground" : "font-medium"}>
              {s.label}
              <span className="sr-only">{state === "done" ? " (done)" : state === "current" ? " (next)" : ""}</span>
            </span>
          </>
        );
        return (
          <li key={s.label} className="flex items-center gap-2">
            {s.href ? (
              <Link href={s.href} className="flex items-center gap-2 hover:underline">
                {body}
              </Link>
            ) : (
              <span className="flex items-center gap-2">{body}</span>
            )}
            {i < steps.length - 1 && <span className="mx-1 hidden h-px w-6 bg-border sm:block" aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
  );
}
