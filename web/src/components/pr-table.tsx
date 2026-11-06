import { usd } from "@/lib/format";
import type { EvidenceLeaf } from "@/lib/receipts/receipt";

export type PrRow = EvidenceLeaf & { person?: string; team?: string };

function status(e: EvidenceLeaf) {
  if (e.reverted) return { text: "Reverted", tone: "text-[var(--l-overkill)]" };
  if (e.state === "open") return { text: "Open", tone: "text-muted-foreground" };
  if (e.state === "closed") return { text: "Closed, not merged", tone: "text-muted-foreground" };
  if (e.survivalBps === 65535) return { text: "Merged", tone: "" };
  return { text: `Merged, ${Math.round(e.survivalBps / 100)}% alive`, tone: "" };
}

/** Pull requests from signed receipts: title, link, status, and the AI cost behind each one. */
export function PrTable({ evidence, showPerson }: { evidence: PrRow[]; showPerson?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-sm">
        <thead className="text-left text-muted-foreground">
          <tr>
            <th className="py-1.5 pr-3 font-normal">Pull request</th>
            {showPerson && <th className="py-1.5 pr-3 font-normal">Who</th>}
            <th className="py-1.5 pr-3 font-normal">Status</th>
            <th className="py-1.5 text-right font-normal">AI cost</th>
          </tr>
        </thead>
        <tbody>
          {evidence.map((e) => {
            const st = status(e);
            return (
              <tr key={e.leaf + (e.person ?? "")} className="border-t border-border align-top">
                <td className="py-2 pr-3">
                  <a href={e.url} target="_blank" rel="noreferrer" className="font-medium hover:underline">
                    {e.title || e.changeKey}
                  </a>
                  <div className="text-xs text-muted-foreground">{e.changeKey}</div>
                </td>
                {showPerson && (
                  <td className="py-2 pr-3">
                    {e.person}
                    {e.team && <div className="text-xs text-muted-foreground">{e.team}</div>}
                  </td>
                )}
                <td className={`py-2 pr-3 ${st.tone}`}>{st.text}</td>
                <td className="py-2 text-right">{usd(e.costCents / 100)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
