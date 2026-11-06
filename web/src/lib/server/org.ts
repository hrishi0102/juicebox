// Loads a company's shared receipts for the Org and Team pages: the demo company's signed
// receipts from the repo (demo mode), merged with whatever is live on Arkiv for that org.
// Every receipt is re-verified; only verified ones should be counted.
import { fetchOrgReceipts } from "@/lib/receipts/arkiv";
import { verifyReceipt, type SignedReceipt } from "@/lib/receipts/receipt";
import type { Source } from "@/lib/receipts/store";
import type { OrgTeam, TeamMember } from "@/lib/receipts/demo";
import { getDemoOrg, shareTarget } from "./data";

export type OrgRow = SignedReceipt & { from: "arkiv" | "demo file"; arkivKey?: string; verified: boolean; team: string };

export type LoadedOrg = {
  id: string;
  name: string;
  policy: string;
  teams: OrgTeam[];
  members: TeamMember[]; // known names (demo only); otherwise people are shown by address
  rows: OrgRow[];
  arkivCount: number;
  arkivError?: string;
};

export async function loadOrg(source: Source): Promise<LoadedOrg> {
  const demo = source === "demo" ? getDemoOrg() : undefined;
  // Your own company: the GitHub org from sign-in (or your GitHub token), or the CLI settings.
  const target = demo ? undefined : await shareTarget();
  const cfg = demo ?? {
    id: target!.org,
    name: target!.orgName,
    teams: [{ id: target!.team, name: target!.teamName }],
    policy: "",
    members: [] as TeamMember[],
    receipts: [] as SignedReceipt[],
  };

  let live: Awaited<ReturnType<typeof fetchOrgReceipts>> = [];
  let arkivError: string | undefined;
  // Arkiv's public endpoint can be slow without an access key; never hold the page for it.
  try {
    live = await Promise.race([
      fetchOrgReceipts(cfg.id),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Arkiv did not answer within 5 seconds")), 5000)),
    ]);
  } catch (e) {
    arkivError = e instanceof Error ? e.message : String(e);
  }

  const rows = new Map<string, OrgRow>();
  for (const r of demo?.receipts ?? []) {
    rows.set(r.digest, { ...r, from: "demo file", verified: (await verifyReceipt(r)).ok, team: r.share?.team ?? cfg.teams[0]?.id ?? "" });
  }
  for (const r of live) rows.set(r.digest, { ...r, from: "arkiv", arkivKey: r.arkiv.key, verified: r.verified, team: r.share?.team ?? "" });

  // Teams that show up on Arkiv but are not in the config still get a row.
  const teams = [...cfg.teams];
  for (const r of rows.values()) if (r.team && !teams.some((t) => t.id === r.team)) teams.push({ id: r.team, name: r.team });

  return {
    id: cfg.id,
    name: cfg.name,
    policy: demo?.policy || "Everyone shares a signed weekly receipt with the PRs it paid for. Prompts never leave anyone's laptop.",
    teams,
    members: demo?.members ?? [],
    rows: [...rows.values()],
    arkivCount: live.length,
    arkivError,
  };
}

/** A known name (demo), else the GitHub login inside the signed receipt, else a short address. */
export function personName(org: LoadedOrg, addr: string, author?: string) {
  return org.members.find((m) => m.address.toLowerCase() === addr.toLowerCase())?.name ?? (author ? `@${author}` : `${addr.slice(0, 6)}…${addr.slice(-4)}`);
}
