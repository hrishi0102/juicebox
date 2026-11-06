import { LabelBadge } from "@/components/label-badge";
import { LABEL_COPY, LABEL_ORDER } from "@/lib/format";
import { ARKIV_SCHEMA_NAME } from "@/lib/receipts/arkiv";

const STEPS = [
  {
    t: "Cost",
    d: "Read Claude Code's own logs in ~/.claude/projects, including subagents. Each API call is priced from its token counts (cache reads, 5 minute and 1 hour cache writes, fast mode) and checked against Claude Code's own cost tracker.",
  },
  {
    t: "Outcome",
    d: "Ask GitHub what happened to the work: merged, still open, closed, or reverted later. For merged work, run blame on the base branch 30 days after the merge and count how many added lines are still there.",
  },
  {
    t: "Match",
    d: "Link sessions to pull requests by the PR links and commits Claude Code recorded, the branch the session worked on, and files edited around the same time. Each link keeps its reason and a confidence.",
  },
  {
    t: "Judge",
    d: "Label every session as Shipped, Learned, Looped, Abandoned or Overkill and rate its difficulty. Offline rules always run. The private judge on 0G reads the trimmed prompts inside a hardware enclave and does better.",
  },
  {
    t: "Score",
    d: "Kept work: each shipped task counts as the share of its code still alive. Cost per kept task is only compared between tasks of the same difficulty, never across people.",
  },
  {
    t: "Sign and share",
    d: "You sign the weekly receipt with your own key. It is yours to keep as evidence. Sharing writes it, with the list of pull requests it paid for, to Arkiv, where your team and company can read it.",
  },
];

const FLOWS: [string, string, string][] = [
  ["Raw logs and prompts", "Nowhere. They stay in ~/.claude on your laptop.", "Only you"],
  ["Session titles, file names, folders", "A local file in ~/.receipts, outside any repo", "Only you"],
  ["Trimmed prompts of one session, when you ask the private judge", "0G Private Computer, private mode: only models running inside a TEE, sealed end to end", "The enclave. The router sees model, size and timing"],
  ["PR numbers and repo names", "GitHub API, with your own token", "GitHub (it already has them)"],
  ["Signed weekly totals, when you share", `Arkiv testnet, schema ${ARKIV_SCHEMA_NAME}`, "Anyone. That is the point of sharing"],
  ["PR titles, links and the AI cost of each, when you share", "Arkiv, inside the same signed receipt", "Anyone"],
];

export default function How() {
  return (
    <div className="max-w-4xl space-y-14">
      <section>
        <h1 className="text-4xl font-semibold tracking-tight">Receipts, not leaderboards.</h1>
        <p className="mt-4 max-w-[68ch] text-lg text-muted-foreground">
          Companies hand out big AI budgets and then rank people by tokens burned. Those leaderboards get gamed, and tokens are a small part of what a
          pull request costs anyway. Receipts shows what the spend bought, where it leaked, and lets each engineer own the evidence.
        </p>
      </section>

      <section aria-labelledby="steps">
        <h2 id="steps" className="text-2xl font-semibold tracking-tight">
          How a receipt gets made
        </h2>
        <ol className="mt-6 space-y-6">
          {STEPS.map((s, i) => (
            <li key={s.t} className="grid grid-cols-[2.5rem_1fr] gap-x-4">
              <span className="text-2xl font-semibold text-primary">{i + 1}</span>
              <div>
                <h3 className="text-lg font-semibold">{s.t}</h3>
                <p className="mt-1 max-w-[68ch] text-muted-foreground">{s.d}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="labels">
        <h2 id="labels" className="text-2xl font-semibold tracking-tight">
          The labels
        </h2>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          {LABEL_ORDER.map((l) => (
            <div key={l} className="flex items-start gap-3">
              <dt className="w-28 shrink-0">
                <LabelBadge label={l} />
              </dt>
              <dd className="text-muted-foreground">{LABEL_COPY[l].hint}.</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="leaves">
        <h2 id="leaves" className="text-2xl font-semibold tracking-tight">
          What leaves your laptop
        </h2>
        <div className="mt-4 overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-border text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-normal">Data</th>
                <th className="px-4 py-2.5 font-normal">Where it goes</th>
                <th className="px-4 py-2.5 font-normal">Who can read it</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {FLOWS.map(([a, b, c]) => (
                <tr key={a} className="align-top">
                  <td className="px-4 py-3 font-medium">{a}</td>
                  <td className="px-4 py-3">{b}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="why" className="grid gap-8 sm:grid-cols-3">
        <h2 id="why" className="sr-only">
          Why each piece is there
        </h2>
        <div>
          <h3 className="font-semibold">Why 0G</h3>
          <p className="mt-1 text-muted-foreground">
            A useful judge has to read your prompts. We never send them to a normal AI API. Without 0G&apos;s private computer there is no AI judge,
            only rules that cannot tell a dead end from real learning.
          </p>
        </div>
        <div>
          <h3 className="font-semibold">Why signatures</h3>
          <p className="mt-1 text-muted-foreground">
            The receipt is your evidence at review time. Your signature means nobody, including your manager or us, can change the numbers after the
            fact.
          </p>
        </div>
        <div>
          <h3 className="font-semibold">Why Arkiv</h3>
          <p className="mt-1 text-muted-foreground">
            Shared receipts need a place the team can query that does not belong to the company tool or to us. Entities expire, so old receipts do
            not hang around forever.
          </p>
        </div>
      </section>
    </div>
  );
}
