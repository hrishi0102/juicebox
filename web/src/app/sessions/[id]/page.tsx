import Link from "next/link";
import { notFound } from "next/navigation";
import { Difficulty } from "@/components/label-badge";
import { CategoryBadge } from "@/components/category-badge";
import { JudgeButton } from "@/components/pipeline-controls";
import { currentSource, getDataset } from "@/lib/server/data";
import { sessionUsd, totalTokens } from "@/lib/receipts/pricing";
import { loopScore } from "@/lib/receipts/heuristics";
import { dayTime, shortHash, tokens, usd } from "@/lib/format";
import { buildPrivateDigest, DEFAULT_LOG_ROOT } from "@/lib/receipts/parse";
import { outcomeText } from "@/lib/receipts/judge";
import { sessionMessage } from "@/lib/receipts/judge-core";
import { linkedChanges } from "@/lib/receipts/heuristics";

export default async function SessionDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const source = await currentSource();
  const d = getDataset(source);
  const s = d?.sessions.find((x) => x.id === id);
  if (!d || !s) notFound();
  const j = d.judgements.find((x) => x.sessionId === id);
  const links = d.matches.filter((m) => m.sessionId === id).map((m) => ({ m, c: d.changes.find((c) => c.key === m.changeKey) }));
  const g = s.signals;
  const t = s.cost.tokens;
  // Exactly what the private judge would receive for this session. Rendered only on this machine.
  let preview: string | undefined;
  if (source === "local") {
    const byKey = new Map(d.changes.map((c) => [c.key, c]));
    const digest = await buildPrivateDigest(s, d.meta.logRoot ?? DEFAULT_LOG_ROOT, outcomeText(linkedChanges(s, d.matches, byKey)));
    preview = sessionMessage(digest, j ? `${j.category ?? j.label}: "${j.title ?? ""}", difficulty ${j.difficulty}, loop score ${loopScore(s)}` : "none");
  }

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <Link href="/sessions" className="text-sm text-muted-foreground hover:text-foreground">
          All sessions
        </Link>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{j?.title || s.title || "Untitled session"}</h1>
        <p className="mt-2 text-muted-foreground">
          {dayTime(s.startedAt)}, {s.activeMinutes} active minutes in {s.repos[0] ?? s.cwd}
          {s.title && j?.title && s.title !== j.title ? `. Session title: ${s.title}` : ""}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {j?.category && <CategoryBadge category={j.category} />}
          {j && <Difficulty value={j.difficulty} />}
          <span className="text-2xl font-semibold">{usd(sessionUsd(s))}</span>
          {source === "local" && <JudgeButton label="Ask the private AI about this session" sessionIds={[s.id]} judgeReady={!!process.env.ZG_API_KEY} />}
        </div>
        {j && <p className="mt-3 max-w-[70ch]">{j.reason}</p>}
      </div>

      <section>
        <h2 className="text-lg font-semibold">What it turned into</h2>
        {links.length === 0 ? (
          <p className="mt-2 text-muted-foreground">No pull request or commit linked to this session.</p>
        ) : (
          <ul className="mt-2 divide-y divide-border rounded-lg border border-border bg-card">
            {links.map(({ m, c }) => (
              <li key={m.changeKey} className="px-4 py-3">
                <a href={c?.url} target="_blank" rel="noreferrer" className="font-medium hover:underline">
                  {c?.title ?? m.changeKey}
                </a>
                <div className="text-sm text-muted-foreground">
                  {m.changeKey}: {c?.reverted ? "merged, then reverted" : c?.state}, +{c?.additions}/-{c?.deletions} lines in {c?.files.length} files.
                  Linked by {m.reason} ({Math.round(m.confidence * 100)}% confidence).
                  {c?.survival && ` ${Math.round(c.survival.ratio * 100)}% of sampled lines still alive${c.survival.matured ? " after 30 days" : " so far"}.`}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-8 sm:grid-cols-2">
        <div>
          <h2 className="text-lg font-semibold">Cost</h2>
          <dl className="mt-2 space-y-1 text-sm">
            <Item k="Priced from tokens" v={usd(s.cost.usd, 2)} />
            {s.cost.claudeReportedUsd !== undefined && <Item k="Claude Code's own tracker" v={usd(s.cost.claudeReportedUsd, 2)} />}
            <Item k="Total tokens" v={tokens(totalTokens(t))} />
            <Item k="Cache reads" v={`${tokens(t.cacheRead)} (${Math.round((t.cacheRead / Math.max(1, totalTokens(t))) * 100)}%)`} />
            <Item k="Cache writes" v={tokens(t.cacheWrite5m + t.cacheWrite1h)} />
            <Item k="Output" v={tokens(t.output)} />
            {Object.entries(s.cost.byModel).map(([m, c]) => (
              <Item key={m} k={m} v={`${usd(c.usd, 2)}, ${c.requests} calls`} />
            ))}
          </dl>
        </div>
        <div>
          <h2 className="text-lg font-semibold">How it went</h2>
          <dl className="mt-2 space-y-1 text-sm">
            <Item k="Your prompts" v={String(g.userPrompts)} />
            <Item k="Tool calls" v={`${g.toolCalls} (${Math.round(g.readOnlyRatio * 100)}% read-only)`} />
            <Item k="Tool errors" v={`${g.toolErrors}, longest streak ${g.maxErrorStreak}`} />
            <Item k="Commands repeated 3+ times" v={String(g.repeatedCommands)} />
            <Item k="Most edits to one file" v={String(g.maxEditsSameFile)} />
            <Item k="Test runs" v={String(g.testRuns)} />
            <Item k="Files edited" v={`${s.filesEdited.length}, +${s.linesAdded}/-${s.linesRemoved}`} />
            <Item k="Subagents" v={String(g.subagents)} />
            <Item k="Loop score" v={`${loopScore(s)} (3 or more counts as looping)`} />
          </dl>
        </div>
      </section>

      {preview && (
        <section>
          <details>
            <summary className="cursor-pointer text-lg font-semibold">What the private AI is sent</summary>
            <p className="mt-2 max-w-[70ch] text-sm text-muted-foreground">
              This is the whole message sent to 0G for this session, plus a fixed instruction. Nothing else from the transcript leaves your laptop.
              The model runs inside a TEE; the message gets there over HTTPS through 0G&apos;s router, which is not end-to-end sealed today.
            </p>
            <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-card p-4 text-xs">{preview}</pre>
          </details>
        </section>
      )}

      {j && (
        <section>
          <h2 className="text-lg font-semibold">Private AI record</h2>
          <dl className="mt-2 space-y-1 text-sm">
            <Item k="Engine" v={j.judge.engine === "0g-tee" ? "0G Private Computer (TEE)" : j.judge.engine === "heuristic" ? "Offline rules" : "Local model"} />
            {j.judge.model && <Item k="Model" v={j.judge.model} />}
            {j.judge.provider && <Item k="Provider" v={j.judge.provider} />}
            {j.judge.requestId && <Item k="Request id" v={j.judge.requestId} />}
            {j.judge.trustMode && <Item k="Trust mode" v={j.judge.trustMode} />}
            {j.judge.sealed !== undefined && <Item k="Sealed end to end" v={j.judge.sealed ? "yes" : "no"} />}
            {j.judge.teeVerified !== undefined && <Item k="Router checked TEE signature" v={j.judge.teeVerified ? "yes" : "no"} />}
            {j.judge.selfVerified !== undefined && <Item k="We checked TEE signature" v={j.judge.selfVerified ? "yes" : "no"} />}
            {j.judge.payer && <Item k="Paid by" v={j.judge.payer === "app key" ? "the app's 0G key" : `0G account ${j.judge.payer}`} />}
            {j.judge.costUsd !== undefined && <Item k="Cost of this call" v={`$${j.judge.costUsd.toFixed(4)}`} />}
            {j.judge.requestHash && <Item k="Hash of what was sent" v={shortHash(j.judge.requestHash, 10)} />}
            {j.judge.responseHash && <Item k="Hash of the answer" v={shortHash(j.judge.responseHash, 10)} />}
          </dl>
          <p className="mt-3 max-w-[70ch] text-sm text-muted-foreground">
            The private AI sees trimmed prompts, the AI&apos;s last answers, a tool-use summary, the GitHub outcome and the cost. Only the category,
            title, difficulty, a generic reason and these hashes are kept. The prompts are never written anywhere.
          </p>
        </section>
      )}
    </div>
  );
}

function Item({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-3">
      <dt className="w-56 shrink-0 text-muted-foreground">{k}</dt>
      <dd className="min-w-0 break-all">{v}</dd>
    </div>
  );
}
