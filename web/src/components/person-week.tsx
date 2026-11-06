import Link from "next/link";
import { BadgeCheck, ExternalLink, LockOpen, TriangleAlert } from "lucide-react";
import { Collapsible } from "@/components/collapsible";
import { PrTable } from "@/components/pr-table";
import { WeekList } from "@/components/week-list";
import { plural, usd } from "@/lib/format";
import { formatMinutes } from "@/lib/receipts/efficiency";
import { receiptItems, signedNumbers, type SignedReceipt } from "@/lib/receipts/receipt";
import { arkivEntityUrl, swarmProofPath, zgProofPath } from "@/lib/proof-urls";

/** One person's shared week, as the company sees it: their signed list, PRs and totals. */
export function PersonWeek({
  r,
  name,
  team,
  verified,
  arkivKey,
  defaultOpen,
  swarm,
}: {
  r: SignedReceipt;
  name: string;
  team?: string;
  verified: boolean;
  arkivKey?: string;
  defaultOpen?: boolean;
  swarm?: { ref: string; opened: boolean; error?: string };
}) {
  const n = signedNumbers(r);
  const items = receiptItems(r);
  // The 0G providers that wrote this week, from its private AI records (in the opened list).
  const providers = [...new Set(r.judges.map((j) => j.provider).filter((p) => /^0x[0-9a-fA-F]{40}$/.test(p)))];
  return (
    <Collapsible
      defaultOpen={defaultOpen}
      title={name}
      hint={
        <>
          {team ? `${team}. ` : ""}
          {plural(n.done, "thing")} done, {usd(n.spendUsd)}
          {n.mergedPrs ? `, ${plural(n.mergedPrs, "shipped change")}` : ""}
          {n.efficiency?.stages.ideaToMerge.n ? `, idea to merged ${formatMinutes(n.efficiency.stages.ideaToMerge.medianMin)}` : ""}
          {r.oneLiner && r.oneLiner !== items[0]?.title ? `. ${r.oneLiner}` : ""}
        </>
      }
    >
      <div className="space-y-4">
        {items.length ? (
          <WeekList items={items} linkSessions={false} />
        ) : swarm && !swarm.opened ? (
          <p className="text-sm text-muted-foreground">
            The list is stored on Swarm, encrypted for the company. Only the company key can open it{swarm.error ? ` (${swarm.error.slice(0, 120)})` : ""}.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">Shared totals only, no list.</p>
        )}
        {r.evidence.length > 0 && (
          <div>
            <div className="mb-1 text-sm font-medium">Pull requests</div>
            <PrTable evidence={r.evidence} />
          </div>
        )}
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          {verified ? (
            <span className="inline-flex items-center gap-1 text-[var(--c-built)]">
              <BadgeCheck className="size-4" aria-hidden="true" /> Signature checked
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-destructive">
              <TriangleAlert className="size-4" aria-hidden="true" /> Signature does not match
            </span>
          )}
          <span>
            Written by {r.summary.writtenBy}
            {n.author ? `, signed as @${n.author}` : ""}.
          </span>
          {swarm?.opened && (
            <span title={`Swarm reference ${swarm.ref}`} className="inline-flex items-center gap-1">
              <LockOpen className="size-3.5" aria-hidden="true" /> Opened from Swarm with the company key
            </span>
          )}
        </p>
        {(arkivKey || swarm || providers.length > 0) && (
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="text-muted-foreground">Check it:</span>
            {arkivKey && (
              <a className="inline-flex items-center gap-1 text-primary hover:underline" href={arkivEntityUrl(arkivKey)} target="_blank" rel="noreferrer">
                Arkiv record <ExternalLink className="size-3" aria-hidden="true" />
              </a>
            )}
            {swarm && (
              <Link className="text-primary hover:underline" href={swarmProofPath(swarm.ref, arkivKey)}>
                Swarm copy
              </Link>
            )}
            {providers.slice(0, 1).map((p) => (
              <Link key={p} className="text-primary hover:underline" href={zgProofPath(p)}>
                0G TEE check
              </Link>
            ))}
            {arkivKey && (
              <Link className="text-primary hover:underline" href={`/r/${arkivKey}`}>
                What anyone sees
              </Link>
            )}
          </p>
        )}
      </div>
    </Collapsible>
  );
}
