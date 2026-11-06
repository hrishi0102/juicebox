import Link from "next/link";
import { ShareStudio, type ShareSeed } from "@/components/share-studio";
import { EnterDemo } from "@/components/demo";
import { swarmReady } from "@/lib/receipts/swarm";
import { writtenBy } from "@/components/receipt-paper";
import { currentSource, getDataset, weekView, weeksWithData } from "@/lib/server/data";
import { weekRange } from "@/lib/format";
import { TOOL_NAMES, type AiTool } from "@/lib/receipts/types";

export const metadata = { title: "Week card · Receipts" };

// A card of "what I got done this week" to post anywhere. It is a picture, not your receipt: not
// signed, editable, cost hidden by default, and never sent to your company. It is drawn on this
// laptop and downloaded, copied or printed from here; Get a Swarm link puts it on the wall.
export default async function CardPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const sp = await searchParams;
  const source = await currentSource();
  const d = getDataset(source);
  if (!d)
    return (
      <div className="max-w-2xl space-y-3">
        <h1 className="text-balance text-4xl font-semibold tracking-tight">A card of your week</h1>
        <p className="text-muted-foreground">
          The card is made from your Claude Code and Codex sessions, read on your laptop.{" "}
          <Link href="/me/setup" className="text-primary hover:underline">
            Read your logs first
          </Link>
          , or{" "}
          <EnterDemo href="/card" className="text-primary hover:underline">
            make one for the demo person
          </EnterDemo>
          .
        </p>
      </div>
    );
  const weeks = weeksWithData(d);
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
        <h1 className="text-balance text-4xl font-semibold tracking-tight">Post what you got done</h1>
        <p className="mt-2 max-w-[68ch] text-[15px] text-muted-foreground">
          A card for X, LinkedIn or your team chat. It is a picture, not your receipt: not signed, you can edit every line, and it never goes to your
          company. It is drawn on this laptop and nothing is uploaded unless you ask for a Swarm link. Cost is hidden unless you turn it on.
        </p>
        {weeks.length > 1 && (
          <div className="mt-4 flex flex-wrap gap-2 text-sm" role="group" aria-label="Week">
            {weeks.slice(0, 6).map((w) => (
              <Link
                key={w.id}
                href={`/card?week=${w.id}`}
                aria-current={w.id === wv.id ? "page" : undefined}
                className={`rounded-full border px-3 py-1 ${w.id === wv.id ? "border-primary bg-accent text-accent-foreground" : "border-border hover:bg-card"}`}
              >
                Week {w.id.split("-W")[1]}
              </Link>
            ))}
          </div>
        )}
      </div>
      {seed.items.length ? <ShareStudio seed={seed} swarmReady={swarmReady()} /> : <p className="text-muted-foreground">Nothing to put on a card for this week yet.</p>}
    </div>
  );
}
