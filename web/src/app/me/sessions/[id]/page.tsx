import Link from "next/link";
import { ArrowUpRight, ChevronDown, ChevronLeft } from "lucide-react";
import { ProofLinks } from "@/components/proof-links";
import { ZG_ACTIVITY, zgProofPath } from "@/lib/proof-urls";
import { notFound } from "next/navigation";
import { Difficulty } from "@/components/label-badge";
import { CategoryBadge } from "@/components/category-badge";
import { JudgeSessionButton } from "@/components/ai-actions";
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
    <div className="mw max-w-4xl">
      <Link href="/me/sessions" className="mw-back">
        <ChevronLeft className="size-4" aria-hidden="true" />
        All sessions
      </Link>
      <h1 className="disp h-page-sm">{j?.title || s.title || "Untitled session"}</h1>
      <p className="page-sub">
        {dayTime(s.startedAt)}, {s.activeMinutes} active minutes in {s.repos[0] ?? s.cwd}
        {s.title && j?.title && s.title !== j.title ? `. Session title: ${s.title}` : ""}
      </p>
      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
        {j?.category && <CategoryBadge category={j.category} />}
        {j && <Difficulty value={j.difficulty} />}
        <span className="num text-2xl font-semibold">{usd(sessionUsd(s))}</span>
        {source === "local" && <JudgeSessionButton sessionId={s.id} />}
      </div>
      {j && <p className="mt-4 max-w-[70ch] text-[var(--ink-2)]">{j.reason}</p>}

      <section className="mw-sec">
        <h2 className="h-sub mb-3.5">What it turned into</h2>
        {links.length === 0 ? (
          <p className="text-[var(--mute)]">No pull request or commit linked to this session.</p>
        ) : (
          <ul className="items">
            {links.map(({ m, c }) => (
              <li key={m.changeKey} className="border-t border-[var(--line)] px-5 py-4 first:border-t-0">
                <a href={c?.url} target="_blank" rel="noreferrer" className="plink">
                  {c?.title ?? m.changeKey}
                  <ArrowUpRight className="size-3.5" aria-hidden="true" />
                </a>
                <div className="mt-1 text-sm text-[var(--mute)]">
                  {m.changeKey}: {c?.reverted ? "merged, then reverted" : c?.state}, +{c?.additions}/-{c?.deletions} lines in {c?.files.length} files.
                  Linked by {m.reason} ({Math.round(m.confidence * 100)}% confidence).
                  {c?.survival && ` ${Math.round(c.survival.ratio * 100)}% of sampled lines still alive${c.survival.matured ? " after 30 days" : " so far"}.`}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mw-sec grid gap-6 sm:grid-cols-2">
        <div className="card card-pad">
          <h2 className="h-small mb-3">Cost</h2>
          <dl className="kv text-sm">
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
        <div className="card card-pad">
          <h2 className="h-small mb-3">How it went</h2>
          <dl className="kv text-sm">
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
        <section className="mw-sec">
          <details className="disc-solo">
            <summary className="disc-sum">
              <span className="disc-t">What the private AI is sent</span>
              <span className="disc-h">Only this leaves the laptop</span>
              <ChevronDown className="disc-chev size-[18px]" aria-hidden="true" />
            </summary>
            <div className="disc-body">
              <p className="help mb-3 mt-0">
                This is the whole message sent to 0G for this session, plus a fixed instruction. Nothing else from the transcript leaves your laptop.
                The model runs inside a TEE; the message gets there over HTTPS through 0G&apos;s router, which is not end-to-end sealed today.
              </p>
              <pre className="quote">{preview}</pre>
            </div>
          </details>
        </section>
      )}

      {j && (
        <section className="mw-sec">
          <h2 className="h-sub mb-3.5">Private AI record</h2>
          <div className="card card-pad">
            <dl className="kv text-sm">
              <Item k="Engine" v={j.judge.engine === "0g-tee" ? "0G Private Computer (TEE)" : j.judge.engine === "heuristic" ? "Offline rules" : "Local model"} />
              {j.judge.model && <Item k="Model" v={j.judge.model} />}
              {j.judge.provider && <Item k="Provider" v={j.judge.provider} mono />}
              {j.judge.requestId && <Item k="Request id" v={j.judge.requestId} mono />}
              {j.judge.trustMode && <Item k="Trust mode" v={j.judge.trustMode} />}
              {j.judge.sealed !== undefined && <Item k="Sealed end to end" v={j.judge.sealed ? "yes" : "no"} />}
              {j.judge.teeVerified !== undefined && <Item k="Router checked TEE signature" v={j.judge.teeVerified ? "yes" : "no"} />}
              {j.judge.selfVerified !== undefined && <Item k="We checked TEE signature" v={j.judge.selfVerified ? "yes" : "no"} />}
              {j.judge.payer && <Item k="Paid by" v={j.judge.payer === "app key" ? "the app's own 0G key" : `your 0G account ${j.judge.payer}`} />}
              {j.judge.costUsd !== undefined && <Item k="Cost of this call" v={`$${j.judge.costUsd.toFixed(4)}`} />}
              {j.judge.requestHash && <Item k="Hash of what was sent" v={shortHash(j.judge.requestHash, 10)} mono />}
              {j.judge.responseHash && <Item k="Hash of the answer" v={shortHash(j.judge.responseHash, 10)} mono />}
            </dl>
            <p className="help">
              The private AI sees trimmed prompts, the AI&apos;s last answers, a tool-use summary, the GitHub outcome and the cost. Only the category,
              title, difficulty, a generic reason and these hashes are kept. The prompts are never written anywhere.
            </p>
          </div>
          {j.judge.engine === "0g-tee" && (
            <ProofLinks
              className="mt-8"
              groups={[
                {
                  service: "0G",
                  what: `This call ran on 0G in a hardware enclave${j.judge.requestId ? `; look for request ${j.judge.requestId.slice(0, 8)}… in your activity` : ""}`,
                  links: [
                    ...(j.judge.provider ? [{ label: "0G's TEE check of the provider", href: zgProofPath(j.judge.provider) }] : []),
                    ...(j.judge.payer && j.judge.payer !== "app key" ? [{ label: "Your calls on pc.0g.ai", href: ZG_ACTIVITY }] : []),
                  ],
                },
              ]}
            />
          )}
        </section>
      )}
    </div>
  );
}

function Item({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <>
      <dt>{k}</dt>
      <dd className={mono ? "mono" : "num"}>{v}</dd>
    </>
  );
}
