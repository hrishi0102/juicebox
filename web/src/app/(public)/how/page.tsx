import Link from "next/link";
import { CategoryLegend } from "@/components/category-badge";
import { ARKIV_SCHEMA_NAME } from "@/lib/receipts/arkiv";

export const metadata = { title: "How it works · Receipts" };

const EMPLOYEE: [string, string][] = [
  [
    "Set up once",
    "Run Receipts on your laptop. Connect GitHub (the GitHub CLI you already use), join your company (your GitHub org and team), sign in with 0G, and let it read your Claude Code and Codex logs. Reading logs never leaves the laptop.",
  ],
  [
    "Write",
    "Write my week sends each session to a private AI on 0G, which runs inside a hardware enclave (TEE): what you asked, what the AI said at the end, tool counts, the GitHub outcome and the cost. It answers with one line, a category and a short title. One more call sees only those lines and merges them into your list. It is paid from your own 0G account, about a cent a week, and you see your credits go down.",
  ],
  ["Sign", "Look at the receipt and sign it with a key made on your laptop (no wallet needed). The signature covers every line, the pull requests and every number, so nobody can change them later. The whole week goes; nothing is picked out."],
  [
    "Send",
    "One read-only Arkiv record that you own, under your GitHub org and team, with your signed totals. The list and pull requests go to Swarm, encrypted on your laptop, and only your company's key opens them.",
  ],
];

const COMPANY: [string, string][] = [
  ["Set up once", "A wallet that pays the small Arkiv fee for each receipt, a company key that opens the lists, Swarm for storage, and GitHub sign-in for leads. Then invite people to run Receipts on their laptops."],
  ["Sign in with GitHub", "Leads and managers sign in with GitHub. Only members of the org can open the lists; anyone can check the signed totals."],
  ["See everyone's week", "What the company got done, team by team; each person's signed list with the pull requests behind it; every pull request and where the AI money went. People are never ranked."],
];

const FLOWS: [string, string, string][] = [
  ["Raw logs and prompts", "Nowhere. They stay in ~/.claude and ~/.codex on your laptop.", "Only you"],
  ["Session titles, file names, folders", "A local file in ~/.receipts, outside any repo", "Only you"],
  [
    "One session's trimmed prompts and the AI's last answers, when you click Write my week",
    "0G Private Computer in private mode, paid from your own 0G account: only models running inside a TEE can answer, and the TEE signature of every answer is checked",
    "The model inside a TEE. It reaches it over HTTPS through 0G's router, which is not end-to-end sealed today, so 0G's router could read it in transit",
  ],
  ["The list's titles, for the weekly summary", "The same private 0G model", "The same: the model in a TEE, and 0G's router in transit"],
  ["PR numbers and repo names", "GitHub API, with your own token", "GitHub (it already has them)"],
  ["Your signed totals, when you send your receipt", `Arkiv testnet, schema ${ARKIV_SCHEMA_NAME}, read-only and owned by you`, "Anyone. That is the point: the numbers can be checked"],
  ["Your list, PRs and AI records, when you send your receipt", "Swarm testnet, encrypted on your laptop; the key is sealed to your company's key on Arkiv", "Your company"],
  ["Your AI Wrapped card (numbers only)", "Nowhere, unless you post it", "Whoever you show it to"],
];

export default function How() {
  return (
    <div className="max-w-4xl space-y-14">
      <section>
        <h1 className="text-balance text-4xl font-semibold tracking-tight">What did your AI spend get done?</h1>
        <p className="mt-4 max-w-[68ch] text-lg text-muted-foreground">
          AI tools make it easy to spend a lot and hard to say what came out of it, and token leaderboards reward burning tokens, not getting things
          done. Receipts has two sides. Each employee runs it on their laptop and sends a signed weekly receipt of what their AI sessions got done. The
          company sees everyone&apos;s receipts, with the pull requests behind them. Prompts never leave the laptop.
        </p>
      </section>

      <Steps id="employee" title="For employees, on your laptop" steps={EMPLOYEE} link={{ href: "/me", label: "Open my week" }} />
      <Steps id="company" title="For the company" steps={COMPANY} link={{ href: "/company", label: "Open the company page" }} />

      <section aria-labelledby="who">
        <h2 id="who" className="text-2xl font-semibold tracking-tight">
          One identity, one way to pay
        </h2>
        <ul className="mt-4 max-w-[68ch] list-disc space-y-2 pl-5 text-muted-foreground">
          <li>
            <span className="font-medium text-foreground">GitHub is who you are.</span> Employees use the GitHub login their laptop already has; leads
            sign in with GitHub on the company page. Your company is your GitHub org, your team is your GitHub team.
          </li>
          <li>
            <span className="font-medium text-foreground">Your 0G account pays for the private AI.</span> Sign in with 0G, and every private AI call is
            paid from your own 0G credits. Nobody hands out an AI key.
          </li>
          <li>
            <span className="font-medium text-foreground">Your laptop key signs your receipt.</span> It is made the first time you sign and never leaves
            the laptop. A wallet works too.
          </li>
        </ul>
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

      <section aria-labelledby="fun">
        <h2 id="fun" className="text-2xl font-semibold tracking-tight">
          Just for fun: AI Wrapped
        </h2>
        <p className="mt-2 max-w-[68ch] text-muted-foreground">
          A separate page for anyone, coder or not: how you talk to AI (overthinking, therapy sessions, just saying hi) and your AI personality, from your
          logs or a ChatGPT or Claude.ai export read in your browser. Share it as a card with numbers only. It has nothing to do with receipts and never
          goes to a company.{" "}
          <Link href="/wrapped" className="text-primary hover:underline">
            Open AI Wrapped
          </Link>
        </p>
      </section>

      <section aria-labelledby="why" className="grid gap-8 sm:grid-cols-2">
        <h2 id="why" className="sr-only">
          Why each piece is there
        </h2>
        <div>
          <h3 className="font-semibold">Why 0G</h3>
          <p className="mt-1 text-muted-foreground">
            To say what you got done, an AI has to read what you asked. We never send prompts to a normal AI API. 0G&apos;s private computer runs the
            model inside a TEE and signs every answer, and you pay for it from your own 0G account.
          </p>
        </div>
        <div>
          <h3 className="font-semibold">Why signatures</h3>
          <p className="mt-1 text-muted-foreground">
            The receipt is your evidence at review time. Your signature means nobody, including your manager or us, can change the list or the numbers
            after the fact. You can keep single lines private; they still count in the signed totals.
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
            your company&apos;s key can open them, while everyone can still check the signed totals.
          </p>
        </div>
      </section>
    </div>
  );
}

function Steps({ id, title, steps, link }: { id: string; title: string; steps: [string, string][]; link: { href: string; label: string } }) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="text-2xl font-semibold tracking-tight">
        {title}
      </h2>
      <ol className="mt-6 space-y-6">
        {steps.map(([t, d], i) => (
          <li key={t} className="grid grid-cols-[2.5rem_1fr] gap-x-4">
            <span className="text-2xl font-semibold text-primary">{i + 1}</span>
            <div>
              <h3 className="text-lg font-semibold">{t}</h3>
              <p className="mt-1 max-w-[68ch] text-muted-foreground">{d}</p>
            </div>
          </li>
        ))}
      </ol>
      <Link href={link.href} className="mt-6 inline-block text-sm font-medium text-primary hover:underline">
        {link.label}
      </Link>
    </section>
  );
}
