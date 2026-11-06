import Link from "next/link";
import { ReceiptPaper } from "@/components/receipt-paper";
import { PrTable } from "@/components/pr-table";
import { ARKIV_EXPLORER, fetchReceiptByKey } from "@/lib/receipts/arkiv";
import { summaryFromReceipt, verifyReceipt } from "@/lib/receipts/receipt";
import { shortAddr } from "@/lib/format";

// A shared receipt, read straight from Arkiv by its entity key. This is the link an engineer
// hands to a manager or a reviewer. Nothing here comes from our own storage.
export default async function SharedReceipt({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  let r: Awaited<ReturnType<typeof fetchReceiptByKey>>;
  let error: string | undefined;
  try {
    r = /^0x[0-9a-fA-F]{64}$/.test(key) ? await fetchReceiptByKey(key) : undefined;
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  if (!r)
    return (
      <div className="max-w-2xl space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">Receipt not found</h1>
        <p className="text-muted-foreground">
          No receipt with this key on Arkiv. Shared receipts expire after 120 days, or the key may be wrong.{error ? ` (${error.slice(0, 140)})` : ""}
        </p>
        <Link href="/verify" className="text-primary hover:underline">
          Check a receipt file instead
        </Link>
      </div>
    );

  const v = await verifyReceipt(r);
  const summary = summaryFromReceipt(r);

  return (
    <div className="grid gap-10 lg:grid-cols-[380px_1fr]">
      <ReceiptPaper
        weekId={r.message.period}
        start={summary.periodStart}
        end={summary.periodEnd}
        summary={summary}
        owner={r.message.owner}
        judgeLine={r.message.judge.startsWith("0g") ? "0G TEE" : r.message.judge}
        digest={r.digest}
        signed={v.ok}
        sharedLevel={r.share?.level}
        animate
      />
      <div className="space-y-8">
        <div>
          <h1 className="text-balance text-4xl font-semibold leading-[1.1] tracking-tight">{r.headline}.</h1>
          <p className="mt-3 text-muted-foreground">
            Week {r.message.period.split("-W")[1]} receipt of {shortAddr(r.message.owner)}, shared{r.share?.team ? ` with team ${r.share.team}` : ""}
            {r.share?.level === "full" ? ", including the pull requests it paid for" : " as totals only"}.
          </p>
        </div>
        <section>
          <h2 className="text-lg font-semibold">Checks</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {v.checks.map((c) => (
              <li key={c.name} className="flex gap-2">
                <span className={c.ok ? "text-[var(--l-shipped)]" : "text-destructive"} aria-hidden="true">
                  {c.ok ? "✓" : "✗"}
                </span>
                {c.name}
                {c.detail && <span className="text-muted-foreground">({c.detail})</span>}
              </li>
            ))}
          </ul>
          <p className="mt-3 break-all text-sm text-muted-foreground">
            Read from Arkiv entity{" "}
            <a className="hover:underline" href={`${ARKIV_EXPLORER}/entity/${key}`} target="_blank" rel="noreferrer">
              {key}
            </a>
            {r.arkiv.owner ? `, written by ${r.arkiv.owner}` : ""}.
          </p>
        </section>
        {r.evidence.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold">Pull requests it paid for</h2>
            <div className="mt-2 rounded-lg border border-border bg-card px-4 py-2">
              <PrTable evidence={r.evidence} />
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
