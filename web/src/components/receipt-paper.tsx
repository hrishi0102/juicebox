import { CATEGORY_COPY, plural, shortAddr, shortHash, usd, weekRange } from "@/lib/format";
import { CATEGORIES, TOOL_NAMES, type AiTool, type PeriodSummary } from "@/lib/receipts/types";
import { formatMinutes } from "@/lib/receipts/efficiency";

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
  /** When it was signed, already formatted, for the stamp. */
  signedAt?: string;
  /** Once sent: the stub that tears off, saying where it went. */
  stub?: { to: string; at?: string; record?: string };
};

/** The weekly receipt, drawn as a thermal-paper slip: what you got, then what it cost. */
export function ReceiptPaper(p: ReceiptPaperProps) {
  const s = p.summary;
  const week = p.weekId.split("-W")[1];
  const showCost = p.showCost ?? true;
  // Without the list (private or totals only), the signed counts still say how much got done.
  const done = s.items.length ? s.items.filter((i) => i.category !== "Wasted").length : CATEGORIES.filter((c) => c !== "Wasted").reduce((a, c) => a + (s.categoryCounts[c] ?? 0), 0);
  const who = p.ownerName ?? (p.owner ? shortAddr(p.owner) : undefined);
  return (
    <div className={`receipt-shadow ${p.animate ? "print-in" : ""}`}>
      <article className="paper" aria-label={`Receipt for week ${week}`}>
        {!p.signed && !p.sharedLevel && !p.compact && (
          <span className="wm" aria-hidden="true">
            {p.stale ? "Sign it again" : "Not signed yet"}
          </span>
        )}
        <header className="r-head">
          <div className="r-name">Juicebox</div>
          <div className="r-faint">What did you get done this week?</div>
          <div style={{ marginTop: 8 }}>
            Week {week}, {weekRange(p.start, p.end)}
          </div>
          {(p.ownerName || p.owner) && <div className="r-faint">{p.ownerName ?? `Owner ${shortAddr(p.owner)}`}</div>}
        </header>

        <hr className="r-rule" />

        {s.items.length > 0 ? (
          <div className="space-y-2.5" aria-label="What you got">
            {CATEGORIES.filter((c) => s.items.some((i) => i.category === c)).map((c) => (
              <div key={c}>
                <div className="r-gname">
                  <span className="sq" style={{ background: `var(${CATEGORY_COPY[c].varName})` }} aria-hidden="true" />
                  {CATEGORY_COPY[c].name}
                </div>
                <ul>
                  {s.items
                    .filter((i) => i.category === c)
                    .map((i) => (
                      <li key={i.id} className="r-row">
                        <span className="l">{i.title}</span>
                        {showCost && (
                          <>
                            <span className="leader" />
                            <span className="num">{usd(i.costUsd, 2)}</span>
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
            <div className="r-faint" style={{ marginBottom: 4 }}>
              {p.sharedLevel === "sealed" ? "The list is private. Signed counts:" : "Signed counts:"}
            </div>
            <ul aria-label="Items per category">
              {CATEGORIES.filter((c) => (s.categoryCounts[c] ?? 0) > 0).map((c) => (
                <li key={c} className="r-row">
                  <span className="sq mr-[7px] translate-y-[-1px]" style={{ width: 7, height: 7, background: `var(${CATEGORY_COPY[c].varName})` }} aria-hidden="true" />
                  <span>
                    {CATEGORY_COPY[c].name} x{s.categoryCounts[c]}
                  </span>
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

        <hr className="r-rule" />

        <div>
          <Row k="AI sessions" v={String(s.sessions)} />
          {showCost &&
            Object.entries(s.toolSpend ?? {})
              .sort((a, b) => b[1] - a[1])
              .map(([t, v]) => <Row key={t} k={`${TOOL_NAMES[t as AiTool] ?? t}${s.toolSessions?.[t] !== undefined ? ` x${s.toolSessions[t]}` : ""}`} v={usd(v, 2)} />)}
          {showCost && <Row k="Total" v={usd(s.spendUsd, 2)} strong />}
          {showCost && s.wasteUsd > 0 && <Row k="Of which wasted" v={usd(s.wasteUsd, 2)} />}
          {s.efficiency && s.efficiency.prs.opened > 0 && <Row k="PRs merged" v={`${s.efficiency.prs.merged} of ${s.efficiency.prs.opened}`} />}
          {s.efficiency && s.efficiency.stages.ideaToMerge.n > 0 && <Row k="Idea to merged" v={formatMinutes(s.efficiency.stages.ideaToMerge.medianMin)} />}
          {s.efficiency && s.efficiency.stages.ideaToMerge.n === 0 && s.efficiency.stages.ideaToCode.n > 0 && <Row k="Idea to code" v={formatMinutes(s.efficiency.stages.ideaToCode.medianMin)} />}
          {showCost && s.efficiency && s.efficiency.waste.abandonedPlans.count > 0 && <Row k="Plans not acted on" v={usd(s.efficiency.waste.abandonedPlans.usd, 2)} />}
        </div>

        {(s.items.length > 0 || done > 0 || p.signed) && (
          <div className="mark-row">
            {(s.items.length > 0 || done > 0) && (
              <div className="mark" aria-label={`${done} ${done === 1 ? "thing" : "things"} done`}>
                <b>{done}</b>
                <span>{done === 1 ? "thing" : "things"} done</span>
              </div>
            )}
            {p.signed && !p.compact && (
              <div className={`stamp ${p.animate ? "stamp-in" : ""}`} aria-label={`Signed${who ? ` by ${who}` : ""}${p.signedAt ? ` on ${p.signedAt}` : ""}`}>
                <span className="stamp-big">Signed</span>
                {(p.ownerName || p.signedAt) && <span className="stamp-sm">{[p.ownerName, p.signedAt].filter(Boolean).join(", ")}</span>}
                {p.owner && <span className="stamp-sm">{shortAddr(p.owner)}</span>}
              </div>
            )}
          </div>
        )}

        <hr className="r-rule" />

        <div style={{ fontSize: 12 }}>
          <Row k="Written by" v={p.judgeLine} />
          {!p.compact && <Row k="Signature" v={p.signed ? "signed (EIP-712)" : p.stale ? "out of date, sign again" : "not signed yet"} />}
          {p.sharedLevel && <Row k="Shared" v={p.sharedLevel === "full" ? "with company, incl. list" : p.sharedLevel === "sealed" ? "list encrypted on Swarm" : "totals only"} />}
        </div>

        {p.digest && !p.compact && (
          <div>
            <Barcode hex={p.digest} />
            <div className="r-hash">{shortHash(p.digest, 10)}</div>
          </div>
        )}
        {!p.compact && <div className="r-foot">Prompts not included. Ever.</div>}
      </article>
      {p.stub && (
        <div className={`stub ${p.animate ? "tear-in" : ""}`} aria-label="Sent stub">
          <div>
            <b>Sent to {p.stub.to}</b>
          </div>
          {p.stub.at && <div>{p.stub.at}</div>}
          {p.stub.record && <Row k="Arkiv record" v={shortHash(p.stub.record, 4)} />}
        </div>
      )}
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
    <div className={`r-row ${strong ? "strong" : ""}`}>
      <span className="l">{k}</span>
      <span className="leader" />
      <span className="num text-right">{v}</span>
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
    <svg viewBox={`0 0 ${x} 34`} preserveAspectRatio="none" className="barcode" aria-hidden="true">
      {bars.map((b, i) => (
        <rect key={i} x={b.x} y={0} width={b.w} height={34} fill="currentColor" />
      ))}
    </svg>
  );
}
