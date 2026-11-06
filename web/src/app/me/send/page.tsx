import Link from "next/link";
import { redirect } from "next/navigation";
import { ReceiptPaper, writtenBy } from "@/components/receipt-paper";
import { SendFlow } from "@/components/send-flow";
import { swarmReady } from "@/lib/receipts/swarm";
import { companyPublicKey } from "@/lib/receipts/arkiv";
import { signedNumbers } from "@/lib/receipts/receipt";
import { currentSource, getDataset, weekView } from "@/lib/server/data";
import { employeeTarget, weekReceipt } from "@/lib/server/employee";
import { dayTime, usd } from "@/lib/format";

export const metadata = { title: "Sign and send · Receipts" };

// The receipt, then two steps: sign it, send it. The whole week goes, exactly as written.
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
  const company = target.from === "default" ? undefined : target.orgName;

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/me?week=${wv.id}`} className="text-sm text-muted-foreground hover:text-foreground">
          ‹ Back to week {week}
        </Link>
        <h1 className="mt-2 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
          Your week {week} receipt{company ? ` for ${company}` : ""}
        </h1>
        <p className="mt-2 max-w-[65ch] text-[15px] text-muted-foreground">
          This is everything {company ?? "your company"} gets: every line the private AI wrote, the pull requests and the totals. Sign it, then send it.
        </p>
      </div>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,380px)_1fr]">
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
          animate
        />
        <SendFlow
          week={wv.id}
          demo={source === "demo"}
          company={target.from === "default" ? null : { org: target.org, orgName: target.orgName, teamName: target.teamName }}
          totals={{ done: n.done, spend: usd(n.spendUsd), merged: n.mergedPrs }}
          signed={rc.signed}
          stale={rc.stale}
          signer={rc.saved?.message.owner}
          signedAt={rc.saved?.signedAt ? dayTime(rc.saved.signedAt) : undefined}
          sent={rc.sent ? { arkivKey: rc.sent.arkivKey, arkivTx: rc.sent.arkivTx, swarm: rc.sent.swarm, publishedAt: rc.sent.publishedAt ? dayTime(rc.sent.publishedAt) : undefined } : null}
          arkivReady={!!process.env.ARKIV_PRIVATE_KEY}
          sealed={swarmReady() && !!companyPublicKey()}
          savedJson={rc.saved ? JSON.stringify(rc.saved, null, 2) : undefined}
        />
      </div>
    </div>
  );
}
