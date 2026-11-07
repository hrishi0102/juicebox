import Link from "next/link";
import { Check } from "lucide-react";
import type { StepState } from "@/lib/receipts/flow";

export type FlowStep = { label: string; state?: StepState; href?: string };

/** "1 Write, 2 Sign, 3 Send", with the done steps ticked and the next one ringed (violet for Sign). */
export function FlowSteps({ steps, label = "Steps" }: { steps: FlowStep[]; label?: string }) {
  return (
    <ol className="wsteps" aria-label={label}>
      {steps.map((s, i) => {
        const state = s.state ?? "todo";
        const cls = `wstep ${state === "done" ? "is-done" : state === "current" ? "is-current" : ""} ${s.label === "Sign" ? "is-sign" : ""}`;
        const body = (
          <>
            <span className="wstep-n" aria-hidden="true">
              {state === "done" ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
            </span>
            <span>
              {s.label}
              <span className="sr-only">{state === "done" ? ", done" : state === "current" ? ", next" : ""}</span>
            </span>
          </>
        );
        return (
          <li key={s.label} className={cls} aria-current={state === "current" ? "step" : undefined}>
            {i > 0 && <span className="wstep-gap" aria-hidden="true" />}
            {s.href ? <Link href={s.href}>{body}</Link> : body}
          </li>
        );
      })}
    </ol>
  );
}
