import { CATEGORY_COPY, plural, shortAddr, shortHash, usd, weekRange } from "@/lib/format";
import { CATEGORIES, TOOL_NAMES, type AiTool, type PeriodSummary } from "@/lib/receipts/types";

export type ReceiptPaperProps = {
  weekId: string;
  start: string;
  end: string;
  summary: PeriodSummary;
  owner?: string;
  ownerName?: string;
  judgeLine: string;
  digest?: string;
  signed?: boolean;
  stale?: boolean;
  sharedLevel?: string;
  compact?: boolean;
  animate?: boolean;
  showCost?: boolean;
};

/** The weekly receipt, drawn as a thermal-paper slip: what you got, then what it cost. */
export function ReceiptPaper(p: ReceiptPaperProps) {
  const s = p.summary;
  const week = p.weekId.split("-W")[1];
  const showCost = p.showCost ?? true;
  // Without the list (private or totals only), the signed counts still say how much got done.
  const done = s.items.length ? s.items.filter((i) => i.category !== "Wasted").length : CATEGORIES.filter((c) => c !== "Wasted").reduce((a, c) => a + (s.categoryCounts[c] ?? 0), 0);
  return (
    <div className={`receipt-shadow ${p.animate ? "print-in" : ""}`}>
      <article className="receipt-paper relative text-[13px] leading-[1.55]" aria-label={`Receipt for week ${week}`}>
        <header className="text-center">
          <div className="text-[15px] tracking-[0.18em]">RECEIPTS</div>
          <div className="text-paper-faint">What did you get done this week?</div>
          <div className="mt-2">
            Week {week}, {weekRange(p.start, p.end)}
          </div>
          {(p.ownerName || p.owner) && <div className="text-paper-faint">{p.ownerName ?? `Owner ${shortAddr(p.owner)}`}</div>}
        </header>

        <hr className="receipt-rule" />

        {s.items.length > 0 ? (
          <div className="space-y-2.5" aria-label="What you got">
            {CATEGORIES.filter((c) => s.items.some((i) => i.category === c)).map((c) => (
              <div key={c}>
                <div className="text-paper-faint uppercase tracking-[0.12em]">{CATEGORY_COPY[c].name}</div>
                <ul className="space-y-0.5">
                  {s.items
                    .filter((i) => i.category === c)
                    .map((i) => (
                      <li key={i.id} className="flex items-baseline">
                        <span className="min-w-0">{i.title}</span>
                        {showCost && (
                          <>
                            <span className="leader" />
                            <span>{usd(i.costUsd, 2)}</span>
                          </>
                        )}
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="mb-1 text-paper-faint">{p.sharedLevel === "sealed" ? "The list is private. Signed counts:" : "Signed counts:"}</div>
            <ul className="space-y-0.5" aria-label="Items per category">
              {CATEGORIES.filter((c) => (s.categoryCounts[c] ?? 0) > 0).map((c) => (
                <li key={c} className="flex items-baseline">
                  <span>{CATEGORY_COPY[c].name}</span>
                  <span className="ml-2 text-paper-faint">x{s.categoryCounts[c]}</span>
                  {showCost && (
                    <>
                      <span className="leader" />
                      <span>{usd(s.categorySpend[c] ?? 0, 2)}</span>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}

        <hr className="receipt-rule" />

        <div className="space-y-0.5">
          <Row k="AI sessions" v={String(s.sessions)} />
          {showCost &&
            Object.entries(s.toolSpend ?? {})
              .sort((a, b) => b[1] - a[1])
              .map(([t, v]) => <Row key={t} k={`${TOOL_NAMES[t as AiTool] ?? t}${s.toolSessions?.[t] !== undefined ? ` x${s.toolSessions[t]}` : ""}`} v={usd(v, 2)} />)}
          {showCost && <Row k="Total" v={usd(s.spendUsd, 2)} strong />}
          {showCost && s.wasteUsd > 0 && <Row k="Of which wasted" v={usd(s.wasteUsd, 2)} />}
        </div>

        {(s.items.length > 0 || done > 0) && (
          <div className="mt-5 mb-2 flex justify-center">
            <div className="stamp px-4 py-1.5 text-center leading-tight">
              <div className="text-[24px]">{done}</div>
              <div className="text-[11px]">{done === 1 ? "thing" : "things"} done</div>
            </div>
          </div>
        )}

        <hr className="receipt-rule" />

        <div className="space-y-0.5 text-[12px]">
          <Row k="Written by" v={p.judgeLine} />
          {!p.compact && <Row k="Signature" v={p.signed ? "signed (EIP-712)" : p.stale ? "out of date, sign again" : "not signed yet"} />}
          {p.sharedLevel && <Row k="Shared" v={p.sharedLevel === "full" ? "with company, incl. list" : p.sharedLevel === "sealed" ? "list encrypted on Swarm" : "totals only"} />}
        </div>

        {p.digest && !p.compact && (
          <div className="mt-4">
            <Barcode hex={p.digest} />
            <div className="mt-1 text-center text-[11px] text-paper-faint">{shortHash(p.digest, 10)}</div>
          </div>
        )}
        {!p.compact && <div className="mt-3 text-center text-paper-faint">Prompts not included. Ever.</div>}
      </article>
    </div>
  );
}

/** "0G private AI, TEE verified" or "simple rules", for the receipt's "Written by" line. */
export function writtenBy(story: PeriodSummary["story"]) {
  if (story.engine === "0g-tee") return `0G private AI${story.verified ? ", TEE verified" : ""}`;
  if (story.engine === "openai-compatible") return "local AI model";
  return "simple rules";
}

export function storyCalls(story: PeriodSummary["story"]) {
  return story.requestIds.length ? plural(story.requestIds.length, "private AI call") : "";
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className={`flex items-baseline ${strong ? "text-[15px]" : ""}`}>
      <span>{k}</span>
      <span className="leader" />
      <span className="text-right">{v}</span>
    </div>
  );
}

/** Bars drawn from the receipt digest, so the barcode really encodes this receipt. */
function Barcode({ hex }: { hex: string }) {
  const bits = hex
    .replace(/^0x/, "")
    .split("")
    .flatMap((c) => parseInt(c, 16).toString(2).padStart(4, "0").split(""));
  let x = 0;
  const bars: { x: number; w: number }[] = [];
  bits.forEach((b, i) => {
    const w = b === "1" ? 2 : 1;
    if (i % 2 === 0) bars.push({ x, w });
    x += w + 1;
  });
  return (
    <svg viewBox={`0 0 ${x} 34`} preserveAspectRatio="none" className="h-9 w-full" aria-hidden="true">
      {bars.map((b, i) => (
        <rect key={i} x={b.x} y={0} width={b.w} height={34} fill="currentColor" />
      ))}
    </svg>
  );
}
