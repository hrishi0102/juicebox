import { ShieldCheck } from "lucide-react";
import { shortAddr, shortHash, usd } from "@/lib/format";
import { sepoliaAddressUrl, sepoliaTxUrl } from "@/lib/proof-urls";
import type { TeamCheck } from "@/lib/server/scoreboard";
import { RunChainlinkCheck } from "@/components/run-chainlink-check";
import { ProofAnchor } from "@/components/proof-links";
import { REPO } from "@/components/repo";

/** The team's latest monthly check, as written on Ethereum Sepolia by the Chainlink CRE workflow. */
export function ChainlinkCheck({ check, team, company, demo, canRun }: { check: TeamCheck; team: string; company: string; demo: boolean; canRun: boolean }) {
  const when = check.postedAt.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
  const rows: [string, string][] = [
    ["Signed weeks counted", `${check.receipts} from ${check.people} ${check.people === 1 ? "person" : "people"}`],
    ["Signatures that failed", check.rejected ? `${check.rejected} (left out)` : "none"],
    ["AI spend", usd(check.spendCents / 100)],
    ["Things done", String(check.done)],
    ["Went in circles", usd(check.wastedCents / 100)],
    ["Shipped, as signed", `${check.mergedPrs} (merged PRs and pushes to main)`],
    ["Re-checked on GitHub", check.prsChecked ? `${check.prsStillMerged} of ${check.prsChecked} still merged or on main` : "nothing public to check"],
  ];
  const day = check.postedAt.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return (
    <section aria-labelledby="chainlink-check" className="cl">
      <div className="cl-grid">
        <div className="cl-main">
          <span className="cl-pill">
            <ShieldCheck className="size-3.5" aria-hidden="true" /> Chainlink CRE
          </span>
          <h2 id="chainlink-check" className="disp mt-3.5 text-[36px] max-[760px]:text-[28px]">
            Checked by Chainlink, once a month
          </h2>
          <p className="cl-body">
            On {when}, a Chainlink CRE workflow read {team}&apos;s receipts straight from Arkiv, checked every signature, added up the signed numbers and
            asked GitHub whether what shipped is still there (each merged PR still merged, each push to main still in main&apos;s history), then wrote the
            result on Ethereum Sepolia.
          </p>
          <p className="cl-body">
            <b>Nobody can post or change a score, not even {company}.</b> Only Chainlink&apos;s forwarder can post to that contract.
          </p>

          <ol className="cl-steps" aria-label="What the check does">
            <li>
              <span className="n">1</span>
              <div>
                <b>Reads the team&apos;s receipts from Arkiv</b>
                <p>Straight from Arkiv, not from our server.</p>
              </div>
            </li>
            <li>
              <span className="n">2</span>
              <div>
                <b>Checks every signature</b>
                <p>Each receipt&apos;s EIP-712 signature against the person it is about. Any that fail are left out.</p>
              </div>
            </li>
            <li>
              <span className="n">3</span>
              <div>
                <b>Adds up the signed numbers</b>
                <p>Spend, things done, spend that went in circles, and what shipped.</p>
              </div>
            </li>
            <li>
              <span className="n">4</span>
              <div>
                <b>Asks GitHub about what shipped</b>
                <p>Is each merged PR still merged, and each push to main still in main&apos;s history?</p>
              </div>
            </li>
            <li>
              <span className="n end">5</span>
              <div>
                <b>Writes the score to Ethereum Sepolia</b>
                <p>Only Chainlink&apos;s forwarder can write to that contract.</p>
              </div>
            </li>
          </ol>

          {canRun && (
            <div className="cl-run">
              <RunChainlinkCheck />
            </div>
          )}

          <ul className="proofs mt-7" aria-label="Check it yourself">
            {check.txHash && (
              <li className="proof">
                <span className="svc">Sepolia</span>
                <div className="min-w-0">
                  <p className="proof-what">The transaction that wrote this score.</p>
                  <div className="proof-go">
                    <ProofAnchor href={sepoliaTxUrl(check.txHash)}>The transaction on Etherscan</ProofAnchor>
                  </div>
                </div>
              </li>
            )}
            <li className="proof">
              <span className="svc">Sepolia</span>
              <div className="min-w-0">
                <p className="proof-what">Every score Chainlink has posted for any team, in the contract&apos;s events.</p>
                <div className="proof-go">
                  <ProofAnchor href={`${sepoliaAddressUrl(check.contract)}#events`}>Every score on Sepolia Etherscan</ProofAnchor>
                </div>
              </div>
            </li>
            <li className="proof">
              <span className="svc">GitHub</span>
              <div className="min-w-0">
                <p className="proof-what">The workflow&apos;s code, so you can see exactly what each node runs.</p>
                <div className="proof-go">
                  <ProofAnchor href={`${REPO}/tree/main/cre`}>The workflow on GitHub</ProofAnchor>
                </div>
              </div>
            </li>
          </ul>
        </div>

        <aside className="cl-side" aria-label="The monthly statement">
          <div className="cl-side-in">
            <div className="receipt-shadow print-in w-full">
              <article className="paper st-paper" aria-label={`Monthly check for ${team}`}>
                <div className="r-head">
                  <div className="r-name" style={{ fontSize: 15 }}>
                    Receipts
                  </div>
                  <div className="r-faint">
                    Monthly check, {team} at {company}
                  </div>
                  <div className="r-faint" style={{ marginTop: 8 }}>
                    Run by Chainlink CRE
                  </div>
                </div>
                <hr className="r-rule" />
                {rows.map(([k, v]) => (
                  <div key={k} className={`r-row ${k === "AI spend" ? "strong" : ""}`}>
                    <span className="l">{k}</span>
                    <span className="leader" />
                    <span className="max-w-[62%] text-right">{v}</span>
                  </div>
                ))}
                <hr className="r-rule" />
                <div className="r-row">
                  <span>Posted on</span>
                  <span className="leader" />
                  <span>Ethereum Sepolia</span>
                </div>
                <div className="r-row">
                  <span>When</span>
                  <span className="leader" />
                  <span>{when}</span>
                </div>
                <div className="r-row">
                  <span>Contract</span>
                  <span className="leader" />
                  <span>{shortAddr(check.contract)}</span>
                </div>
                {check.txHash && <div className="r-hash">Tx {shortHash(check.txHash, 8)}</div>}
                {demo && check.prsChecked > 0 && check.prsStillMerged === 0 && (
                  <p className="r-faint mt-2.5 text-[11.5px]">The demo company&apos;s pull requests are made up, so GitHub cannot confirm them. A real team&apos;s PRs are checked the same way.</p>
                )}
              </article>
              <div className="cstamp" aria-hidden="true">
                <b>Checked</b>
                <span>Chainlink CRE</span>
                <span>{day}</span>
              </div>
            </div>
            {check.simulated && (
              <p className="text-sm text-[var(--mute)]">
                This score came from the CRE simulator, which runs the workflow as one node. Deployed on the Chainlink network, every node does the same
                work on its own and they must agree on each number.
              </p>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}
