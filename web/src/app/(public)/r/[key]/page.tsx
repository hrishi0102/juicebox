import Link from "next/link";
import { ReceiptPaper } from "@/components/receipt-paper";
import { PrTable } from "@/components/pr-table";
import { WeekList } from "@/components/week-list";
import { ExternalLink } from "lucide-react";
import { blockDate, fetchReceiptByKey } from "@/lib/receipts/arkiv";
import { arkivAddressUrl, arkivEntityUrl, swarmProofPath } from "@/lib/proof-urls";
import { summaryFromReceipt, verifyReceipt } from "@/lib/receipts/receipt";
import { shortAddr } from "@/lib/format";

// A shared receipt, read straight from Arkiv by its entity key: what anyone with the link sees.
// This is the link an engineer hands to a manager or a reviewer. Nothing here comes from our own
// storage, and the list stays sealed (only the company page opens it, for members of the org).
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
  const expires = r.arkiv.expiresAt ? await blockDate(r.arkiv.expiresAt) : undefined;
  const ownerIsSigner = !!r.arkiv.owner && r.arkiv.owner.toLowerCase() === r.message.owner.toLowerCase();

  return (
    <div className="grid gap-10 lg:grid-cols-[380px_1fr]">
      <ReceiptPaper
        weekId={r.message.period}
        start={summary.periodStart}
        end={summary.periodEnd}
        summary={summary}
        owner={r.message.owner}
        judgeLine={r.summary.writtenBy}
        ownerName={r.message.author ? `@${r.message.author}` : undefined}
        digest={r.digest}
        signed={v.ok}
        sharedLevel={r.share?.level}
        animate
      />
      <div className="space-y-8">
        <div>
          <p className="text-sm text-muted-foreground">
            Week {r.message.period.split("-W")[1]}, shared by {r.message.author ? `@${r.message.author}` : shortAddr(r.message.owner)}
            {r.share?.team ? ` with team ${r.share.team}` : ""}
          </p>
          <h1 className="mt-1 text-balance text-4xl font-semibold leading-[1.1] tracking-tight">{r.headline}.</h1>
          {r.oneLiner && <p className="mt-3 text-xl">{r.oneLiner}</p>}
        </div>
        {r.swarm && !r.swarm.opened && (
          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="font-semibold">The list is private</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              This week&apos;s list, pull requests and AI records are stored on Swarm, encrypted on the author&apos;s laptop. Only{" "}
              {r.share?.org ? `the ${r.share.org} company key` : "the company key"} can open them, for members of {r.share?.org ?? "the company"} on its
              company page. Everyone can check the signed totals above.
            </p>
            <p className="mt-2 text-sm">
              <Link className="text-primary hover:underline" href={swarmProofPath(r.swarm.ref, key)}>
                Fetch the encrypted copy from Swarm now
              </Link>
              <span className="ml-2 break-all text-xs text-muted-foreground">reference {r.swarm.ref}</span>
            </p>
          </section>
        )}
        {summary.items.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold">What they got done</h2>
            <div className="mt-2">
              <WeekList items={summary.items} linkSessions={false} />
            </div>
          </section>
        )}
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
        </section>
        <section>
          <h2 className="text-lg font-semibold">On Arkiv</h2>
          <ul className="mt-2 space-y-1 text-sm">
            <li className="break-all">
              <a className="inline-flex items-center gap-1 text-primary hover:underline" href={arkivEntityUrl(key)} target="_blank" rel="noreferrer">
                The record on the Arkiv explorer <ExternalLink className="size-3" aria-hidden="true" />
              </a>{" "}
              <span className="text-xs text-muted-foreground">{key}</span>
            </li>
            {r.arkiv.readonly !== undefined && <li>{r.arkiv.readonly ? "Read-only: nobody can change it, not even its owner." : "Not read-only: its owner could change it."}</li>}
            {r.arkiv.owner && (
              <li className="break-all">
                Owned by {r.arkiv.owner}
                {ownerIsSigner ? ", the person who signed it. Only they can delete it or keep it longer." : "."}
              </li>
            )}
            {r.arkiv.creator && r.arkiv.creator.toLowerCase() !== r.arkiv.owner?.toLowerCase() && (
              <li className="break-all">
                Written by{" "}
                <a className="text-primary hover:underline" href={arkivAddressUrl(r.arkiv.creator)} target="_blank" rel="noreferrer">
                  {r.arkiv.creator}
                </a>
                , the company wallet, which only paid the fee.
              </li>
            )}
            {r.arkiv.expiresAt !== undefined && (
              <li>
                Expires at block {r.arkiv.expiresAt.toLocaleString("en-US")}
                {expires ? `, around ${expires.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}` : ""}, unless its owner keeps it longer.
              </li>
            )}
          </ul>
        </section>
        {r.evidence.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold">Pull requests</h2>
            <div className="mt-2 rounded-lg border border-border bg-card px-4 py-2">
              <PrTable evidence={r.evidence} />
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
