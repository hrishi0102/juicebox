// The Wrapped for the person's own logs (or the demo), for one period.
import { sessionUsd } from "@/lib/receipts/pricing";
import { weekOf } from "@/lib/receipts/score";
import { buildWrapped, type Wrapped, type WrappedInput } from "@/lib/receipts/wrapped";
import type { Dataset } from "@/lib/receipts/pipeline";
import { nowFor, weeksWithData } from "./data";

export const WRAPPED_PERIODS = [
  { id: "week", label: "This week" },
  { id: "30d", label: "Last 30 days" },
  { id: "all", label: "Everything" },
] as const;
export type WrappedPeriod = (typeof WRAPPED_PERIODS)[number]["id"];

export function wrappedInputs(d: Dataset, from: number, to: number): WrappedInput[] {
  return d.sessions
    .filter((s) => s.chat && Date.parse(s.startedAt) >= from && Date.parse(s.startedAt) < to)
    .map((s) => ({ tool: s.tool ?? "claude-code", startedAt: s.startedAt, minutes: s.activeMinutes, usd: sessionUsd(s), chat: s.chat! }));
}

export function wrappedFor(d: Dataset, period: WrappedPeriod): Wrapped | undefined {
  const now = nowFor(d).getTime();
  if (period === "week") {
    const current = weekOf(new Date(now));
    const w = weeksWithData(d)[0] ?? current;
    const label = w.id === current.id ? "This week" : `Week ${Number(w.id.split("-W")[1])}`;
    return buildWrapped(wrappedInputs(d, Date.parse(w.start), Date.parse(w.end)), { label, from: w.start, to: w.end });
  }
  if (period === "30d") {
    const from = now - 30 * 86400_000;
    return buildWrapped(wrappedInputs(d, from, now + 1), { label: "Last 30 days", from: new Date(from).toISOString(), to: new Date(now).toISOString() });
  }
  return buildWrapped(wrappedInputs(d, -Infinity, Infinity), { label: "Everything", to: new Date(now).toISOString() });
}
