// Run with: npm test
// The synthetic transcript below is written to a temp folder at test time. No real logs are used.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { normalizeModel, priceUsage } from "../src/lib/receipts/pricing";
import { listSessionFiles, parseSession, parsePrUrl } from "../src/lib/receipts/parse";
import { buildReceipt, merkleProof, merkleRoot, typedDataFor, verifyProof, verifyReceipt } from "../src/lib/receipts/receipt";
import { heuristicLabel, judgeAllHeuristic } from "../src/lib/receipts/heuristics";
import { summarize, buildTasks, weekOf } from "../src/lib/receipts/score";
import type { Change, Session } from "../src/lib/receipts/types";

test("pricing: Opus 5.5 with 1h cache writes matches Claude Code's own number", () => {
  // Real per-model totals from a Claude Code cost-state record (Opus 5.5, $35.5007572)
  const r = priceUsage("claude-opus-5-5", {
    input_tokens: 15131,
    output_tokens: 576070,
    cache_read_input_tokens: 69473711,
    cache_creation_input_tokens: 1253959,
    cache_creation: { ephemeral_5m_input_tokens: 0, ephemeral_1h_input_tokens: 1253959 },
  });
  assert.ok(Math.abs(r.usd - 35.5007572) < 0.01, `got ${r.usd}`);
  assert.equal(r.known, true);
});

test("pricing: fast mode doubles, web searches add $0.01, unknown models fall back", () => {
  const base = priceUsage("claude-opus-5-5", { input_tokens: 1000, output_tokens: 1000 });
  const fast = priceUsage("claude-opus-5-5", { input_tokens: 1000, output_tokens: 1000, speed: "fast" });
  assert.ok(Math.abs(fast.usd - 2 * base.usd) < 1e-9);
  const web = priceUsage("claude-haiku-4-5-20251001", { input_tokens: 0, output_tokens: 0, server_tool_use: { web_search_requests: 3 } });
  assert.ok(Math.abs(web.usd - 0.03) < 1e-9);
  assert.equal(normalizeModel("claude-haiku-4-5-20251001"), "claude-haiku-4-5");
  assert.equal(priceUsage("claude-opus-9", { input_tokens: 1 }).known, false);
});

