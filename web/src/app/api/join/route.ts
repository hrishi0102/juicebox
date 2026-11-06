import { NextResponse } from "next/server";
import { z } from "zod";
import { githubTeams } from "@/lib/receipts/identity";
import { writeJson } from "@/lib/receipts/store";
import { currentSource, onLaptop } from "@/lib/server/data";
import { rejectCrossSite } from "@/lib/server/guard";

// Join your company: which GitHub org and team your receipts go to. Saved in ~/.receipts on this
// laptop, in the same files `npm run receipts -- org` and `team` write. The choices come from your
// own GitHub orgs and teams, so you can only join a company you are in.
const Id = z.string().min(1).max(140).regex(/^[A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+)?$/);
const Body = z.object({ org: Id, orgName: z.string().max(100).optional(), team: Id, teamName: z.string().max(100).optional() });

export async function POST(req: Request) {
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;
  if ((await currentSource()) === "demo") return NextResponse.json({ ok: false, error: "The demo company is fixed. Leave the demo to join your own company." }, { status: 400 });
  if (!(await onLaptop())) return NextResponse.json({ ok: false, error: "You join your company on your own laptop." }, { status: 400 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Pick a company and a team." }, { status: 400 });
  const { org, team } = parsed.data;
  if (!team.startsWith(`${org}/`)) return NextResponse.json({ ok: false, error: "That team is not in that company." }, { status: 400 });

  const gh = await githubTeams();
  const inOrg = gh?.orgs.some((o) => o.toLowerCase() === org.toLowerCase());
  const inTeam = team === `${org}/everyone` || gh?.teams.some((t) => `${t.org}/${t.slug}`.toLowerCase() === team.toLowerCase());
  if (!gh || !inOrg || !inTeam) return NextResponse.json({ ok: false, error: "Your GitHub login is not in that company or team." }, { status: 403 });

  const teamName = parsed.data.teamName || gh.teams.find((t) => `${t.org}/${t.slug}` === team)?.name || "Everyone";
  const orgName = parsed.data.orgName || org;
  writeJson("local", "team.json", { id: team, name: teamName });
  writeJson("local", "org.json", { id: org, name: orgName, teams: [{ id: team, name: teamName }] });
  return NextResponse.json({ ok: true, org, team, teamName });
}
