import { CATEGORY_COPY } from "@/lib/format";
import { CATEGORIES, type Category } from "@/lib/receipts/types";

export function CategoryBadge({ category, className = "" }: { category: Category; className?: string }) {
  const c = CATEGORY_COPY[category];
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

/** Where the money went, by category, as one thin bar. */
export function CategoryBar({ spend, total }: { spend: Record<Category, number>; total: number }) {
  if (total <= 0) return null;
  return (
    <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label="Spend by category">
      {CATEGORIES.filter((c) => spend[c] > 0).map((c) => (
        <div key={c} title={`${c}: ${Math.round((spend[c] / total) * 100)}%`} style={{ width: `${(spend[c] / total) * 100}%`, background: `var(${CATEGORY_COPY[c].varName})` }} />
      ))}
    </div>
  );
}

export function CategoryLegend() {
  return (
    <dl className="grid gap-2 sm:grid-cols-2">
      {CATEGORIES.map((c) => (
        <div key={c} className="flex items-start gap-3 text-sm">
          <dt className="w-28 shrink-0">
            <CategoryBadge category={c} />
          </dt>
          <dd className="text-muted-foreground">{CATEGORY_COPY[c].hint}.</dd>
        </div>
      ))}
    </dl>
  );
}
