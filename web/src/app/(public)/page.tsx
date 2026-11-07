import Link from "next/link";
import { ArrowUpRight, Lock } from "lucide-react";
import { arkivWriterAddress } from "@/lib/receipts/arkiv";
import { arkivAddressUrl, CRE_SCOREBOARD, DEMO_SEALED, sepoliaAddressUrl, swarmProofPath, zgProofPath } from "@/lib/proof-urls";
import { providersFor } from "@/lib/server/zerog-providers";
import { FrontNav, HeroReceipt } from "@/components/front-door";
import { REPO } from "@/components/repo";
import { LeavesLaptop } from "@/components/leaves-laptop";
import { DemoRolesBand } from "@/components/demo-roles-band";
import { StepIllo } from "@/components/week-steps";
import { ProofAnchor } from "@/components/proof-links";
import { Logo } from "@/components/space-header";

// The front door. Two sides of one product (the company, and each employee on their laptop), one
// side product for anyone (AI Wrapped), the demo company to look around, and what it runs on, each
// with a live place to check it.
export default async function FrontDoor() {
  const [provider] = await providersFor();
  const writer = arkivWriterAddress();
  return (
    <div className="fd">
      <FrontNav />
      <main>
        <section className="fd-hero" aria-labelledby="hero-h">
          <div className="fd-wrap fd-hero-grid">
            <div>
              <h1 id="hero-h" className="disp h-hero">
                What did your AI get done this week?
              </h1>
              <p className="fd-lede">
                Everyone is token maxing. Nobody can say what it bought. Juicebox turns your Claude Code and Codex sessions into a weekly receipt: what you
                built, fixed and figured out, and what each one cost. Your team sees the work behind the tokens, not just the bill.
              </p>
              <div className="fd-ctas">
                <a className="btn btn-primary btn-lg" href="#demo">
                  Try the demo company
                </a>
                <a className="btn btn-secondary btn-lg" href={REPO} target="_blank" rel="noreferrer">
                  Run it on your laptop
                  <ArrowUpRight className="size-4" aria-hidden="true" />
                </a>
              </div>
              <ul className="fd-facts">
                <li>
                  <Lock className="size-4" aria-hidden="true" />
                  Your prompts never leave the laptop.
                </li>
              </ul>
            </div>
            <HeroReceipt barcodeHex={DEMO_SEALED.entity} />
          </div>
        </section>

        <section className="fd-sec" aria-labelledby="sides-h">
          <div className="fd-wrap">
            <div className="fd-sec-head">
              <h2 id="sides-h" className="disp h-sec">
                One receipt, two sides
              </h2>
              <p>The person who did the work writes and signs it. The company reads it. After that, nobody can change it, not the company and not us.</p>
            </div>
            <div className="fd-ticket">
              <div className="fd-half">
                <span className="fd-who">On your laptop</span>
                <h3 className="disp h-card">For engineers: send your weekly receipt</h3>
                <p>A private AI on 0G writes your week from your sessions, paid from your own 0G credits. You check it, sign the whole receipt and send it to your team.</p>
                <ol className="mini-steps" aria-label="Every week">
                  <li>
                    <span className="n">1</span>Write
                  </li>
                  <li>
                    <span className="n sign">2</span>Sign
                  </li>
                  <li>
                    <span className="n">3</span>Send
                  </li>
                </ol>
                <Link className="btn btn-primary" href="/me">
                  Open my week
                </Link>
              </div>
              <div className="fd-perf" aria-hidden="true" />
              <div className="fd-half">
                <span className="fd-who">For leads and managers</span>
                <h3 className="disp h-card">For companies: see what everyone got done</h3>
                <p>
                  Everyone&apos;s signed week, by team and by person, with the pull requests behind it and where the AI money went. Leads sign in with GitHub.
                  Your company is your GitHub org.
                </p>
                <ol className="mini-steps" aria-label="For companies">
                  <li>
                    <span className="n">1</span>Set up once
                  </li>
                  <li>
                    <span className="n">2</span>Sign in with GitHub
                  </li>
                  <li>
                    <span className="n">3</span>See everyone&apos;s week
                  </li>
                </ol>
                <Link className="btn btn-primary" href="/company">
                  Open the company page
                </Link>
              </div>
            </div>
            <div className="fd-monthly">
              <span className="svc">Just for fun</span>
              <p>AI Wrapped: how you talk to AI, for anyone. Nothing to do with receipts, never sent to a company.</p>
              <ProofAnchor href="/wrapped">Open AI Wrapped</ProofAnchor>
            </div>
          </div>
        </section>

        <section id="how" className="fd-sec scroll-mt-4" aria-labelledby="how-h">
          <div className="fd-wrap">
            <div className="fd-sec-head">
              <h2 id="how-h" className="disp h-sec">
                How a week works
              </h2>
              <p>
                Set up once on your laptop: connect GitHub, join your company, sign in with 0G and let Juicebox read your Claude Code and Codex logs. Then
                every week takes three steps.
              </p>
            </div>
            <ol className="fd-steps">
              <li className="fd-step">
                <StepIllo kind="write" />
                <h3 className="disp h-card">
                  <span className="num-k">1</span>Write
                </h3>
                <p>The private AI on 0G reads a trimmed summary of each session and writes one line for each thing you got done. It costs about a cent a week, from your own 0G credits.</p>
              </li>
              <li className="fd-step">
                <StepIllo kind="sign" />
                <h3 className="disp h-card">
                  <span className="num-k">2</span>Sign
                </h3>
                <p>You read it and sign it with a key made on your laptop. The signature covers every line, the pull requests and every number. The whole week goes, nothing is picked out.</p>
              </li>
              <li className="fd-step">
                <StepIllo kind="send" />
                <h3 className="disp h-card">
                  <span className="num-k">3</span>Send
                </h3>
                <p>It becomes one read-only record on Arkiv that you own. The full list goes to Swarm, encrypted on your laptop, so only your company&apos;s key opens it.</p>
              </li>
            </ol>
            <div className="fd-monthly">
              <span className="svc">Chainlink</span>
              <p>
                And once a month, Chainlink checks each team on its own: every signature, the signed totals, and whether what shipped is still there. The
                score goes on Ethereum Sepolia, where nobody can change it.
              </p>
              <ProofAnchor href="/company/team">See a team&apos;s monthly check</ProofAnchor>
            </div>
            <p className="mt-6 text-[15px] text-[var(--ink-2)]">
              <Link className="plink" href="/how">
                The whole story, step by step
              </Link>{" "}
              <span className="host">Opens here</span>
            </p>
          </div>
        </section>

        <section className="fd-sec" aria-labelledby="leaves-h">
          <div className="fd-wrap">
            <div className="fd-sec-head">
              <h2 id="leaves-h" className="disp h-sec">
                What leaves your laptop
              </h2>
              <p>Very little, and each piece has one reader. Here is the same week, seen three ways.</p>
            </div>
            <LeavesLaptop />
          </div>
        </section>

        <section className="fd-sec" aria-labelledby="runs-h">
          <div className="fd-wrap fd-runs">
            <div className="fd-runs-intro">
              <h2 id="runs-h" className="disp h-sec">
                What it runs on, and where to check it
              </h2>
              <p>You do not have to trust us. Each piece has a public place where you can see it working.</p>
              <p className="fd-check-line">
                Got a receipt file or link? <ProofAnchor href="/verify">Check a receipt</ProofAnchor>
              </p>
            </div>
            <ul className="fd-proofs">
              <Service name="0G" body="A private AI in a hardware enclave reads each session and writes the week, paid from the employee's own 0G credits." href={provider ? zgProofPath(provider) : undefined} label="0G's TEE check of the provider" />
              <Service
                name="Arkiv"
                body="Every receipt sent is a read-only record on Arkiv, owned by the person who signed it. The company wallet only pays the fee."
                href={writer ? arkivAddressUrl(writer) : undefined}
                label="Every record it wrote, on the Arkiv explorer"
              />
              <Service name="Swarm" body="Each week's full list is encrypted on the laptop and kept on Swarm, where only the company's key opens it." href={swarmProofPath(DEMO_SEALED.swarm, DEMO_SEALED.entity)} label="One encrypted week, fetched live" />
              <Service
                name="Chainlink"
                body="Once a month, a Chainlink CRE workflow reads each team's receipts from Arkiv, checks every signature, re-checks on GitHub that what shipped is still there and writes the score to Ethereum Sepolia. Only Chainlink can post it."
                href={`${sepoliaAddressUrl(CRE_SCOREBOARD.address)}#events`}
                label="Every score on Sepolia Etherscan"
              />
              <Service name="GitHub" body="Your company is your GitHub org and your team is your GitHub team. All of the code is open." href={REPO} label="The code on GitHub" />
            </ul>
          </div>
        </section>

        <DemoRolesBand id="demo" />
      </main>

      <footer className="fd-foot">
        <div className="fd-wrap fd-foot-in">
          <Link className="t-logo" href="/" aria-label="Juicebox, front door">
            <Logo />
            <span className="t-logo-word">Juicebox</span>
          </Link>
          <p>Built at ETHGlobal Mumbai, November 2026. Testnets only.</p>
          <nav aria-label="Footer">
            <a href="#how">How it works</a>
            <Link href="/verify">Check a receipt</Link>
            <Link href="/wrapped">AI Wrapped</Link>
            <a href={REPO} target="_blank" rel="noreferrer">
              GitHub
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}

function Service({ name, body, href, label }: { name: string; body: string; href?: string; label: string }) {
  return (
    <li className="fd-proof">
      <span className="svc">{name}</span>
      <div>
        <p>{body}</p>
        {href && <ProofAnchor href={href}>{label}</ProofAnchor>}
      </div>
    </li>
  );
}
