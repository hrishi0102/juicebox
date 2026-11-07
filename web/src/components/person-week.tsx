import { BadgeCheck, ChevronDown, LockOpen, PenLine, Timer, TriangleAlert, Lock } from "lucide-react";
import { PrTable } from "@/components/pr-table";
import { WeekList } from "@/components/week-list";
import { ProofAnchor } from "@/components/proof-links";
import { plural, usd } from "@/lib/format";
import { formatMinutes } from "@/lib/receipts/efficiency";
import { receiptItems, signedNumbers, type SignedReceipt } from "@/lib/receipts/receipt";
import { arkivEntityUrl, swarmProofPath, zgProofPath } from "@/lib/proof-urls";

/** The column heads above a list of PersonWeek rows. */
export function PeopleHead() {
  return (
    <div className="prow-h" aria-hidden="true">
      <span>Person</span>
      <span>Things done</span>
      <span>AI spend</span>
      <span>Shipped</span>
      <span>Signature</span>
      <span />
    </div>
  );
}

/** One person's shared week, as the company sees it: their signed list, PRs and totals. Opens in place. */
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
    <details className="prow" open={defaultOpen}>
      <summary className="prow-sum">
        <span className="p-who">
          <span className="p-name">{name}</span>
          {team && <span className="p-team">{team}</span>}
          <span className="p-mob num">
            {plural(n.done, "thing")} done, {usd(n.spendUsd)}
            {n.mergedPrs ? `, ${plural(n.mergedPrs, "shipped change")}` : ""}
          </span>
        </span>
        <span className="p-cell">
          <span className="sr-only">Things done </span>
          {n.done}
        </span>
        <span className="p-cell">
          <span className="sr-only">AI spend </span>
          {usd(n.spendUsd)}
        </span>
        <span className="p-cell">
          <span className="sr-only">Shipped changes </span>
          {n.mergedPrs}
        </span>
        <span className={`p-cell p-sig ${verified ? "" : "bad"}`}>
          {verified ? <BadgeCheck className="size-4" aria-hidden="true" /> : <TriangleAlert className="size-4" aria-hidden="true" />}
          {verified ? "Signature checked" : "Signature does not match"}
        </span>
        <ChevronDown className="chev size-4" aria-hidden="true" />
      </summary>
      <div className="pw">
        <div className="min-w-0 space-y-5">
          {r.oneLiner && r.oneLiner !== items[0]?.title && <p className="pw-one">{r.oneLiner}</p>}
          {items.length ? (
            <WeekList items={items} linkSessions={false} />
          ) : swarm && !swarm.opened ? (
            <div className="sealed">
              <p className="sealed-h">
                <Lock className="size-4" aria-hidden="true" />
                Only the company key opens this list.
              </p>
              <p className="mt-2 text-sm text-[var(--mute)]">
                The list is stored on Swarm, encrypted for the company. Only the company key can open it{swarm.error ? ` (${swarm.error.slice(0, 120)})` : ""}.
              </p>
            </div>
          ) : (
            <p className="text-sm text-[var(--mute)]">Shared totals only, no list.</p>
          )}
          {r.evidence.length > 0 && (
            <div>
              <h3 className="side-h mb-1">Pull requests</h3>
              <PrTable evidence={r.evidence} />
            </div>
          )}
        </div>
        <div className="pw-side">
          <ul className="checks">
            {verified ? (
              <li className="font-semibold text-[var(--ok)]">
                <BadgeCheck className="size-4" aria-hidden="true" /> Signature checked
              </li>
            ) : (
              <li className="font-semibold text-[var(--bad)]">
                <TriangleAlert className="size-4" aria-hidden="true" /> Signature does not match
              </li>
            )}
            <li>
              <PenLine className="size-4" aria-hidden="true" />
              <span>
                Written by {r.summary.writtenBy}
                {n.author ? `, signed as @${n.author}` : ""}.
              </span>
            </li>
            {swarm?.opened && (
              <li title={`Swarm reference ${swarm.ref}`}>
                <LockOpen className="size-4" aria-hidden="true" /> Opened from Swarm with the company key
              </li>
            )}
            {n.efficiency?.stages.ideaToMerge.n ? (
              <li>
                <Timer className="size-4" aria-hidden="true" /> Idea to merged {formatMinutes(n.efficiency.stages.ideaToMerge.medianMin)}
              </li>
            ) : null}
          </ul>
          {(arkivKey || swarm || providers.length > 0) && (
            <>
              <p className="side-h">Check it yourself</p>
              <div className="mini-proofs">
                {arkivKey && (
                  <div className="mini-proof">
                    <span className="svc">Arkiv</span>
                    <div className="min-w-0">
                      <p className="text-[var(--ink-2)]">The signed totals, read-only and owned by the person who signed them.</p>
                      <ProofAnchor href={arkivEntityUrl(arkivKey)}>The record on the Arkiv explorer</ProofAnchor>
                    </div>
                  </div>
                )}
                {swarm && (
                  <div className="mini-proof">
                    <span className="svc">Swarm</span>
                    <div className="min-w-0">
                      <p className="text-[var(--ink-2)]">The full list, encrypted on their laptop before it left.</p>
                      <ProofAnchor href={swarmProofPath(swarm.ref, arkivKey)}>The encrypted copy</ProofAnchor>
                    </div>
                  </div>
                )}
                {providers.slice(0, 1).map((p) => (
                  <div key={p} className="mini-proof">
                    <span className="svc">0G</span>
                    <div className="min-w-0">
                      <p className="text-[var(--ink-2)]">The private AI that wrote the list ran in a hardware enclave.</p>
                      <ProofAnchor href={zgProofPath(p)}>The private AI&apos;s TEE check</ProofAnchor>
                    </div>
                  </div>
                ))}
                {arkivKey && (
                  <div className="mini-proof">
                    <span className="svc">Link</span>
                    <div className="min-w-0">
                      <p className="text-[var(--ink-2)]">What anyone with the link sees: the totals and the checks, never the list.</p>
                      <ProofAnchor href={`/r/${arkivKey}`}>What anyone sees</ProofAnchor>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </details>
  );
}
