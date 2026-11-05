import { LABEL_COPY, LABEL_ORDER, pct, shortAddr, shortHash, usd, weekRange } from "@/lib/format";
import type { PeriodSummary } from "@/lib/receipts/types";

export type ReceiptPaperProps = {
  weekId: string;
  start: string;
  end: string;
  summary: PeriodSummary;
  owner?: string;
  judgeLine: string;
  digest?: string;
  signed?: boolean;
  stale?: boolean;
  sharedLevel?: string;
  compact?: boolean;
  animate?: boolean;
};

/** The weekly receipt, drawn as a thermal-paper slip. */
export function ReceiptPaper(p: ReceiptPaperProps) {
  const s = p.summary;
  const week = p.weekId.split("-W")[1];
  return (
    <div className={`receipt-shadow ${p.animate ? "print-in" : ""}`}>
      <article className="receipt-paper relative text-[13px] leading-[1.55]" aria-label={`Receipt for week ${week}`}>
        <header className="text-center">
          <div className="text-[15px] tracking-[0.18em]">RECEIPTS</div>
          <div className="text-paper-faint">AI coding spend, itemized</div>
          <div className="mt-2">
            Week {week}, {weekRange(p.start, p.end)}
          </div>
          {p.owner && <div className="text-paper-faint">Owner {shortAddr(p.owner)}</div>}
        </header>

        <hr className="receipt-rule" />

        <div className="mb-1 text-paper-faint">Sessions by outcome</div>
        <ul className="space-y-0.5" aria-label="Sessions by outcome">
          {LABEL_ORDER.map((l) => (
            <li key={l} className="flex items-baseline">
              <span>{LABEL_COPY[l].name}</span>
              <span className="ml-2 text-paper-faint">x{s.labelCounts[l] ?? 0}</span>
              <span className="leader" />
              <span>{usd(s.labelSpend[l] ?? 0, 2)}</span>
            </li>
          ))}
        </ul>

        <hr className="receipt-rule" />

        <div className="space-y-0.5">
          <Row k="Sessions" v={String(s.sessions)} />
          <Row k="Total spend" v={usd(s.spendUsd, 2)} strong />
          <Row k="Shipped tasks" v={String(s.shippedTasks)} />
          <Row k="Kept work" v={`${s.keptWork.toFixed(1)} tasks`} />
          <Row k="Kept work per $100" v={s.keptWorkPer100Usd === null ? "n/a" : s.keptWorkPer100Usd.toFixed(1)} />
          <Row k="Waste" v={`${usd(s.wasteUsd, 2)} (${pct(s.wastePct)})`} />
        </div>

        {s.survivalPct !== null && (
          <div className="mt-5 mb-2 flex justify-center">
            <div className="stamp px-4 py-1.5 text-center leading-tight">
              <div className="text-[24px]">{Math.round(s.survivalPct)}%</div>
              <div className="text-[11px]">of shipped code still alive</div>
            </div>
          </div>
        )}

        <hr className="receipt-rule" />

        <div className="space-y-0.5 text-[12px]">
          <Row k="Judge" v={p.judgeLine} />
          <Row k="Signature" v={p.signed ? "signed (EIP-712)" : p.stale ? "out of date, sign again" : "not signed yet"} />
          {p.sharedLevel && <Row k="Shared" v={p.sharedLevel === "full" ? "with evidence" : "totals only"} />}
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
