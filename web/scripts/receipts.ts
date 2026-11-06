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
import type { Hex } from "viem";
import { loadDataset, rejudge, runPipeline } from "../src/lib/receipts/pipeline";
import { judgeConfigFromEnv } from "../src/lib/receipts/judge";
import { headline, summarize, weekOf } from "../src/lib/receipts/score";
import { buildReceipt, typedDataFor, verifyReceipt, type SignedReceipt } from "../src/lib/receipts/receipt";
import { readJson, writeJson } from "../src/lib/receipts/store";
import { makeDemoDataset, type OrgData } from "../src/lib/receipts/demo";
import { ARKIV_EXPLORER, arkivWriterAddress, exampleQuery, fetchTeamReceipts, publishReceipt } from "../src/lib/receipts/arkiv";
import { resolveGithubToken } from "../src/lib/receipts/github";
import { loadEnvLocal } from "../src/lib/receipts/env";
import { loadWeekStory, writeWeekStory } from "../src/lib/receipts/week";

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
      const key = process.env.RECEIPTS_SIGNER_KEY as Hex | undefined;
      if (!key) throw new Error("Set RECEIPTS_SIGNER_KEY in web/.env.local (a throwaway testnet key)");
      const account = privateKeyToAccount(key);
      const d = loadDataset(flag("demo") ? "demo" : "local");
      if (!d) throw new Error("No data");
      const w = positional[0] ? weekById(positional[0]) : weekOf(new Date());
      const s = summarize({ periodStart: w.start, periodEnd: w.end, sessions: d.sessions, judgements: d.judgements, tasks: d.tasks, changes: d.changes, owner: account.address });
      const ids = new Set(d.sessions.filter((x) => Date.parse(x.startedAt) >= Date.parse(w.start) && Date.parse(x.startedAt) < Date.parse(w.end)).map((x) => x.id));
      const r = buildReceipt({ owner: account.address, periodId: w.id, summary: s, judgements: d.judgements.filter((j) => ids.has(j.sessionId)) });
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
      console.log("Signer key:", process.env.RECEIPTS_SIGNER_KEY ? "set" : "missing (needed for CLI signing; the web app can use a browser wallet)");
      console.log("Arkiv writer key:", process.env.ARKIV_PRIVATE_KEY ? "set" : "missing (needed to publish shared receipts)");
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
      const team = readJson<{ id: string }>("local", "team.json", { id: process.env.RECEIPTS_TEAM || "my-team" }).id;
      const out = await publishReceipt(r, { team, level });
      r.share = { level, team, arkivKey: out.entityKey, arkivTx: out.txHash, publishedAt: new Date().toISOString() };
      writeJson("local", `receipts/${week}.json`, r);
      console.log(`Shared ${week} (${level}) with team ${team}`);
      console.log("entity", out.entityKey);
      console.log("tx", out.txHash, `(${ARKIV_EXPLORER}/tx/${out.txHash})`);
      console.log("writer", out.writer);
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
      for (const r of org.receipts) {
        const level = r.share?.level === "full" ? "full" : "totals";
        const out = await publishReceipt(r, { team: r.share?.team ?? org.teams[0].id, org: org.id, level });
        n++;
        console.log(`${r.message.period} ${r.share?.team} ${r.message.owner.slice(0, 8)} ${level} -> ${out.entityKey}`);
      }
      console.log(`Published ${n} demo receipts to Arkiv for org ${org.id}. Writer: ${arkivWriterAddress()}`);
      console.log("Query:", exampleQuery(org.teams[0].id));
      break;
    }
    case "arkiv": {
      // Read back what is on Arkiv for a team: npm run receipts -- arkiv acme-payments
      const team = positional[0] ?? readJson<{ id: string }>("local", "team.json", { id: "acme-payments" }).id;
      const rs = await fetchTeamReceipts(team);
      for (const r of rs) console.log(r.message.period, r.message.owner.slice(0, 10), r.share?.level, r.verified ? "verified" : "BAD SIGNATURE", r.headline, r.arkiv.key);
      console.log(`${rs.length} receipts for team ${team}`);
      break;
    }
    default:
      console.log("Commands: scan, judge, week, sign, share, team, demo, publish-demo, arkiv, doctor. See scripts/receipts.ts for flags.");
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
