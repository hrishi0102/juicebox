import { CategoryLegend } from "@/components/category-badge";
import { ARKIV_SCHEMA_NAME } from "@/lib/receipts/arkiv";

const STEPS = [
  {
    t: "Read your logs",
    d: "Claude Code and Codex already keep a log of every session on your laptop. Receipts reads them there, prices every AI call from its token counts (checked against Claude Code's own cost tracker), and keeps the results in ~/.receipts. Nothing leaves your laptop for this step.",
  },
  {
    t: "Link the work",
    d: "With your own GitHub token, it finds the pull requests and commits each session turned into: from the PR links and commits in the log, the branch, and files edited around the same time. It also notes what happened to them: merged, open, closed or reverted.",
  },
  {
    t: "Write what you got",
    d: "Only when you click Write my week. Each session goes to a private AI on 0G that runs inside a hardware enclave (TEE): what you asked, what the AI said at the end, tool counts, the GitHub outcome and the cost. It answers with one line: a category and a short title. One more call sees only those lines and merges them into your list, with one sentence about the week. Without a 0G key, simple rules write the list instead.",
  },
  {
    t: "Share it for fun",
    d: "Pick the lines you want, edit the wording, and download a card for X, LinkedIn or your team chat, or save it as a PDF. Cost is hidden unless you turn it on. The card is drawn on your laptop. If you want a link, Get a Swarm link stores it on Swarm and puts it on the wall.",
  },
  {
    t: "Share it with your company",
    d: "Sign the week with a key made on your laptop (no wallet needed). The signature covers the list, the pull requests and every number, so nobody can change them later. Sharing writes your signed totals to Arkiv as a read-only record that you own, under your GitHub org and team. The list and pull requests go to Swarm, encrypted on your laptop, and only your company's key can open them.",
  },
];

const FLOWS: [string, string, string][] = [
  ["Raw logs and prompts", "Nowhere. They stay in ~/.claude and ~/.codex on your laptop.", "Only you"],
  ["Session titles, file names, folders", "A local file in ~/.receipts, outside any repo", "Only you"],
  [
    "One session's trimmed prompts and the AI's last answers, when you click Write my week",
    "0G Private Computer in private mode: only models running inside a TEE can answer, and the TEE signature of every answer is checked",
    "The model inside a TEE. It reaches it over HTTPS through 0G's router, which is not end-to-end sealed today, so 0G's router could read it in transit",
  ],
  ["The list's titles, for the weekly summary", "The same private 0G model", "The same: the model in a TEE, and 0G's router in transit"],
  ["PR numbers and repo names", "GitHub API, with your own token", "GitHub (it already has them)"],
  ["The share card", "Nowhere, unless you post it", "Whoever you show it to"],
  ["A card you make public with Get a Swarm link", "Swarm, listed on Arkiv and shown on the wall", "Anyone"],
  ["Your signed totals, when you share with your company", `Arkiv testnet, schema ${ARKIV_SCHEMA_NAME}, read-only and owned by you`, "Anyone. That is the point of sharing"],
  ["Your list, PRs and AI records, when you share with your company", "Swarm testnet, encrypted on your laptop; the key is sealed to your company's key on Arkiv", "Your company"],
];

export default function How() {
  return (
    <div className="max-w-4xl space-y-14">
      <section>
        <h1 className="text-balance text-4xl font-semibold tracking-tight">What did you get done this week?</h1>
        <p className="mt-4 max-w-[68ch] text-lg text-muted-foreground">
          AI tools make it easy to spend a lot and hard to say what came out of it. Token leaderboards reward burning tokens, not getting things done.
          Receipts reads your AI sessions on your laptop and answers the question for you: what you built, fixed, figured out and researched, and what
          it cost. You can post it for fun, or sign it and share it with your company. Your raw logs never leave your laptop; only a trimmed summary
          of each session goes to 0G&apos;s private AI, and only when you ask.
        </p>
      </section>

      <section aria-labelledby="steps">
        <h2 id="steps" className="text-2xl font-semibold tracking-tight">
          How it works
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

      <section aria-labelledby="cats">
        <h2 id="cats" className="text-2xl font-semibold tracking-tight">
          The categories
        </h2>
        <div className="mt-4">
          <CategoryLegend />
        </div>
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

      <section aria-labelledby="why" className="grid gap-8 sm:grid-cols-2">
        <h2 id="why" className="sr-only">
          Why each piece is there
        </h2>
        <div>
          <h3 className="font-semibold">Why 0G</h3>
          <p className="mt-1 text-muted-foreground">
            To say what you got, an AI has to read what you asked. We never send prompts to a normal AI API. 0G&apos;s private computer runs the model
            inside a TEE and signs every answer. You can pay with the app&apos;s key or sign in with 0G and use your own credits.
          </p>
        </div>
        <div>
          <h3 className="font-semibold">Why signatures</h3>
          <p className="mt-1 text-muted-foreground">
            The receipt is your evidence at review time. Your signature means nobody, including your manager or us, can change the list or the numbers
            after the fact. You can keep single items private; they still count in the signed totals.
          </p>
        </div>
        <div>
          <h3 className="font-semibold">Why Arkiv</h3>
          <p className="mt-1 text-muted-foreground">
            Shared weeks need a place the company can query that belongs neither to a company tool nor to us. Each record is read-only, owned by the
            person who signed it, and expires on its own.
          </p>
        </div>
        <div>
          <h3 className="font-semibold">Why Swarm</h3>
          <p className="mt-1 text-muted-foreground">
            Arkiv is public, and work titles can name customers or unreleased features. So the details go to Swarm, encrypted on your laptop, and only
            your company&apos;s key can open them, while everyone can still check the signed totals. Public cards live on Swarm too, so their links never
            depend on us.
          </p>
        </div>
      </section>
    </div>
  );
}
