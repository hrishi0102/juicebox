// Formatting helpers shared by server and client components.
import type { SessionLabel } from "@/lib/receipts/types";

export function usd(n: number, digits?: number) {
  const d = digits ?? (Math.abs(n) >= 100 ? 0 : 2);
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}

export function pct(n: number | null | undefined, digits = 0) {
  if (n === null || n === undefined || Number.isNaN(n)) return "n/a";
  return `${n.toFixed(digits)}%`;
}

export function shortAddr(a?: string) {
  if (!a) return "";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function shortHash(h?: string, n = 6) {
  if (!h) return "";
  return `${h.slice(0, 2 + n)}…${h.slice(-n)}`;
}

export function day(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export function dayTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function weekRange(start: string, end: string) {
  const e = new Date(Date.parse(end) - 1000).toISOString();
  return `${day(start)} to ${day(e)}, ${new Date(start).getUTCFullYear()}`;
}

export function tokens(n: number) {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(n);
}

export const LABEL_COPY: Record<SessionLabel, { name: string; hint: string; varName: string }> = {
  Shipped: { name: "Shipped", hint: "Merged and still alive", varName: "--l-shipped" },
  Learned: { name: "Learned", hint: "No code shipped, but real understanding gained", varName: "--l-learned" },
  Looped: { name: "Looped", hint: "Went in circles: repeated failures or redone edits", varName: "--l-looped" },
  Abandoned: { name: "Abandoned", hint: "Code written that never shipped", varName: "--l-abandoned" },
  Overkill: { name: "Overkill", hint: "Shipped, but cost far more than similar tasks", varName: "--l-overkill" },
  Pending: { name: "Open", hint: "Not judged yet: open PR, fresh edits, or work we could not link to a repo", varName: "--l-pending" },
};

export const LABEL_ORDER: SessionLabel[] = ["Shipped", "Learned", "Looped", "Abandoned", "Overkill", "Pending"];
