import Link from "next/link";
import { ReceiptPaper } from "@/components/receipt-paper";
import { PrTable } from "@/components/pr-table";
import { WeekList } from "@/components/week-list";
import { Check, Link2, Lock, X } from "lucide-react";
import { ProofAnchor } from "@/components/proof-links";
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
      <div className="wrapw pub">
        <div className="errbox max-w-2xl">
          <h1 className="disp h-page-sm">Receipt not found</h1>
          <p className="mt-3 text-[var(--ink-2)]">
            No receipt with this key on Arkiv. Shared receipts expire after 120 days, or the key may be wrong.{error ? ` (${error.slice(0, 140)})` : ""}
          </p>
          <p className="mt-4">
            <ProofAnchor href="/verify">Check a receipt file instead</ProofAnchor>
          </p>
        </div>
      </div>
    );

  const v = await verifyReceipt(r);
  const summary = summaryFromReceipt(r);
  const expires = r.arkiv.expiresAt ? await blockDate(r.arkiv.expiresAt) : undefined;
  const ownerIsSigner = !!r.arkiv.owner && r.arkiv.owner.toLowerCase() === r.message.owner.toLowerCase();

  return (
    <div className="wrapw pub">
      <p className="pub-ctx">
        <Link2 className="size-4" aria-hidden="true" />A shared receipt, read straight from Arkiv. Anyone with this link sees the same page.
      </p>
      <div className="shared">
        <div className="shared-left">
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
          <p className="help mt-6 max-w-[360px]">The paper is drawn from the signed numbers on Arkiv. If one cent were changed, the checks would fail.</p>
        </div>
        <div className="shared-right">
          <div>
            <p className="text-[15px] text-[var(--mute)]">
              Week {r.message.period.split("-W")[1]}, shared by {r.message.author ? `@${r.message.author}` : shortAddr(r.message.owner)}
              {r.share?.team ? ` with team ${r.share.team}` : ""}
            </p>
            <h1 className="disp h-page num mt-1.5">{r.headline}.</h1>
            {r.oneLiner && <p className="pub-one">{r.oneLiner}</p>}
          </div>

          <section className="pnl ticks" aria-labelledby="checks-h">
            <div className="pnl-h">
              <h2 className="pnl-t" id="checks-h">
                Checks
              </h2>
              <span className="host">Run against Arkiv</span>
            </div>
            <ol>
              {v.checks.map((c) => (
                <li key={c.name} className="check-row">
                  <span className={`ck ${c.ok ? "ck-done" : "ck-bad"}`} aria-hidden="true">
                    {c.ok ? <Check className="size-[13px]" strokeWidth={3} /> : <X className="size-[13px]" strokeWidth={3} />}
                  </span>
                  <span>
                    <span className="sr-only">{c.ok ? "Passed" : "Failed"}: </span>
                    {c.name}
                    {c.detail && <span className="d">{c.detail}</span>}
                  </span>
                </li>
              ))}
            </ol>
            <div className={`verdict ${v.ok ? "ok" : "bad"}`} role="status">
              <span className={`ck ck-lg ${v.ok ? "ck-done" : "ck-bad"}`} aria-hidden="true">
                {v.ok ? <Check className="size-4" strokeWidth={3} /> : <X className="size-4" strokeWidth={3} />}
              </span>
              <div>
                <div className="vt">{v.ok ? "This receipt checks out." : "This receipt does not check out."}</div>
                <div className="vs">{v.ok ? "Every number on the paper is the one its owner signed." : "At least one check above failed."}</div>
              </div>
            </div>
          </section>

          {r.swarm && !r.swarm.opened && (
            <section className="pnl" aria-labelledby="private-h">
              <div className="pnl-h">
                <h2 className="pnl-t" id="private-h">
                  <Lock className="size-[18px]" aria-hidden="true" />
                  The list is private
                </h2>
              </div>
              <div className="pnl-body">
                <p className="max-w-[64ch] text-[var(--ink-2)]">
                  This week&apos;s list, pull requests and AI records are stored on Swarm, encrypted on the author&apos;s laptop. Only{" "}
                  {r.share?.org ? `the ${r.share.org} company key` : "the company key"} can open them, for members of {r.share?.org ?? "the company"} on its
                  company page. Everyone can check the signed totals above.
                </p>
                <p className="mt-3 text-xs text-[var(--mute)]">
                  Reference <span className="mono">{r.swarm.ref}</span>
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
                  <Link className="btn btn-secondary" href={swarmProofPath(r.swarm.ref, key)}>
                    Fetch the encrypted copy from Swarm now
                  </Link>
                  <span className="host">Opens here</span>
                </div>
              </div>
            </section>
          )}

          {summary.items.length > 0 && (
            <section>
              <h2 className="h-sub mb-3.5">What they got done</h2>
              <WeekList items={summary.items} linkSessions={false} />
            </section>
          )}

          <section className="pnl" aria-labelledby="arkiv-h">
            <div className="pnl-h">
              <h2 className="pnl-t" id="arkiv-h">
                On Arkiv
              </h2>
              <span className="host">Arkiv testnet Rabdi</span>
            </div>
            <div className="fact">
              <span className="k">Record</span>
              <span className="v">
                The receipt itself, read-only, with the signed totals
                <span className="mono mt-0.5 block text-[var(--ink-2)]">{key}</span>
              </span>
              <span className="go">
                <ProofAnchor href={arkivEntityUrl(key)}>The record on the Arkiv explorer</ProofAnchor>
              </span>
            </div>
            {r.arkiv.readonly !== undefined && (
              <div className="fact">
                <span className="k">Read-only</span>
                <span className="v">{r.arkiv.readonly ? "Read-only: nobody can change it, not even its owner." : "Not read-only: its owner could change it."}</span>
                <span />
              </div>
            )}
            {r.arkiv.owner && (
              <div className="fact">
                <span className="k">Owned by</span>
                <span className="v">
                  <span className="mono">{r.arkiv.owner}</span>
                  {ownerIsSigner ? ", the person who signed it. Only they can delete it or keep it longer." : "."}
                </span>
                <span />
              </div>
            )}
            {r.arkiv.creator && r.arkiv.creator.toLowerCase() !== r.arkiv.owner?.toLowerCase() && (
              <div className="fact">
                <span className="k">Paid for by</span>
                <span className="v">
                  <span className="mono">{r.arkiv.creator}</span>, the company wallet, which only paid the fee.
                </span>
                <span className="go">
                  <ProofAnchor href={arkivAddressUrl(r.arkiv.creator)}>Every record it wrote</ProofAnchor>
                </span>
              </div>
            )}
            {r.arkiv.expiresAt !== undefined && (
              <div className="fact">
                <span className="k">Expires</span>
                <span className="v">
                  At block {r.arkiv.expiresAt.toLocaleString("en-US")}
                  {expires ? `, around ${expires.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}` : ""}, unless its owner keeps it longer.
                </span>
                <span />
              </div>
            )}
          </section>

          {r.evidence.length > 0 && (
            <section className="pnl" aria-labelledby="prs-h">
              <div className="pnl-h">
                <h2 className="pnl-t" id="prs-h">
                  Pull requests
                </h2>
              </div>
              <PrTable evidence={r.evidence} />
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
