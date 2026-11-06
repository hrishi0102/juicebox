// Runs the monthly check in Node against live Arkiv and GitHub, with the same code the DON runs.
// No CRE account needed. From cre/receipts-monthly:
//
//   node check-live.ts                 (reads ARKIV_ACCESS_KEY and GITHUB_TOKEN from web/.env.local or the shell)
//   node check-live.ts acme-platform   (another team)
//   node check-live.ts --as-of=2026-11-01   (as of another day; default now)

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { checkTeam, type Fetch } from "./score.ts";

const config = JSON.parse(readFileSync(new URL("./config.staging.json", import.meta.url), "utf8"));
const envFile = new URL("../../web/.env.local", import.meta.url);
const env: Record<string, string> = existsSync(envFile)
  ? Object.fromEntries(
      readFileSync(envFile, "utf8")
        .split("\n")
        .filter((l) => /^[A-Z_]+=/.test(l))
        .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")]),
    )
  : {};

let calls = 0;
// Synchronous, like CRE's node mode: one curl per request.
const fetchSync: Fetch = (req) => {
  calls++;
  const args = ["-s", "-X", req.method, "-w", "\n%{http_code}", "--max-time", "20"];
  for (const [k, v] of Object.entries(req.headers)) args.push("-H", `${k}: ${v}`);
  if (req.body) args.push("--data-binary", req.body);
  args.push(req.url);
  const out = execFileSync("curl", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const cut = out.lastIndexOf("\n");
  return { status: Number(out.slice(cut + 1)), body: out.slice(0, cut) };
};

const teamId = process.argv.slice(2).find((a) => !a.startsWith("--")) ?? config.teamId;
// As of now, like the workflow (it uses the DON's clock). --as-of=2026-11-01 checks as of another day.
const flag = process.argv.find((a) => a.startsWith("--as-of="));
const asOf = flag ? Date.parse(flag.slice(8)) / 1000 : Math.floor(Date.now() / 1000);
const started = Date.now();
const score = checkTeam(
  fetchSync,
  { ...config, teamId },
  { arkivAccessKey: process.env.ARKIV_ACCESS_KEY ?? env.ARKIV_ACCESS_KEY, githubToken: process.env.GITHUB_TOKEN ?? env.GITHUB_TOKEN },
  asOf,
);
console.log(`team ${teamId}, as of ${new Date(asOf * 1000).toISOString().slice(0, 10)}: ${calls} HTTP calls in ${((Date.now() - started) / 1000).toFixed(1)} s`);
console.log(JSON.stringify(score, null, 2));
