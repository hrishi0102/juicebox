import { Check } from "lucide-react";

/** One item of a setup checklist: a number (or a tick when done), a title and what to do. */
export function SetupRow({ n, title, done, children }: { n: number; title: string; done: boolean; children: React.ReactNode }) {
  return (
    <li className="grid grid-cols-[2rem_1fr] gap-x-3 rounded-xl border border-border bg-card p-4 sm:p-5">
      <span
        className={`mt-0.5 inline-flex size-7 items-center justify-center rounded-full border text-sm font-semibold ${done ? "border-transparent bg-[var(--c-built)] text-white" : "border-primary text-primary"}`}
        aria-hidden="true"
      >
        {done ? <Check className="size-4" /> : n}
      </span>
      <div className="min-w-0">
        <h2 className="text-lg font-semibold tracking-tight">
          {title}
          <span className="sr-only">{done ? " (done)" : " (to do)"}</span>
        </h2>
        <div className="mt-1.5 space-y-3 text-[15px]">{children}</div>
      </div>
    </li>
  );
}
