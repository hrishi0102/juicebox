// Reading 0G's balance answer (GET /v1/account/balance). Amounts are whole-number strings in
// neuron (10^18 neuron = 1 0G), or micro-dollars for accounts billed in USD:
//   { address, currency: "0g", total_balance, deposit_balance, credit_balance, pending_charge, ... }
// What you can spend now is total_balance minus pending_charge, shown in 0G.

/** Spendable now (total minus pending charges), in 0G (or dollars for USD-billed accounts). */
export type ZgBalance = { text: string; value?: number; usd?: boolean; credits?: number; pending?: number };

export function parseBalance(j: unknown): ZgBalance | null {
  const o = (j && typeof j === "object" ? j : {}) as Record<string, unknown>;
  const big = (v: unknown) => {
    if (v === undefined || v === null || v === "") return undefined;
    try {
      return BigInt(String(v).split(".")[0]);
    } catch {
      return undefined;
    }
  };
  const usd = String(o.currency ?? "").toLowerCase() === "usd";
  const scale = usd ? BigInt(1_000_000) : BigInt("1000000000000000000");
  // Keep six decimals while converting, so a call costing a fraction of a cent still shows.
  const toNumber = (v: bigint) => Number((v * BigInt(1_000_000)) / scale) / 1e6;
  const total = big(o.total_balance) ?? big(o.balance);
  if (total === undefined) return null;
  const pending = big(o.pending_charge) ?? BigInt(0);
  const value = toNumber(total - pending);
  const credits = big(o.credit_balance);
  return {
    text: formatAmount(value, usd),
    value,
    usd,
    credits: credits !== undefined ? toNumber(credits) : undefined,
    pending: pending > BigInt(0) ? toNumber(pending) : undefined,
  };
}

/** "4.2158 0G", "0.000312 0G", "$1.25": more decimals for small amounts. */
export function formatAmount(v: number, usd = false) {
  const digits = Math.abs(v) >= 100 ? 2 : Math.abs(v) >= 1 ? 4 : 6;
  return usd ? `$${v.toFixed(Math.min(digits, 4))}` : `${v.toFixed(digits)} 0G`;
}

/** "This cost 0.000312 0G: your 0G balance went from 4.215831 0G to 4.215519 0G." After every paid call. */
export function spentLine(before?: ZgBalance | null, after?: ZgBalance | null) {
  if (before?.value !== undefined && after?.value !== undefined && after.value < before.value)
    return `This cost ${formatAmount(before.value - after.value, after.usd)}: your 0G balance went from ${before.text} to ${after.text}.`;
  if (after) return `Your 0G balance: ${after.text}. 0G may take a moment to charge the call.`;
  return "";
}
