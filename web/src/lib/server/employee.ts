// Server helpers for the employee side (My week): where your receipts go, and where this week's
// receipt stands (signed, sent, out of date).
import type { Address } from "viem";
import type { Dataset } from "@/lib/receipts/pipeline";
import { buildReceipt, type SignedReceipt } from "@/lib/receipts/receipt";
import type { Source } from "@/lib/receipts/store";
import { getDemoOrg, shareTarget, type ShareTarget, type WeekView } from "./data";
import { loadSavedReceipt, signerAddress } from "./receipts-store";

export type EmployeeTarget = Omit<ShareTarget, "from"> & { from: ShareTarget["from"] | "demo" };

/** Where this laptop's receipts go: the company (GitHub org) and team you joined. */
export async function employeeTarget(source: Source): Promise<EmployeeTarget> {
  if (source === "demo") {
    const o = getDemoOrg();
    const you = o?.members.find((m) => m.you);
    const team = o?.teams.find((t) => t.id === you?.team) ?? o?.teams[0];
    return { org: o?.id ?? "acme", orgName: "Acme", team: team?.id ?? "acme-payments", teamName: team?.name ?? "Payments", from: "demo" };
  }
  return shareTarget();
}

/** How the target was found, in a few words. */
export function targetHow(t: EmployeeTarget) {
  if (t.from === "demo") return "the demo company";
  if (t.from === "settings") return "you chose this";
  if (t.from === "github sign-in" || t.from === "github") return "your first GitHub team";
  return "not chosen yet";
}

const NOBODY = "0x0000000000000000000000000000000000000000" as Address;

/** This week's receipt: the saved signed copy (if any) and a fresh build from today's data. */
export function weekReceipt(source: Source, d: Dataset, wv: WeekView) {
  const saved = loadSavedReceipt(source, wv.id);
  const owner = (saved?.message.owner ?? signerAddress(source) ?? d.owner) as Address | undefined;
  // Before the first signature there is no key yet; the list and its order are the same either way.
  const preview: SignedReceipt = buildReceipt({ owner: owner ?? NOBODY, author: saved?.message.author ?? "", periodId: wv.id, summary: { ...wv.summary, owner: owner ?? NOBODY }, judgements: wv.judgements });
  // A saved receipt is stale when the data changed after it was signed (rescan, a new write-up).
  const stale = !!saved && saved.digest !== preview.digest;
  const signed = !!saved?.signature && !stale;
  return {
    saved,
    owner,
    preview,
    stale,
    signed,
    digest: owner ? (stale ? preview.digest : (saved?.digest ?? preview.digest)) : undefined,
    sent: stale ? null : (saved?.share ?? null),
    /** What will be (or was) signed: the saved copy while it is current, else the fresh build. */
    current: signed && saved ? saved : preview,
  };
}

/** "paid from 0G account 0xab…cd" for a written week, from the payer the AI record kept. */
export function payerText(payer?: string) {
  if (!payer) return "";
  if (payer === "app key") return "paid with the app's own 0G key";
  return `paid from 0G account ${payer.slice(0, 6)}…${payer.slice(-4)}`;
}
