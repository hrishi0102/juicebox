import type { Metadata } from "next";
import { WrappedView } from "@/components/wrapped-view";
import { currentSource, getDataset } from "@/lib/server/data";
import { WRAPPED_PERIODS, wrappedFor, type WrappedPeriod } from "@/lib/server/wrapped-data";

export const metadata: Metadata = { title: "AI Wrapped · Receipts" };

export default async function WrappedPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const sp = await searchParams;
  const period: WrappedPeriod = WRAPPED_PERIODS.find((p) => p.id === sp.period)?.id ?? "30d";
  const source = await currentSource();
  const d = getDataset(source);
  const w = d ? wrappedFor(d, period) : undefined;
  const periods = WRAPPED_PERIODS.map((p) => ({ id: p.id, label: p.label, href: `/wrapped?period=${p.id}`, active: p.id === period }));
  return <WrappedView initial={w} periods={periods} source={d ? source : undefined} aiReady={!!process.env.ZG_API_KEY} />;
}
