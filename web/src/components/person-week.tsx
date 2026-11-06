import Link from "next/link";
import { BadgeCheck, TriangleAlert } from "lucide-react";
import { Collapsible } from "@/components/collapsible";
import { PrTable } from "@/components/pr-table";
import { WeekList } from "@/components/week-list";
import { plural, usd } from "@/lib/format";
import { receiptItems, signedNumbers, type SignedReceipt } from "@/lib/receipts/receipt";

/** One person's shared week, as the company sees it: their signed list, PRs and totals. */
export function PersonWeek({ r, name, team, verified, arkivKey, defaultOpen }: { r: SignedReceipt; name: string; team?: string; verified: boolean; arkivKey?: string; defaultOpen?: boolean }) {
  const n = signedNumbers(r);
  const items = receiptItems(r);
  const hidden = n.done + n.categoryCounts.Wasted - items.length;
  return (
    <Collapsible
      defaultOpen={defaultOpen}
      title={name}
      hint={
        <>
          {team ? `${team}. ` : ""}
          {plural(n.done, "thing")} done, {usd(n.spendUsd)}
          {n.mergedPrs ? `, ${plural(n.mergedPrs, "merged PR")}` : ""}
          {r.oneLiner && r.oneLiner !== items[0]?.title ? `. ${r.oneLiner}` : ""}
        </>
      }
    >
      <div className="space-y-4">
        {items.length ? <WeekList items={items} linkSessions={false} /> : <p className="text-sm text-muted-foreground">Shared totals only, no list.</p>}
        {hidden > 0 && <p className="text-sm text-muted-foreground">{plural(hidden, "item")} kept private. They still count in the signed totals.</p>}
        {r.evidence.length > 0 && (
          <div>
            <div className="mb-1 text-sm font-medium">Pull requests</div>
            <PrTable evidence={r.evidence} />
          </div>
        )}
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          {verified ? (
            <span className="inline-flex items-center gap-1 text-[var(--c-built)]">
              <BadgeCheck className="size-4" aria-hidden="true" /> Signature checked
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-destructive">
              <TriangleAlert className="size-4" aria-hidden="true" /> Signature does not match
            </span>
          )}
          <span>
            Written by {r.summary.writtenBy}
            {n.author ? `, signed as ${n.author}` : ""}.
          </span>
          {arkivKey && (
            <Link className="text-primary hover:underline" href={`/r/${arkivKey}`}>
              Open on Arkiv
            </Link>
          )}
        </p>
      </div>
    </Collapsible>
  );
}
