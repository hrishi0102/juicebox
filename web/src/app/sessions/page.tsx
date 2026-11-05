import Link from "next/link";
import { Difficulty, LabelBadge } from "@/components/label-badge";
import { currentSource, getDataset, periodView } from "@/lib/server/data";
import { headline } from "@/lib/receipts/score";
import { sessionUsd } from "@/lib/receipts/pricing";
import { LABEL_COPY, LABEL_ORDER, dayTime, usd } from "@/lib/format";
import type { SessionLabel } from "@/lib/receipts/types";

export default async function Sessions({ searchParams }: { searchParams: Promise<{ label?: string }> }) {
  const sp = await searchParams;
  const source = await currentSource();
  const d = getDataset(source);
  if (!d) return <p className="text-muted-foreground">No data yet. Scan your logs from the home page, or switch to the demo team.</p>;

  const judgeBy = new Map(d.judgements.map((j) => [j.sessionId, j]));
  const changeBy = new Map(d.changes.map((c) => [c.key, c]));
  const filter = LABEL_ORDER.includes(sp.label as SessionLabel) ? (sp.label as SessionLabel) : undefined;
  const rows = d.sessions
    .map((s) => ({ s, j: judgeBy.get(s.id), links: d.matches.filter((m) => m.sessionId === s.id) }))
    .filter((r) => !filter || r.j?.label === filter);
  const total = rows.reduce((a, r) => a + sessionUsd(r.s), 0);
  const counts = Object.fromEntries(LABEL_ORDER.map((l) => [l, d.judgements.filter((j) => j.label === l).length]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Sessions</h1>
        <p className="mt-1 text-lg">
          Last {d.meta.days} days: {headline(periodView(d, d.meta.days))}.
        </p>
        <p className="mt-2 max-w-[70ch] text-muted-foreground">
          Every Claude Code session from the last {d.meta.days} days, what it cost, and what it turned into. Titles come from your prompts and only
          ever show on this machine.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm" role="group" aria-label="Filter by outcome">
        <Link href="/sessions" className={`rounded-full border px-3 py-1 ${!filter ? "border-primary bg-accent text-accent-foreground" : "border-border hover:bg-card"}`}>
          All {d.sessions.length}
        </Link>
        {LABEL_ORDER.map((l) => (
          <Link
            key={l}
            href={`/sessions?label=${l}`}
            className={`rounded-full border px-3 py-1 ${filter === l ? "border-primary bg-accent text-accent-foreground" : "border-border hover:bg-card"}`}
          >
            {LABEL_COPY[l].name} {counts[l]}
          </Link>
        ))}
        <span className="ml-auto text-muted-foreground">
          {rows.length} sessions, {usd(total)}
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="border-b border-border text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-normal">Started</th>
              <th className="px-4 py-2.5 font-normal">Session</th>
              <th className="px-4 py-2.5 font-normal">Outcome</th>
              <th className="px-4 py-2.5 font-normal">Difficulty</th>
              <th className="px-4 py-2.5 font-normal">Linked work</th>
              <th className="px-4 py-2.5 font-normal">Judge</th>
              <th className="px-4 py-2.5 text-right font-normal">Cost</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map(({ s, j, links }) => (
              <tr key={s.id} className="align-top hover:bg-background/60">
                <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{dayTime(s.startedAt)}</td>
                <td className="max-w-[280px] px-4 py-3">
                  <Link href={`/sessions/${s.id}`} className="font-medium hover:underline">
                    {s.title || "Untitled session"}
                  </Link>
                  <div className="truncate text-muted-foreground">
                    {s.repos[0] ?? s.cwd.split("/").slice(-2).join("/")}, {s.activeMinutes} min
                  </div>
                </td>
                <td className="px-4 py-3">{j ? <LabelBadge label={j.label} /> : null}</td>
                <td className="px-4 py-3">{j ? <Difficulty value={j.difficulty} /> : null}</td>
                <td className="px-4 py-3">
                  {links.length === 0 ? (
                    <span className="text-muted-foreground">none found</span>
                  ) : (
                    <ul className="space-y-0.5">
                      {links.slice(0, 3).map((m) => {
                        const c = changeBy.get(m.changeKey);
                        return (
                          <li key={m.changeKey}>
                            <a href={c?.url} target="_blank" rel="noreferrer" className="hover:underline">
                              {c?.number ? `#${c.number}` : m.changeKey.split("@")[1]?.slice(0, 7)}
                            </a>{" "}
                            <span className="text-muted-foreground">
                              {c?.reverted ? "reverted" : c?.state} by {m.reason}
                            </span>
                          </li>
                        );
                      })}
                      {links.length > 3 && <li className="text-muted-foreground">and {links.length - 3} more</li>}
                    </ul>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {j?.judge.engine === "0g-tee" ? (
                    <span title={`Request ${j.judge.requestId ?? ""}`}>0G TEE{j.judge.verified ? ", verified" : ""}</span>
                  ) : j?.judge.engine === "openai-compatible" ? (
                    "Local model"
                  ) : (
                    "Rules"
                  )}
                </td>
                <td className="px-4 py-3 text-right font-medium">{usd(sessionUsd(s))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
