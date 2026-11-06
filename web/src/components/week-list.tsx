import Link from "next/link";
import { CategoryBadge } from "@/components/category-badge";
import { plural, usd } from "@/lib/format";
import { TOOL_NAMES, type AiTool, type WeekItem } from "@/lib/receipts/types";
import { formatMinutes, type ItemTimeline } from "@/lib/receipts/efficiency";

/** "idea to code 54m · code to commit 6m · PR in 15h · merged in 3h" */
function timelineText(tl?: ItemTimeline) {
  if (!tl) return "";
  const parts: string[] = [];
  if (tl.ideaToCode !== undefined) parts.push(`idea to code ${formatMinutes(tl.ideaToCode)}`);
  if (tl.codeToCommit !== undefined) parts.push(`code to commit ${formatMinutes(tl.codeToCommit)}`);
  if (tl.commitToPr !== undefined) parts.push(`PR in ${formatMinutes(tl.commitToPr)}`);
  if (tl.prToMerge !== undefined) parts.push(`merged in ${formatMinutes(tl.prToMerge)}`);
  return parts.join(" · ");
}

function prState(p: WeekItem["prs"][number]) {
  if (p.reverted) return "reverted";
  if (p.state === "direct") return "pushed";
  if (p.state === "closed") return "closed";
  return p.state;
}

function prLabel(p: WeekItem["prs"][number]) {
  const n = p.key.match(/#(\d+)$/)?.[1];
  return n ? `PR #${n}` : "commit";
}

/** "What you got this week": one row per item, the AI's order, waste last. */
export function WeekList({
  items,
  showCost = true,
  linkSessions = true,
  timelines,
}: {
  items: WeekItem[];
  showCost?: boolean;
  linkSessions?: boolean;
  timelines?: Record<string, ItemTimeline>;
}) {
  if (!items.length) return <p className="text-muted-foreground">No AI sessions this week yet.</p>;
  return (
    <ol className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
      {items.map((i) => (
        <li key={i.id} className={`flex items-start gap-3 px-4 py-3.5 sm:gap-4 ${i.category === "Wasted" ? "bg-muted/40" : ""}`}>
          <div className="hidden w-[104px] shrink-0 pt-0.5 sm:block">
            <CategoryBadge category={i.category} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-1.5 sm:hidden">
              <CategoryBadge category={i.category} />
            </div>
            <div className="text-[16px] font-medium leading-snug text-balance">
              {i.title}
              {i.inProgress && <span className="ml-2 align-middle text-xs font-normal text-muted-foreground">in progress</span>}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              {i.sessions.length > 0 &&
                (linkSessions && i.sessions.length === 1 ? (
                  <Link href={`/me/sessions/${i.sessions[0]}`} className="hover:text-foreground hover:underline">
                    1 session
                  </Link>
                ) : (
                  <span>{plural(i.sessions.length, "session")}</span>
                ))}
              {i.tools.length > 0 && <span>{i.tools.map((t) => TOOL_NAMES[t as AiTool] ?? t).join(" + ")}</span>}
              {i.prs.slice(0, 3).map((p) =>
                p.url ? (
                  <a key={p.key} href={p.url} target="_blank" rel="noreferrer" className="hover:text-foreground hover:underline" title={p.title}>
                    {prLabel(p)} {prState(p)}
                  </a>
                ) : (
                  <span key={p.key}>{prLabel(p)}</span>
                ),
              )}
              {i.prs.length > 3 && <span>+{i.prs.length - 3} more</span>}
            </div>
            {timelineText(timelines?.[i.id]) && <div className="mt-0.5 text-xs text-muted-foreground">{timelineText(timelines?.[i.id])}</div>}
          </div>
          {showCost && <div className="shrink-0 pt-0.5 text-right font-medium">{usd(i.costUsd, 2)}</div>}
        </li>
      ))}
    </ol>
  );
}
