#!/usr/bin/env -S npx tsx
// Receipts CLI.
//   npm run receipts -- scan [--days 30] [--no-judge] [--no-survival]
//   npm run receipts -- judge [--engine 0g|heuristic|openai-compatible] [--limit 5]
//   npm run receipts -- week [2026-W45]          print the summary for a week
//   npm run receipts -- write [2026-W45] [--demo] have the private AI write "what you got" for a week
//   npm run receipts -- sign [2026-W45]          sign a receipt with RECEIPTS_SIGNER_KEY
//   npm run receipts -- team <id> "Name"         set the team id used for sharing
//   npm run receipts -- share 2026-W45           publish a signed receipt (with its PR list) to Arkiv
//   npm run receipts -- demo                     regenerate the synthetic demo dataset
//   npm run receipts -- publish-demo             write the demo team's signed receipts to Arkiv
//   npm run receipts -- arkiv [team]             read a team's shared receipts back from Arkiv
//   npm run receipts -- doctor                   check config (GitHub, 0G, Arkiv)

import { privateKeyToAccount } from "viem/accounts";
import { loadDataset, rejudge, runPipeline } from "../src/lib/receipts/pipeline";
import { judgeConfigFromEnv } from "../src/lib/receipts/judge";
import { headline, summarize, weekOf } from "../src/lib/receipts/score";
import { buildReceipt, typedDataFor, verifyReceipt, type SignedReceipt } from "../src/lib/receipts/receipt";
import { readJson, writeJson } from "../src/lib/receipts/store";
import { makeDemoDataset, type OrgData } from "../src/lib/receipts/demo";
import { ARKIV_EXPLORER, arkivPublic, arkivWriterAddress, exampleQuery, fetchReceiptByKey, fetchTeamReceipts, publishReceipt } from "../src/lib/receipts/arkiv";
import { resolveGithubToken } from "../src/lib/receipts/github";
import { loadEnvLocal } from "../src/lib/receipts/env";
import { envPrivateKey } from "../src/lib/receipts/keys";
import { githubLogin, githubTeams, laptopAccount } from "../src/lib/receipts/identity";
import { demoKey } from "../src/lib/receipts/demo";
import { loadWeekStory, writeWeekStory } from "../src/lib/receipts/week";
import { swarmConfig } from "../src/lib/receipts/swarm";

loadEnvLocal();
const [cmd = "help", ...rest] = process.argv.slice(2);
const flag = (name: string) => rest.includes(`--${name}`);
const opt = (name: string) => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : undefined;
};
const positional = rest.filter((r, i) => !r.startsWith("--") && !rest[i - 1]?.startsWith("--"));

function log(stage: string, detail?: string) {
  console.log(`[${stage}] ${detail ?? ""}`);
}

