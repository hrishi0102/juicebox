import Link from "next/link";
import { CategoryLegend } from "@/components/category-badge";
import { LeavesLaptop } from "@/components/leaves-laptop";
import { StepIllo } from "@/components/week-steps";

export const metadata = { title: "How it works · Juicebox" };

const EMPLOYEE: [string, string][] = [
  [
    "Set up once",
    "Run Juicebox on your laptop. Connect GitHub (the GitHub CLI you already use), join your company (your GitHub org and team), sign in with 0G, and let it read your Claude Code and Codex logs. Reading logs never leaves the laptop.",
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
  ["Set up once", "A wallet that pays the small Arkiv fee for each receipt, a company key that opens the lists, Swarm for storage, and GitHub sign-in for leads. Then invite people to run Juicebox on their laptops."],
  ["Sign in with GitHub", "Leads and managers sign in with GitHub. Only members of the org can open the lists; anyone can check the signed totals."],
  ["See everyone's week", "What the company got done, team by team; each person's signed list with the pull requests behind it; every pull request and where the AI money went. People are never ranked."],
];

const ILLO: Record<string, "write" | "sign" | "send"> = { Write: "write", Sign: "sign", Send: "send" };

export default function How() {
  return (
    <div className="fd pb-4">
      <section className="fd-wrap pt-14 max-[760px]:pt-8" aria-labelledby="how-h">
        <h1 id="how-h" className="disp h-hero max-w-[16ch]">
          What did your AI spend get done?
        </h1>
        <p className="fd-lede">
          AI tools make it easy to spend a lot and hard to say what came out of it, and token leaderboards reward burning tokens, not getting things done.
          Juicebox has two sides. Each employee runs it on their laptop and sends a signed weekly receipt of what their AI sessions got done. The company
          sees everyone&apos;s receipts, with the pull requests behind them. Prompts never leave the laptop.
        </p>
      </section>

      <Steps id="employee" title="For employees, on your laptop" lede="Set up once, then every week takes three steps." steps={EMPLOYEE} link={{ href: "/me", label: "Open my week" }} />
      <Steps id="company" title="For the company" lede="Leads and managers see everyone's signed week. People are never ranked." steps={COMPANY} illos={false} link={{ href: "/company", label: "Open the company page" }} />

      <section className="fd-sec" aria-labelledby="who">
        <div className="fd-wrap">
          <div className="fd-sec-head">
            <h2 id="who" className="disp h-sec">
              One identity, one way to pay
            </h2>
            <p>GitHub says who you are, your 0G account pays for the private AI, and a key on your laptop signs.</p>
          </div>
          <div className="fd-leaves">
            <div className="fd-leave">
              <h3 className="fd-leave-h">GitHub is who you are</h3>
              <p className="text-[var(--ink-2)]! text-base!">
                Employees use the GitHub login their laptop already has; leads sign in with GitHub on the company page. Your company is your GitHub org, your
                team is your GitHub team.
              </p>
            </div>
            <div className="fd-leave">
              <h3 className="fd-leave-h">Your 0G account pays for the private AI</h3>
              <p className="text-[var(--ink-2)]! text-base!">Sign in with 0G, and every private AI call is paid from your own 0G credits. Nobody hands out an AI key.</p>
            </div>
            <div className="fd-leave">
              <h3 className="fd-leave-h">Your laptop key signs your receipt</h3>
              <p className="text-[var(--ink-2)]! text-base!">It is made the first time you sign and never leaves the laptop. A wallet works too.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="fd-sec" aria-labelledby="cats">
        <div className="fd-wrap">
          <div className="fd-sec-head">
            <h2 id="cats" className="disp h-sec">
              The categories
            </h2>
            <p>The private AI puts each session in one of these. The receipt adds up what each one cost.</p>
          </div>
          <div className="card card-pad">
            <CategoryLegend />
          </div>
        </div>
      </section>

      <section className="fd-sec" aria-labelledby="leaves">
        <div className="fd-wrap">
          <div className="fd-sec-head">
            <h2 id="leaves" className="disp h-sec">
              What leaves your laptop
            </h2>
            <p>Very little, and each piece has one reader. Here is the same week, seen three ways, then every piece in full.</p>
          </div>
          <LeavesLaptop tableOpen />
        </div>
      </section>

      <section className="fd-sec" aria-labelledby="fun">
        <div className="fd-wrap">
          <div className="fd-monthly">
            <span className="svc">Just for fun</span>
            <p>
              <span className="font-semibold text-[var(--ink)]">AI Wrapped</span> is a separate page for anyone, coder or not: how you talk to AI (overthinking,
              therapy sessions, just saying hi) and your AI personality, from your logs or a ChatGPT or Claude.ai export read in your browser. Share it as a
              card with numbers only. It has nothing to do with receipts and never goes to a company.
            </p>
            <span className="inline-flex flex-wrap items-baseline gap-x-2">
              <Link href="/wrapped" className="plink" id="fun">
                Open AI Wrapped
              </Link>
              <span className="host">Opens here</span>
            </span>
          </div>
        </div>
      </section>

      <section className="fd-sec" aria-labelledby="why">
        <div className="fd-wrap">
          <div className="fd-sec-head">
            <h2 id="why" className="disp h-sec">
              Why each piece is there
            </h2>
            <p>Each one does a job nothing else in the stack can do.</p>
          </div>
          <ul className="fd-proofs">
            <Why name="0G" text="To say what you got done, an AI has to read what you asked. We never send prompts to a normal AI API. 0G's private computer runs the model inside a TEE and signs every answer, and you pay for it from your own 0G account." />
            <Why name="Signatures" text="The receipt is your evidence at review time. Your signature means nobody, including your manager or us, can change the list or the numbers after the fact. You can keep single lines private; they still count in the signed totals." />
            <Why name="Arkiv" text="Shared weeks need a place the company can query that belongs neither to a company tool nor to us. Each record is read-only, owned by the person who signed it, and expires on its own." />
            <Why name="Swarm" text="Arkiv is public, and work titles can name customers or unreleased features. So the details go to Swarm, encrypted on your laptop, and only your company's key can open them, while everyone can still check the signed totals." />
          </ul>
        </div>
      </section>
    </div>
  );
}

function Steps({ id, title, lede, steps, link, illos = true }: { id: string; title: string; lede: string; steps: [string, string][]; link: { href: string; label: string }; illos?: boolean }) {
  return (
    <section className="fd-sec" aria-labelledby={id}>
      <div className="fd-wrap">
        <div className="fd-sec-head">
          <h2 id={id} className="disp h-sec">
            {title}
          </h2>
          <p>{lede}</p>
        </div>
        <ol className="fd-steps how-steps">
          {steps.map(([t, d], i) => (
            <li key={t} className="fd-step">
              {illos && (ILLO[t] ? <StepIllo kind={ILLO[t]} /> : <div className="fd-illo how-illo-blank" aria-hidden="true" />)}
              <h3 className="disp h-card">
                <span className="num-k">{i + 1}</span>
                {t}
              </h3>
              <p>{d}</p>
            </li>
          ))}
        </ol>
        <Link href={link.href} className="btn btn-primary mt-8">
          {link.label}
        </Link>
      </div>
    </section>
  );
}

function Why({ name, text }: { name: string; text: string }) {
  return (
    <li className="fd-proof">
      <span className="svc">{name}</span>
      <p className="mb-0!">{text}</p>
    </li>
  );
}
