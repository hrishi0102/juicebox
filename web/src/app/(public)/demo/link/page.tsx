import Link from "next/link";
import { redirect } from "next/navigation";
import { fetchOrgReceipts } from "@/lib/receipts/arkiv";

export const metadata = { title: "A public link · Demo · Receipts" };

// "Be someone with a public link": open one of the demo engineer's shared weeks the way anyone
// would, straight from Arkiv, without the company key. Picks a sealed week, so the list is private.
export default async function DemoLink() {
  let key: string | undefined;
  try {
    const rows = await Promise.race([fetchOrgReceipts("acme", undefined, false), new Promise<never>((_, no) => setTimeout(() => no(new Error("timeout")), 6000))]);
    const sealed = rows.filter((r) => r.verified && r.share?.level === "sealed").sort((a, b) => b.message.period.localeCompare(a.message.period));
    key = (sealed.find((r) => r.message.author === "you") ?? sealed[0] ?? rows[0])?.arkiv.key;
  } catch {
    // Arkiv is slow or unreachable; say so below.
  }
  if (key) redirect(`/r/${key}`);
  return (
    <div className="max-w-2xl space-y-3">
      <h1 className="text-3xl font-semibold tracking-tight">Arkiv did not answer</h1>
      <p className="text-muted-foreground">
        A public link opens a shared week straight from Arkiv, and Arkiv did not answer just now. Try again in a moment, or{" "}
        <Link href="/verify" className="text-primary hover:underline">
          check a receipt file
        </Link>{" "}
        instead.
      </p>
    </div>
  );
}
