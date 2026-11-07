import Link from "next/link";
import { ChevronLeft } from "lucide-react";
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
    <div className="mw">
      <Link href={`/me?week=${wv.id}`} className="mw-back">
        <ChevronLeft className="size-4" aria-hidden="true" />
        Back to week {week}
      </Link>
      <div className="mw-grid">
        <div className="min-w-0">
          <h1 className="disp h-page-sm">
            Your week {week} receipt{company ? ` for ${company}` : ""}
          </h1>
          <p className="page-sub mb-8">
            This is everything {company ?? "your company"} gets: every line the private AI wrote, the pull requests and the totals. Sign it, then send it.
          </p>
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
        <aside className="mw-side" aria-label="Your receipt">
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
            signedAt={rc.saved?.signedAt ? dayTime(rc.saved.signedAt) : undefined}
            stub={rc.sent?.arkivKey ? { to: company ? `${target.teamName} at ${company}` : "your company", at: rc.sent.publishedAt ? dayTime(rc.sent.publishedAt) : undefined, record: rc.sent.arkivKey } : undefined}
            animate
          />
        </aside>
      </div>
    </div>
  );
}
