import { ExternalLink, ShieldCheck } from "lucide-react";
import { usd } from "@/lib/format";
import { sepoliaAddressUrl, sepoliaTxUrl } from "@/lib/proof-urls";
import type { TeamCheck } from "@/lib/server/scoreboard";
import { RunChainlinkCheck } from "@/components/run-chainlink-check";

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
  return (
    <section aria-labelledby="chainlink-check" className="max-w-4xl rounded-xl border border-border bg-card p-5">
      <p className="inline-flex items-center gap-1.5 rounded-full bg-[#375bd2]/10 px-2.5 py-0.5 text-xs font-medium text-[#375bd2] dark:text-[#8aa2ff]">
        <ShieldCheck className="size-3.5" aria-hidden="true" /> Chainlink CRE
      </p>
      <h2 id="chainlink-check" className="mt-2 text-xl font-semibold tracking-tight">
        Checked by Chainlink, once a month
      </h2>
      <p className="mt-1 max-w-[70ch] text-[15px] text-muted-foreground">
        On {when}, a Chainlink CRE workflow read {team}&apos;s receipts straight from Arkiv, checked every signature, added up the signed numbers
        and asked GitHub whether what shipped is still there (each merged PR still merged, each push to main still in main&apos;s history),
        then wrote the result on Ethereum Sepolia. Only Chainlink&apos;s forwarder can
        post to that contract, so nobody, not even {company}, can post or change a score.
      </p>
      {check.simulated && (
        <p className="mt-1 max-w-[70ch] text-xs text-muted-foreground">
          This score came from the CRE simulator, which runs the workflow as one node. Deployed on the Chainlink network, every node does the same
          work on its own and they must agree on each number.
        </p>
      )}
      <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 border-b border-border/60 pb-1.5">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="text-right font-medium tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
      {demo && check.prsChecked > 0 && check.prsStillMerged === 0 && (
        <p className="mt-2 text-xs text-muted-foreground">The demo company&apos;s pull requests are made up, so GitHub cannot confirm them. A real team&apos;s PRs are checked the same way.</p>
      )}
      {canRun && (
        <div className="mt-4 border-t border-border pt-4">
          <RunChainlinkCheck />
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm">
        {check.txHash && (
          <a href={sepoliaTxUrl(check.txHash)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
            The transaction that wrote it <ExternalLink className="size-3" aria-hidden="true" />
          </a>
        )}
        <a href={`${sepoliaAddressUrl(check.contract)}#events`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
          Every score on Sepolia Etherscan <ExternalLink className="size-3" aria-hidden="true" />
        </a>
      </div>
    </section>
  );
}
