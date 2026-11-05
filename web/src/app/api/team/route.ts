import { NextResponse } from "next/server";
import { fetchTeamReceipts } from "@/lib/receipts/arkiv";

// Shared receipts for a team, read live from Arkiv. Used by the team page and by external jobs.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const team = url.searchParams.get("team") ?? "";
  const period = url.searchParams.get("period") ?? undefined;
  if (!team) return NextResponse.json({ error: "team is required" }, { status: 400 });
  try {
    const receipts = await fetchTeamReceipts(team, period);
    return NextResponse.json({ team, period, receipts });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
