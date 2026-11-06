import Link from "next/link";
import { redirect } from "next/navigation";
import { ReceiptPaper, writtenBy } from "@/components/receipt-paper";
import { SendFlow } from "@/components/send-flow";
import { swarmReady } from "@/lib/receipts/swarm";
import { companyPublicKey } from "@/lib/receipts/arkiv";
import { receiptItems, signedNumbers } from "@/lib/receipts/receipt";
import { currentSource, getDataset, weekView } from "@/lib/server/data";
import { employeeTarget, weekReceipt } from "@/lib/server/employee";
import { usd } from "@/lib/format";
import { TOOL_NAMES, type AiTool } from "@/lib/receipts/types";

export const metadata = { title: "Send your receipt · Receipts" };

// Review, sign, send. The page shows exactly what the company gets before anything leaves.
export default async function SendPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const sp = await searchParams;
  const source = await currentSource();
  const d = getDataset(source);
  if (!d) redirect("/me");
  const wv = weekView(d, sp.week);
  const rc = weekReceipt(source, d, wv);
  const target = await employeeTarget(source);
  const n = signedNumbers(rc.current);
  const week = wv.id.split("-W")[1];
  const tools = Object.entries(n.toolSpend)
    .sort((a, b) => b[1] - a[1])
    .map(([t]) => TOOL_NAMES[t as AiTool] ?? t)
    .join(" + ");

  return (
    <div className="space-y-8">
      <div>
        <Link href={`/me?week=${wv.id}`} className="text-sm text-muted-foreground hover:text-foreground">
          ‹ Back to week {week}
        </Link>
        <h1 className="mt-2 text-balance text-4xl font-semibold tracking-tight">
          Send your week {week} receipt{target.from !== "default" ? ` to ${target.orgName}` : ""}
        </h1>
        <p className="mt-2 max-w-[68ch] text-[15px] text-muted-foreground">
          Check what {target.from !== "default" ? target.orgName : "your company"} will see, sign it with the key on this laptop, and send it. Your
          prompts stay here.
        </p>
      </div>

      <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
        <SendFlow
          week={wv.id}
          weekLabel={`Week ${week}`}
          demo={source === "demo"}
          company={target.from === "default" ? null : { org: target.org, orgName: target.orgName, teamName: target.teamName }}
          items={receiptItems(rc.current).map((i, index) => ({ index, category: i.category, title: i.title, cost: usd(i.costUsd, 2) }))}
          prs={rc.current.evidence.map((e) => ({ key: e.changeKey, title: e.title, url: e.url, state: e.reverted ? "reverted" : e.state }))}
          totals={{ done: n.done, spend: usd(n.spendUsd), merged: n.mergedPrs, sessions: n.sessions, tools }}
          signed={rc.signed}
          stale={rc.stale}
          signer={rc.saved?.message.owner}
          signedAt={rc.saved?.signedAt}
          sent={rc.sent ? { arkivKey: rc.sent.arkivKey, level: rc.sent.level, hidden: rc.sent.hidden, publishedAt: rc.sent.publishedAt } : null}
          arkivReady={!!process.env.ARKIV_PRIVATE_KEY}
          sealed={swarmReady() && !!companyPublicKey()}
          savedJson={rc.saved ? JSON.stringify(rc.saved, null, 2) : undefined}
        />
        <aside>
          <ReceiptPaper
            weekId={wv.id}
            start={wv.start}
            end={wv.end}
            summary={wv.summary}
            owner={rc.owner}
            judgeLine={writtenBy(wv.summary.story)}
            digest={rc.digest}
            signed={rc.signed}
            stale={rc.stale}
            sharedLevel={rc.sent?.level}
          />
        </aside>
      </div>
    </div>
  );
}
