import Link from "next/link";
import { ShareStudio, type ShareSeed } from "@/components/share-studio";
import { writtenBy } from "@/components/receipt-paper";
import { currentSource, getDataset, weekView } from "@/lib/server/data";
import { weekRange } from "@/lib/format";
import { TOOL_NAMES, type AiTool } from "@/lib/receipts/types";

export const metadata = { title: "Share your week · Receipts" };

// Make a card of "what I got done this week" to post anywhere. Nothing is uploaded: the card is
// drawn on this laptop and downloaded, copied or printed from here.
export default async function SharePage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const sp = await searchParams;
  const source = await currentSource();
  const d = getDataset(source);
  if (!d)
    return (
      <p className="text-muted-foreground">
        No data yet.{" "}
        <Link href="/" className="text-primary hover:underline">
          Read your logs first
        </Link>
        .
      </p>
    );
  const wv = weekView(d, sp.week);
  const s = wv.summary;
  const seed: ShareSeed = {
    week: wv.id,
    range: weekRange(wv.start, wv.end),
    sentence: s.story.engine !== "rules" ? s.oneLiner : "",
    sessions: s.sessions,
    tools: Object.entries(s.toolSpend)
      .sort((a, b) => b[1] - a[1])
      .map(([t]) => TOOL_NAMES[t as AiTool] ?? t),
    totalUsd: s.spendUsd,
    writtenBy: writtenBy(s.story),
    items: s.items.map((i) => ({ id: i.id, category: i.category, title: i.title, costUsd: i.costUsd })),
  };

  return (
    <div className="space-y-8">
      <div className="print:hidden">
        <Link href={`/?week=${wv.id}`} className="text-sm text-muted-foreground hover:text-foreground">
          ‹ Back to week {wv.id.split("-W")[1]}
        </Link>
        <h1 className="mt-2 text-balance text-4xl font-semibold tracking-tight">Share what you got done</h1>
        <p className="mt-2 max-w-[65ch] text-[15px] text-muted-foreground">
          A card for X, LinkedIn or your team chat. It is drawn on this laptop and nothing is uploaded. Cost is hidden unless you turn it on.
        </p>
      </div>
      {seed.items.length ? <ShareStudio seed={seed} /> : <p className="text-muted-foreground">Nothing to share for this week yet.</p>}
    </div>
  );
}