test("parser: dedupes repeated usage lines, adds subagents, reads PRs, commits and cost-state", async () => {
  const root = mkdtempSync(join(tmpdir(), "receipts-test-"));
  const proj = join(root, "-Users-x-code-app");
  mkdirSync(join(proj, "s1", "subagents"), { recursive: true });
  const usage = { input_tokens: 10, output_tokens: 100, cache_read_input_tokens: 1000, cache_creation_input_tokens: 0 };
  const base = { sessionId: "s1", cwd: "/Users/x/code/app", gitBranch: "feat/thing", version: "2.1.0" };
  const lines = [
    { ...base, type: "user", timestamp: "2026-11-02T10:00:00Z", message: { role: "user", content: "add a thing" } },
    // one API response written as two lines (thinking + tool_use) with the same usage
    { ...base, type: "assistant", timestamp: "2026-11-02T10:00:05Z", requestId: "r1", message: { id: "m1", model: "claude-opus-5-5", usage, content: [{ type: "thinking", thinking: "" }] } },
    { ...base, type: "assistant", timestamp: "2026-11-02T10:00:06Z", requestId: "r1", message: { id: "m1", model: "claude-opus-5-5", usage, content: [{ type: "tool_use", id: "t1", name: "Edit", input: { file_path: "/Users/x/code/app/src/a.ts" } }] } },
    { ...base, type: "user", timestamp: "2026-11-02T10:00:07Z", message: { role: "user", content: [{ type: "tool_result", tool_use_id: "t1", is_error: false }] }, toolUseResult: { structuredPatch: [{ lines: ["+a", "+b", "-c", " d"] }] } },
    { ...base, type: "user", timestamp: "2026-11-02T10:01:00Z", message: { role: "user", content: [{ type: "tool_result", tool_use_id: "t2" }] }, toolUseResult: { gitOperation: { commit: { sha: "abc1234", kind: "committed", branch: "feat/thing" }, push: { branch: "feat/thing" } } } },
    { type: "pr-link", sessionId: "s1", prNumber: 7, prRepository: "acme/app", prUrl: "https://github.com/acme/app/pull/7", timestamp: "2026-11-02T10:02:00Z" },
    { type: "cost-state", sessionId: "s1", totalCostUSD: 0.5, totalLinesAdded: 2, totalLinesRemoved: 1, modelUsage: {} },
    { type: "cost-state", sessionId: "s1", totalCostUSD: 0.2, totalLinesAdded: 0, totalLinesRemoved: 0, modelUsage: {} }, // resumed: new segment
  ];
  writeFileSync(join(proj, "s1.jsonl"), lines.map((l) => JSON.stringify(l)).join("\n"));
  const sub = [{ ...base, type: "assistant", isSidechain: true, agentId: "a1", timestamp: "2026-11-02T10:00:30Z", requestId: "r2", message: { id: "m2", model: "claude-haiku-5-5", usage, content: [] } }];
  writeFileSync(join(proj, "s1", "subagents", "agent-a1.jsonl"), sub.map((l) => JSON.stringify(l)).join("\n"));

  const files = listSessionFiles(root);
  assert.equal(files.length, 1);
  assert.equal(files[0].subagents.length, 1);
  const s = (await parseSession(files[0]))!;
  assert.equal(s.signals.assistantTurns, 2, "one main response + one subagent response");
  const opus = priceUsage("claude-opus-5-5", usage).usd;
  const haiku = priceUsage("claude-haiku-5-5", usage).usd;
  assert.ok(Math.abs(s.cost.usd - (opus + haiku)) < 1e-6, "usage counted once per response");
  assert.ok(Math.abs((s.cost.claudeReportedUsd ?? 0) - 0.7) < 1e-9, "cost-state segments are summed");
  assert.deepEqual(s.git.prs.map((p) => p.url), ["https://github.com/acme/app/pull/7"]);
  assert.equal(s.git.commits[0].sha, "abc1234");
  assert.deepEqual(s.branches, ["feat/thing"]);
  assert.equal(s.linesAdded, 2);
  assert.equal(s.linesRemoved, 1);
  assert.equal(s.signals.userPrompts, 1);
  assert.deepEqual(s.filesEdited, ["/Users/x/code/app/src/a.ts"]);
});

test("parsePrUrl", () => {
  assert.deepEqual(parsePrUrl("https://github.com/Org/repo/pull/12#discussion"), { repo: "Org/repo", number: 12, url: "https://github.com/Org/repo/pull/12" });
});

function fakeSession(id: string, over: Partial<Session> = {}): Session {
  return {
    id,
    projectDir: "p",
    cwd: "/c",
    repos: ["acme/app"],
    branches: [],
    startedAt: "2026-11-03T10:00:00Z",
    endedAt: "2026-11-03T11:00:00Z",
    activeMinutes: 60,
    models: ["claude-opus-5-5"],
    cost: { usd: 10, tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 }, byModel: {}, webSearches: 0, unknownModels: [] },
    filesEdited: ["/c/a.ts"],
    linesAdded: 40,
    linesRemoved: 5,
    git: { commits: [], pushes: [], prs: [] },
    signals: { userPrompts: 3, assistantTurns: 20, toolCalls: 30, toolErrors: 1, maxErrorStreak: 1, repeatedCommands: 0, maxEditsSameFile: 2, testRuns: 1, apiErrors: 0, compactions: 0, interruptions: 0, readOnlyRatio: 0.3, subagents: 0 },
    tools: {},
    ...over,
  };
}

function fakeChange(key: string, over: Partial<Change> = {}): Change {
  return { key, repo: "acme/app", type: "pr", number: 1, url: `https://github.com/${key.replace("#", "/pull/")}`, title: "feat: x", kind: "feature", state: "merged", mergedAt: "2026-11-04T00:00:00Z", additions: 40, deletions: 5, files: ["a.ts"], commitShas: [], reverted: false, ...over };
}