async function main() {
  switch (cmd) {
    case "scan": {
      const days = Number(opt("days") ?? 30);
      const d = await runPipeline({ days, skipJudge: flag("no-judge"), skipSurvival: flag("no-survival"), progress: log });
      const w = weekOf(new Date());
      const s = summarize({ periodStart: new Date(Date.now() - days * 86400_000).toISOString(), periodEnd: new Date().toISOString(), sessions: d.sessions, judgements: d.judgements, tasks: d.tasks, changes: d.changes });
      console.log(`\nLast ${days} days: ${headline(s)}`);
      console.log(`Sessions ${s.sessions}, waste ${s.wastePct}%, kept work per $100: ${s.keptWorkPer100Usd}`);
      console.log(`Labels:`, s.labelCounts);
      console.log(`Current week: ${w.id}. Open the app with: npm run dev`);
      break;
    }
    case "judge": {
      const engine = (opt("engine") as "0g" | "heuristic" | "openai-compatible") ?? judgeConfigFromEnv().engine;
      const cfg = { ...judgeConfigFromEnv(), engine };
      if (engine === "0g") Object.assign(cfg, judgeConfigFromEnv().engine === "0g" ? judgeConfigFromEnv() : { baseUrl: process.env.ZG_ROUTER_URL || "https://router-api.0g.ai/v1", apiKey: process.env.ZG_API_KEY, model: process.env.ZG_MODEL });
      const d = loadDataset("local");
      if (!d) throw new Error("Run `scan` first");
      const limit = Number(opt("limit") ?? 0);
      const only = limit ? new Set(d.sessions.slice(0, limit).map((s) => s.id)) : undefined;
      const out = await rejudge("local", cfg, only, log);
      const counts: Record<string, number> = {};
      for (const j of out.judgements) counts[`${j.label} (${j.judge.engine})`] = (counts[`${j.label} (${j.judge.engine})`] ?? 0) + 1;
      console.log(counts);
      break;
    }
    case "week": {
      const source = flag("demo") ? "demo" : "local";
      const d = loadDataset(source);
      if (!d) throw new Error("No data. Run `scan` or `demo` first");
      const w = positional[0] ? weekById(positional[0]) : weekOf(new Date());
      const s = summarize({ periodStart: w.start, periodEnd: w.end, sessions: d.sessions, judgements: d.judgements, tasks: d.tasks, changes: d.changes, story: loadWeekStory(source, w.id) });
      console.log(w.id, headline(s));
      console.log(s.oneLiner);
      for (const i of s.items) console.log(`  ${i.category.padEnd(12)} ${i.title}  ($${i.costUsd.toFixed(2)}, ${i.sessions.length} sessions${i.prs.length ? `, ${i.prs.length} PR` : ""}${i.inProgress ? ", in progress" : ""})`);
      if (flag("json")) console.log(JSON.stringify({ ...s, tasks: s.tasks.length }, null, 2));
      break;
    }
    case "write": {
      const source = flag("demo") ? "demo" : "local";
      const w = positional[0] ? weekById(positional[0]) : weekOf(new Date());
      const t0 = Date.now();
      const r = await writeWeekStory(source, w.id, { progress: (stage, detail) => log(stage, detail) });
      if (r.error) console.log(r.error);
      console.log(`\n${w.id} (${r.story.engine}${r.story.model ? `, ${r.story.model}` : ""}): ${r.story.oneLiner}`);
      for (const i of r.story.items) console.log(`  ${i.category.padEnd(12)} ${i.title}  ($${i.costUsd.toFixed(2)}, ${i.sessions.length} sessions)`);
      console.log(`\nAI calls: ${r.judged} sessions + 1 week (${r.failed} failed), ${r.story.requestIds.length} request ids, verified: ${r.story.verified ?? "n/a"}, ${((Date.now() - t0) / 1000).toFixed(0)}s`);
      break;
    }
    case "sign": {
      // Signs with RECEIPTS_SIGNER_KEY if set, else the key made on this laptop (same as the app).
      const demo = flag("demo");
      const key = envPrivateKey("RECEIPTS_SIGNER_KEY");
      const account = demo ? privateKeyToAccount(demoKey("You")) : key ? privateKeyToAccount(key) : laptopAccount(true)!;
      const d = loadDataset(demo ? "demo" : "local");
      if (!d) throw new Error("No data");
      const w = positional[0] ? weekById(positional[0]) : weekOf(new Date());
      const story = loadWeekStory(demo ? "demo" : "local", w.id);
      const s = summarize({ periodStart: w.start, periodEnd: w.end, sessions: d.sessions, judgements: d.judgements, tasks: d.tasks, changes: d.changes, owner: account.address, story });
      const ids = new Set(d.sessions.filter((x) => Date.parse(x.startedAt) >= Date.parse(w.start) && Date.parse(x.startedAt) < Date.parse(w.end)).map((x) => x.id));
      const author = demo ? "you" : ((await githubLogin())?.login ?? "");
      const r = buildReceipt({ owner: account.address, author, periodId: w.id, summary: s, judgements: d.judgements.filter((j) => ids.has(j.sessionId)) });
      r.signature = await account.signTypedData(typedDataFor(r));
      r.signedAt = new Date().toISOString();
      const v = await verifyReceipt(r);
      // Signed receipts always go to ~/.receipts (demo ones in their own folder), never into the repo.
      const p = writeJson("local", `${flag("demo") ? "demo-receipts" : "receipts"}/${w.id}.json`, r);
      console.log(r.headline);
      console.log("digest", r.digest);
      console.log("verified", v.ok, v.checks.map((c) => `${c.ok ? "ok" : "FAIL"} ${c.name}`).join("; "));
      console.log("saved", p);
      break;
    }
    case "demo": {
      const d = await makeDemoDataset();
      writeJson("demo", "dataset.json", d.dataset);
      writeJson("demo", "org.json", d.org);
      writeJson("demo", "sessions.json", { count: d.dataset.sessions.length, generatedAt: d.dataset.generatedAt });
      console.log(`Demo data: ${d.dataset.sessions.length} sessions for "You", ${d.org.teams.length} teams, ${d.org.members.length} people, ${d.org.receipts.length} shared receipts`);
      break;
    }
    case "doctor": {
      const gh = resolveGithubToken();
      const j = judgeConfigFromEnv();
      console.log("GitHub token:", gh ? "found" : "missing (set GITHUB_TOKEN or `gh auth login`)");
      console.log("Judge engine:", j.engine, j.model ?? "", j.engine === "0g" && !j.apiKey ? "(ZG_API_KEY missing)" : "");
      console.log("Signing key:", process.env.RECEIPTS_SIGNER_KEY ? "RECEIPTS_SIGNER_KEY" : laptopAccount(false) ? `made on this laptop (${laptopAccount(false)!.address})` : "made on this laptop at the first signature");
      console.log("Arkiv company wallet:", arkivWriterAddress() ?? "missing (needed to share with your company)");
      console.log("Arkiv access key:", process.env.ARKIV_ACCESS_KEY ? "set" : "missing (the public endpoint is heavily rate limited)");
      // Swarm: where uploads go, and for your own Bee node, its wallet and batch.
      const sw = swarmConfig();
      console.log("Swarm:", sw.batch ? `uploads go to ${sw.api}` : "off (add the SWARM_* lines from .env.example to .env.local)");
      if (sw.batch) {
        const get = async (path: string) => {
          const r = await fetch(`${sw.api}${path}`, { signal: AbortSignal.timeout(8000) });
          if (!r.ok) throw new Error(`${path} answered ${r.status}`);
          return r.json();
        };
        try {
          const h = await fetch(`${sw.api}/health`, { signal: AbortSignal.timeout(8000) });
          if (!h.ok) throw new Error(`/health answered ${h.status}`);
          console.log("  reachable: yes");
        } catch (e) {
          console.log("  reachable: no,", String(e).slice(0, 100));
        }
        if (/^0+$/.test(sw.batch)) console.log("  batch: the gateway's own (we send the all-zero batch id)");
        else {
          try {
            const a = await get("/addresses");
            const w = await get("/wallet");
            console.log(`  node wallet: ${a.ethereum} (${(Number(w.nativeTokenBalance) / 1e18).toFixed(4)} ETH, ${(Number(w.bzzBalance) / 1e16).toFixed(4)} BZZ)`);
          } catch (e) {
            console.log("  node wallet: unknown,", String(e).slice(0, 100));
          }
          try {
            const b = await get(`/stamps/${sw.batch}`);
            console.log(`  batch ${sw.batch.slice(0, 10)}...: usable ${b.usable}, depth ${b.depth}, about ${Math.round(Number(b.batchTTL) / 3600)} hours left, utilization ${b.utilization}`);
          } catch (e) {
            console.log("  batch: not found on this node,", String(e).slice(0, 100));
          }
        }
      }
      const writer = arkivWriterAddress();
      if (writer) {
        try {
          const wei = await arkivPublic().getBalance({ address: writer as `0x${string}` });
          console.log("Arkiv company wallet balance:", `${(Number(wei) / 1e18).toFixed(5)} tGLM`, wei === BigInt(0) ? "(empty: claim at https://hub.arkiv.network/faucet)" : "");
        } catch (e) {
          console.log("Arkiv company wallet balance: could not read", String(e).slice(0, 120));
        }
      }
      break;
    }
    case "team": {
      // npm run receipts -- team my-team-id "My team name"
      const [id, ...name] = positional;
      if (!id) throw new Error('Usage: team <team-id> "Team name"');
      writeJson("local", "team.json", { id, name: name.join(" ") || id });
      console.log(`Team set to ${id}. Shared receipts go to Arkiv under this team id.`);
      break;
    }
    case "share": {
      // npm run receipts -- share 2026-W45 [--level full]
      const level = opt("level") === "totals" ? "totals" : "full";
      const week = positional[0];
      if (!week) throw new Error("Usage: share <week> [--level totals|full]");
      const r = readJson<SignedReceipt | null>("local", `receipts/${week}.json`, null);
      if (!r) throw new Error(`No signed receipt for ${week}. Run: sign ${week}`);
      // Company and team: CLI settings first, else your GitHub org and team, else defaults.
      const gh = await githubTeams();
      const ghTeam = gh?.teams[0];
      const org = readJson<{ id: string } | null>("local", "org.json", null)?.id ?? ghTeam?.org ?? gh?.orgs[0] ?? "my-org";
      const team = readJson<{ id: string } | null>("local", "team.json", null)?.id ?? (ghTeam ? `${ghTeam.org}/${ghTeam.slug}` : `${org}/everyone`);
      const out = await publishReceipt(r, { team, org, level });
      r.share = { level, team, org, arkivKey: out.entityKey, arkivTx: out.txHash, publishedAt: new Date().toISOString() };
      writeJson("local", `receipts/${week}.json`, r);
      console.log(`Shared ${week} (${level}) with ${team} at ${org}`);
      console.log("entity", out.entityKey, "(read-only, owned by", out.owner + ")");
      console.log("tx", out.txHash, `(${ARKIV_EXPLORER}/tx/${out.txHash})`);
      console.log("gas paid by", out.writer);
      break;
    }
    case "org": {
      // npm run receipts -- org acme "Acme" payments:Payments platform:Platform
      const [id, name, ...teams] = positional;
      if (!id) throw new Error('Usage: org <org-id> "Org name" [team-id:Team name ...]');
      const list = teams.map((t) => ({ id: t.split(":")[0], name: t.split(":").slice(1).join(":") || t.split(":")[0] }));
      writeJson("local", "org.json", { id, name: name ?? id, teams: list.length ? list : [readJson<{ id: string; name: string }>("local", "team.json", { id: "my-team", name: "My team" })] });
      console.log(`Org set to ${id}. Shared receipts are tagged with it, and the Org page reads every team.`);
      break;
    }
    case "publish-demo": {
      // Writes the signed demo company receipts to Arkiv, so the org and team pages read them live.
      const org = readJson<OrgData | null>("demo", "org.json", null);
      if (!org) throw new Error("No demo org. Run: demo");
      let n = 0;
      const from = Number(opt("from") ?? 0);
      const limit = Number(opt("limit") ?? org.receipts.length);
      // Filters: --week 2026-W45 (one week), --who you (one person's handle)
      const wantWeek = opt("week");
      const wantWho = opt("who");
      const picked = org.receipts.filter((r) => (!wantWeek || r.message.period === wantWeek) && (!wantWho || r.message.author === wantWho));
      for (const r of picked.slice(from, from + limit)) {
        const level = r.share?.level === "full" ? "full" : "totals";
        const out = await publishReceipt(r, { team: r.share?.team ?? org.teams[0].id, org: org.id, level });
        n++;
        console.log(`${r.message.period} ${r.share?.team} ${r.message.author} owner ${out.owner.slice(0, 8)} -> ${out.entityKey}${out.swarm ? ` (sealed, Swarm ${out.swarm})` : ""}`);
      }
      console.log(`Published ${n} demo receipts to Arkiv for org ${org.id}. Writer: ${arkivWriterAddress()}`);
      console.log("Query:", exampleQuery(org.teams[0].id));
      break;
    }
    case "arkiv": {
      // Read back what is on Arkiv for a team: npm run receipts -- arkiv acme-payments
      const team = positional[0] ?? readJson<{ id: string }>("local", "team.json", { id: "acme-payments" }).id;
      const rs = await fetchTeamReceipts(team);
      for (const r of rs)
        console.log(
          r.message.period,
          `signed by ${r.message.owner.slice(0, 10)}`,
          `entity owned by ${(r.arkiv.owner ?? "").slice(0, 10)}`,
          r.verified ? "verified" : "BAD SIGNATURE",
          r.headline,
          r.arkiv.key,
        );
      console.log(`${rs.length} receipts for team ${team}`);
      break;
    }
    case "entity": {
      // Read one shared week from Arkiv: as the company (opens the sealed Swarm copy with the
      // company key) and as the public. npm run receipts -- entity 0x<entity key>
      const key = positional[0];
      if (!key) throw new Error("Usage: entity <arkiv entity key>");
      for (const open of [true, false]) {
        const r = await fetchReceiptByKey(key, open);
        if (!r) throw new Error("No entity with that key");
        console.log(open ? "\nAs the company (with the company key):" : "\nAs the public (no key):");
        console.log(`  signature ${r.verified ? "verified" : "FAILED"}, level ${r.share?.level}, owner ${r.arkiv.owner}`);
        console.log(`  ${r.items.length} items shown, ${r.evidence.length} PRs, ${r.judges.length} private AI records`);
        for (const i of r.items.slice(0, 5)) console.log(`    ${i.category.padEnd(12)} ${i.title}`);
        if (r.swarm) console.log(`  Swarm ${r.swarm.ref}: ${r.swarm.opened ? "opened and checked (SHA-256, signature)" : `not opened${r.swarm.error ? ` (${r.swarm.error})` : ""}`}`);
      }
      break;
    }
    default:
      console.log("Commands: scan, write, week, sign, share, team, org, demo, publish-demo, arkiv, entity, doctor. See scripts/receipts.ts for flags.");
  }
}

function weekById(id: string) {
  const m = id.match(/^(\d{4})-W(\d{2})$/);
  if (!m) throw new Error("Week format: 2026-W45");
  const jan4 = new Date(Date.UTC(Number(m[1]), 0, 4));
  const day = jan4.getUTCDay() || 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - (day - 1) + (Number(m[2]) - 1) * 7);
  return weekOf(monday);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
