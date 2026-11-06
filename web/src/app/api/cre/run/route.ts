import { NextResponse } from "next/server";
import { runMonthlyCheck } from "@/lib/server/cre-run";
import { onLaptop } from "@/lib/server/data";
import { rejectCrossSite } from "@/lib/server/guard";

export const maxDuration = 200;

// Runs the Chainlink CRE monthly check now (the CLI's simulation, posting to Sepolia). Laptop only.
export async function POST(req: Request) {
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;
  if (!(await onLaptop())) return NextResponse.json({ ok: false, error: "This only runs on the laptop that has the CRE CLI." }, { status: 403 });
  return NextResponse.json(await runMonthlyCheck());
}
