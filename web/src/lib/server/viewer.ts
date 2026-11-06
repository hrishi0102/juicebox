// Who is looking at the company side, and whether they may open the lists.
//
// One identity everywhere: your GitHub account. Where you prove it depends on where you are:
// on a hosted copy you click Sign in with GitHub; on your own laptop the GitHub login the app
// already uses for pull requests (the GitHub CLI or GITHUB_TOKEN) is enough.
import type { Source } from "@/lib/receipts/store";
import { githubLogin, githubTeams } from "@/lib/receipts/identity";
import { getSession } from "./session";
import { onLaptop } from "./data";

export type Viewer =
  | { kind: "demo" }
  | { kind: "github"; login: string; name?: string; avatar?: string; orgs: string[] }
  | { kind: "laptop"; login: string; orgs: string[] }
  | { kind: "none" };

export async function viewer(source: Source): Promise<Viewer> {
  if (source === "demo") return { kind: "demo" };
  const s = await getSession();
  if (s) return { kind: "github", login: s.login, name: s.name, avatar: s.avatar, orgs: s.orgs };
  if (await onLaptop()) {
    const me = await githubLogin();
    if (me) {
      const gh = await githubTeams();
      return { kind: "laptop", login: me.login, orgs: [...new Set([...(gh?.orgs ?? []), ...(gh?.teams ?? []).map((t) => t.org)])] };
    }
  }
  return { kind: "none" };
}

/** Lists are opened for members of the org only (and in the demo). Opening also needs the company key. */
export function isMember(v: Viewer, orgId: string) {
  if (v.kind === "demo") return true;
  if (v.kind === "none") return false;
  return v.orgs.some((o) => o.toLowerCase() === orgId.toLowerCase());
}
