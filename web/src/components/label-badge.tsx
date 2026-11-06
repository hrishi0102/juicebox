import { LABEL_COPY } from "@/lib/format";
import type { SessionLabel } from "@/lib/receipts/types";

export function LabelBadge({ label, className = "" }: { label: SessionLabel; className?: string }) {
  const c = LABEL_COPY[label];
  return (
    <span
      title={c.hint}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${className}`}
      style={{
        color: `var(${c.varName})`,
        borderColor: `color-mix(in oklab, var(${c.varName}) 35%, transparent)`,
        background: `color-mix(in oklab, var(${c.varName}) 9%, transparent)`,
      }}
    >
      <span className="size-1.5 rounded-full" style={{ background: `var(${c.varName})` }} aria-hidden="true" />
      {c.name}
    </span>
  );
}

export function Difficulty({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" title={`Difficulty ${value} of 5`} aria-label={`Difficulty ${value} of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={`h-2.5 w-1.5 rounded-[2px] ${i <= value ? "bg-[var(--ink-2)]" : "bg-[var(--line)]"}`} />
      ))}
    </span>
  );
}

export function SpendBar({ parts, total }: { parts: { label: SessionLabel; value: number }[]; total: number }) {
  return (
    <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label="Spend by outcome">
      {parts
        .filter((p) => p.value > 0)
        .map((p) => (
          <div
            key={p.label}
            title={`${LABEL_COPY[p.label].name}: ${Math.round((p.value / total) * 100)}%`}
            style={{ width: `${(p.value / total) * 100}%`, background: `var(${LABEL_COPY[p.label].varName})` }}
          />
        ))}
    </div>
  );
}
