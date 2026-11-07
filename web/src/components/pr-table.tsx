import { ArrowUpRight } from "lucide-react";
import { usd } from "@/lib/format";
import type { EvidenceLeaf } from "@/lib/receipts/receipt";

export type PrRow = EvidenceLeaf & { person?: string; team?: string };

function status(e: EvidenceLeaf) {
  if (e.reverted) return { text: "Reverted", tone: "bad" };
  if (e.state === "open") return { text: "Open", tone: "open" };
  if (e.state === "closed") return { text: "Closed, not merged", tone: "open" };
  if (e.state === "direct") return { text: "Pushed", tone: "" };
  return { text: "Merged", tone: "" };
}

/** Pull requests from signed receipts: title, link, status, and the AI cost behind each one. */
export function PrTable({ evidence, showPerson }: { evidence: PrRow[]; showPerson?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="tbl min-w-[520px]">
        <thead>
          <tr>
            <th scope="col">Pull request</th>
            {showPerson && <th scope="col">Who</th>}
            <th scope="col">Status</th>
            <th scope="col" className="r">
              AI cost
            </th>
          </tr>
        </thead>
        <tbody>
          {evidence.map((e) => {
            const st = status(e);
            return (
              <tr key={e.leaf + (e.person ?? "")}>
                <td>
                  <a href={e.url} target="_blank" rel="noreferrer" className="plink font-semibold">
                    {e.title || e.changeKey}
                    <ArrowUpRight className="size-3.5" aria-hidden="true" />
                  </a>
                  <div className="text-sm text-[var(--mute)]">{e.changeKey}</div>
                </td>
                {showPerson && (
                  <td>
                    {e.person}
                    {e.team && <div className="text-sm text-[var(--mute)]">{e.team}</div>}
                  </td>
                )}
                <td>
                  <span className={`state-chip ${st.tone}`}>{st.text}</span>
                </td>
                <td className="r font-semibold">{usd(e.costCents / 100)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
