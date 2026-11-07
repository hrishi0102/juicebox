import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Difficulty } from "@/components/label-badge";
import { CategoryBadge } from "@/components/category-badge";
import { currentSource, getDataset, periodView } from "@/lib/server/data";
import { headline } from "@/lib/receipts/score";
import { sessionUsd } from "@/lib/receipts/pricing";
import { CATEGORY_COPY, dayTime, usd } from "@/lib/format";
import { CATEGORIES, TOOL_NAMES, toolOf, type Category } from "@/lib/receipts/types";

export default async function Sessions({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const sp = await searchParams;
  const source = await currentSource();
  const d = getDataset(source);
  if (!d) return <p className="mw text-[var(--mute)]">No sessions yet. Read your logs in Setup, or try the demo company.</p>;

  const judgeBy = new Map(d.judgements.map((j) => [j.sessionId, j]));
  const changeBy = new Map(d.changes.map((c) => [c.key, c]));
  const filter = CATEGORIES.includes(sp.category as Category) ? (sp.category as Category) : undefined;
  const rows = d.sessions
    .map((s) => ({ s, j: judgeBy.get(s.id), links: d.matches.filter((m) => m.sessionId === s.id) }))
    .filter((r) => !filter || r.j?.category === filter);
  const total = rows.reduce((a, r) => a + sessionUsd(r.s), 0);
  const counts = Object.fromEntries(CATEGORIES.map((c) => [c, d.judgements.filter((j) => j.category === c).length]));

  return (
    <div className="mw">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="disp h-page-sm">Your sessions</h1>
          <p className="mt-3 text-lg">
            Last {d.meta.days} days: {headline(periodView(d, d.meta.days))}.
          </p>
          <p className="page-sub">
            Every AI session from the last {d.meta.days} days: what you got, what it cost and the PRs it turned into. Open one to see exactly what the
            private AI was sent. The small grey line is the session&apos;s own title from your logs.
          </p>
        </div>
        <p className="mw-count num">
          {rows.length} sessions, {usd(total)}
        </p>
      </div>

      <div className="chips mt-6" role="group" aria-label="Filter by category">
        <Link href="/me/sessions" className="chip" aria-current={!filter ? "page" : undefined}>
          All {d.sessions.length}
        </Link>
        {CATEGORIES.filter((c) => counts[c] > 0).map((c) => (
          <Link key={c} href={`/me/sessions?category=${encodeURIComponent(c)}`} className="chip" aria-current={filter === c ? "page" : undefined}>
            <span className="sq" style={{ background: `var(${CATEGORY_COPY[c].varName})` }} aria-hidden="true" />
            {c} {counts[c]}
          </Link>
        ))}
      </div>

      <div className="tbl-box mt-5">
        <table className="tbl min-w-[860px]">
          <thead>
            <tr>
              <th scope="col">Started</th>
              <th scope="col">What you got</th>
              <th scope="col">Difficulty</th>
              <th scope="col">Linked work</th>
              <th scope="col">Judge</th>
              <th scope="col" className="r">
                Cost
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ s, j, links }) => (
              <tr key={s.id} className="hover:bg-[var(--panel)]">
                <td className="whitespace-nowrap text-[var(--mute)]">{dayTime(s.startedAt)}</td>
                <td className="max-w-[340px]">
                  {j?.category ? <CategoryBadge category={j.category} /> : null}
                  <div className="mt-0.5">
                    <Link href={`/me/sessions/${s.id}`} className="plink">
                      {j?.title || s.title || "Untitled session"}
                    </Link>
                  </div>
                  <div className="truncate text-sm text-[var(--mute)]">
                    {TOOL_NAMES[toolOf(s)]}, {s.repos[0] ?? s.cwd.split("/").slice(-2).join("/")}, {s.activeMinutes} min
                  </div>
                  {s.title && j?.title && s.title !== j.title && <div className="truncate text-xs text-[var(--mute)]/80">{s.title}</div>}
                </td>
                <td>{j ? <Difficulty value={j.difficulty} /> : null}</td>
                <td>
                  {links.length === 0 ? (
                    <span className="text-[var(--mute)]">none found</span>
                  ) : (
                    <ul className="space-y-0.5">
                      {links.slice(0, 3).map((m) => {
                        const c = changeBy.get(m.changeKey);
                        return (
                          <li key={m.changeKey}>
                            <a href={c?.url} target="_blank" rel="noreferrer" className="plink">
                              {c?.number ? `#${c.number}` : m.changeKey.split("@")[1]?.slice(0, 7)}
                              <ArrowUpRight className="size-3" aria-hidden="true" />
                            </a>{" "}
                            <span className="text-sm text-[var(--mute)]">
                              {c?.reverted ? "reverted" : c?.state} by {m.reason}
                            </span>
                          </li>
                        );
                      })}
                      {links.length > 3 && <li className="text-[var(--mute)]">and {links.length - 3} more</li>}
                    </ul>
                  )}
                </td>
                <td className="text-[var(--mute)]">
                  {j?.judge.engine === "0g-tee" ? (
                    <span title={`Request ${j.judge.requestId ?? ""}`}>0G TEE{j.judge.verified ? ", verified" : ""}</span>
                  ) : j?.judge.engine === "openai-compatible" ? (
                    "Local model"
                  ) : (
                    "Rules"
                  )}
                </td>
                <td className="r font-medium">{usd(sessionUsd(s))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