test("judge rules: shipped, open, abandoned only with a known repo, learned, looped, overkill", () => {
  const now = Date.parse("2026-11-20T00:00:00Z");
  const merged = fakeChange("acme/app#1");
  assert.equal(heuristicLabel(fakeSession("a"), [{ change: merged, confidence: 0.9 }], now).label, "Shipped");
  assert.equal(heuristicLabel(fakeSession("b"), [{ change: fakeChange("acme/app#2", { state: "open", mergedAt: undefined }), confidence: 0.9 }], now).label, "Pending");
  assert.equal(heuristicLabel(fakeSession("c"), [], now).label, "Abandoned");
  assert.equal(heuristicLabel(fakeSession("d", { repos: [] }), [], now).label, "Pending", "no repo found: not judged");
  assert.equal(heuristicLabel(fakeSession("e", { filesEdited: [], linesAdded: 0, linesRemoved: 0 }), [], now).label, "Learned");
  const loopy = fakeSession("f", { signals: { ...fakeSession("x").signals, maxErrorStreak: 8, repeatedCommands: 4, toolErrors: 20 } });
  assert.equal(heuristicLabel(loopy, [], now).label, "Looped");

  // Overkill: a tiny change that cost far more than small tasks usually do.
  const tiny = fakeSession("g", { linesAdded: 3, linesRemoved: 1, cost: { ...fakeSession("x").cost, usd: 80 } });
  const tinyChange = fakeChange("acme/app#3", { additions: 3, deletions: 1 });
  const js = judgeAllHeuristic([tiny], [{ sessionId: "g", changeKey: tinyChange.key, reason: "pr-link", confidence: 0.97 }], [tinyChange], now);
  assert.equal(js[0].label, "Overkill");
});

test("receipts: sign, verify, catch tampering, prove one task", async () => {
  const account = privateKeyToAccount(generatePrivateKey());
  const s1 = fakeSession("s1");
  const s2 = fakeSession("s2", { startedAt: "2026-11-04T10:00:00Z", endedAt: "2026-11-04T11:00:00Z", cost: { ...fakeSession("x").cost, usd: 4 } });
  const c1 = fakeChange("acme/app#1", { survival: { measuredAt: "", matured: false, linesAdded: 40, linesAlive: 36, ratio: 0.9, filesChecked: 1, method: "blame" } });
  const c2 = fakeChange("acme/app#2", { reverted: true });
  const matches = [
    { sessionId: "s1", changeKey: c1.key, reason: "pr-link" as const, confidence: 0.97 },
    { sessionId: "s2", changeKey: c2.key, reason: "branch" as const, confidence: 0.75 },
  ];
  const now = Date.parse("2026-11-20T00:00:00Z");
  const judgements = judgeAllHeuristic([s1, s2], matches, [c1, c2], now);
  const tasks = buildTasks([s1, s2], matches, [c1, c2], judgements);
  const w = weekOf(new Date("2026-11-03T00:00:00Z"));
  const summary = summarize({ periodStart: w.start, periodEnd: w.end, sessions: [s1, s2], judgements, tasks, changes: [c1, c2] });
  assert.equal(summary.shippedTasks, 2, "a reverted task still counts as shipped");
  assert.ok(summary.survivalPct !== null && summary.survivalPct < 90, "but its lines count as dead");

  const r = buildReceipt({ owner: account.address, periodId: w.id, summary, judgements });
  r.signature = await account.signTypedData(typedDataFor(r));
  assert.equal((await verifyReceipt(r)).ok, true);

  const tampered = structuredClone(r);
  tampered.message.spendCents = "1";
  assert.equal((await verifyReceipt(tampered)).ok, false);

  const badEvidence = structuredClone(r);
  badEvidence.evidence[0].costCents += 1;
  assert.equal((await verifyReceipt(badEvidence)).ok, false);

  const leaves = r.evidence.map((e) => e.leaf);
  const root = merkleRoot(leaves);
  assert.equal(root, r.message.evidenceRoot);
  assert.equal(verifyProof(root, leaves[0], merkleProof(leaves, leaves[0])), true);
});
