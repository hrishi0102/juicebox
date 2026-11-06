import { CATEGORY_COPY } from "@/lib/format";
import { CATEGORIES, type Category } from "@/lib/receipts/types";

export function CategoryBadge({ category, className = "" }: { category: Category; className?: string }) {
  const c = CATEGORY_COPY[category];
  return (
    <span title={c.hint} className={`cat ${className}`}>
      <span className="sq" style={{ background: `var(${c.varName})` }} aria-hidden="true" />
      {c.name}
    </span>
  );
}

/** Where the money went, by category, as one thin bar. */
export function CategoryBar({ spend, total }: { spend: Record<Category, number>; total: number }) {
  if (total <= 0) return null;
  return (
    <div className="catbar" role="img" aria-label="Spend by category">
      {CATEGORIES.filter((c) => spend[c] > 0).map((c) => (
        <span key={c} title={`${c}: ${Math.round((spend[c] / total) * 100)}%`} style={{ width: `${(spend[c] / total) * 100}%`, background: `var(${CATEGORY_COPY[c].varName})` }} />
      ))}
    </div>
  );
}

export function CategoryLegend() {
  return (
    <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
      {CATEGORIES.map((c) => (
        <div key={c} className="flex items-start gap-3 text-[15px]">
          <dt className="w-[118px] shrink-0">
            <CategoryBadge category={c} />
          </dt>
          <dd className="text-[var(--mute)]">{CATEGORY_COPY[c].hint}.</dd>
        </div>
      ))}
    </dl>
  );
}
