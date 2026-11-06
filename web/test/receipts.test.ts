// Run with: npm test
// The synthetic transcript below is written to a temp folder at test time. No real logs are used.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { normalizeModel, priceUsage } from "../src/lib/receipts/pricing";
import { listSessionFiles, parseSession, parsePrUrl, scanSessions } from "../src/lib/receipts/parse";
import { buildReceipt, merkleProof, merkleRoot, revealItems, signedNumbers, typedDataFor, verifyProof, verifyReceipt } from "../src/lib/receipts/receipt";
import { heuristicLabel, judgeAllHeuristic } from "../src/lib/receipts/heuristics";
import { summarize, buildTasks, weekOf } from "../src/lib/receipts/score";
import { cleanTitle, parseSessionVerdict, parseWeekAnswer, toCategory } from "../src/lib/receipts/judge-core";
import { countLine, itemsFromAnswer, ruleItems, sessionLines } from "../src/lib/receipts/story";
import { decryptBlob, encryptBlob, openPointer, publicKeyOf, sealPointer } from "../src/lib/receipts/seal";
import { computeEfficiency } from "../src/lib/receipts/efficiency";
import type { Change, Judgement, Session } from "../src/lib/receipts/types";

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

test("parser: a continued conversation's copy counts only its new part, and step times are kept", async () => {
  const root = mkdtempSync(join(tmpdir(), "receipts-copy-"));
  const proj = join(root, "-Users-x-code-app");
  mkdirSync(proj, { recursive: true });
  const usage = { input_tokens: 10, output_tokens: 100, cache_read_input_tokens: 1000, cache_creation_input_tokens: 0 };
  const base = { cwd: "/Users/x/code/app", version: "2.1.0" };
  const line = (uuid: string, extra: object) => ({ ...base, uuid, ...extra });
  const original = [
    line("u1", { sessionId: "orig", type: "user", timestamp: "2026-11-02T10:00:00Z", message: { role: "user", content: "plan the login page" } }),
    line("u2", { sessionId: "orig", type: "assistant", timestamp: "2026-11-02T10:00:05Z", requestId: "r1", message: { id: "m1", model: "claude-opus-5-5", usage, content: [{ type: "tool_use", id: "p1", name: "ExitPlanMode", input: {} }] } }),
    line("u3", { sessionId: "orig", type: "assistant", timestamp: "2026-11-02T10:10:00Z", requestId: "r2", message: { id: "m2", model: "claude-opus-5-5", usage, content: [{ type: "tool_use", id: "t1", name: "Edit", input: { file_path: "/Users/x/code/app/a.ts" } }] } }),
    line("u4", { sessionId: "orig", type: "assistant", timestamp: "2026-11-02T10:11:00Z", requestId: "r3", message: { id: "m3", model: "claude-opus-5-5", usage, content: [{ type: "text", text: "Done. Want me to add tests too?" }] } }),
  ];
  // The copy repeats every line of the original (same uuids), then continues.
  const copy = [
    ...original.map((l) => ({ ...l, sessionId: "copy" })),
    line("u5", { sessionId: "copy", type: "user", timestamp: "2026-11-02T12:00:00Z", message: { role: "user", content: "yes, add tests" } }),
    line("u6", { sessionId: "copy", type: "assistant", timestamp: "2026-11-02T12:00:05Z", requestId: "r4", message: { id: "m4", model: "claude-opus-5-5", usage, content: [{ type: "text", text: "Added the tests." }] } }),
  ];
  writeFileSync(join(proj, "orig.jsonl"), original.map((l) => JSON.stringify(l)).join("\n"));
  writeFileSync(join(proj, "copy.jsonl"), copy.map((l) => JSON.stringify(l)).join("\n"));
  const sessions = await scanSessions({ root, includeCodex: false });
  const orig = sessions.find((s) => s.id === "orig")!;
  const cont = sessions.find((s) => s.id === "copy")!;
  const one = priceUsage("claude-opus-5-5", usage).usd;
  // Costs are kept to 4 decimals.
  assert.ok(Math.abs(orig.cost.usd - 3 * one) < 2e-4, `the original owns the shared history (${orig.cost.usd})`);
  assert.ok(Math.abs(cont.cost.usd - one) < 2e-4, `the copy counts only its new answer (${cont.cost.usd})`);
  assert.equal(cont.startedAt, "2026-11-02T12:00:00.000Z");
  // Step times from the original: plan, first edit 10 minutes after the prompt, an open question at the end.
  assert.equal(orig.timeline?.planAt, "2026-11-02T10:00:05.000Z");
  assert.equal(orig.timeline?.firstEditAt, "2026-11-02T10:10:00.000Z");
  assert.equal(orig.timeline?.endsOnQuestion, true);
  assert.equal(cont.timeline?.endsOnQuestion, false, "the copy's last answer is not a question");
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

test("private AI answers: forgiving parsing, safe titles", () => {
  const v = parseSessionVerdict('<think>hmm</think>```json\n{"category":"figured out","title":"Why the build failed \u2014 again.","in_progress":false,"difficulty":"3","kind":"fix","reason":"r","tip":""}\n```');
  assert.equal(v.category, "Figured out");
  assert.equal(v.title, "Why the build failed, again");
  assert.equal(v.difficulty, 3);
  assert.equal(toCategory("Research"), "Researched");
  assert.equal(toCategory("nonsense"), undefined);
  assert.equal(cleanTitle("fix sk-abcdefghijklmnop leak in /Users/me/app/src/x.ts for bob@acme.com"), "Fix a key leak in for an email");
  const w = parseWeekAnswer('{"items":[{"category":"Built","title":"Login page","sessions":["s1","S2"]}],"summary":"Good week."}');
  assert.deepEqual(w.items[0].sessions, ["S1", "S2"]);
  assert.throws(() => parseSessionVerdict("no json here"));
});

test("week list: one item per PR, sessions the AI skipped come back, waste goes last", () => {
  const pr = fakeChange("acme/app#7", { title: "Add login page" });
  const sessions = [
    fakeSession("a", { startedAt: "2026-11-02T10:00:00Z" }),
    fakeSession("b", { startedAt: "2026-11-03T10:00:00Z" }),
    fakeSession("c", { startedAt: "2026-11-04T10:00:00Z", filesEdited: [], linesAdded: 0, linesRemoved: 0 }),
    fakeSession("d", { startedAt: "2026-11-05T10:00:00Z" }),
  ];
  const matches = [
    { sessionId: "a", changeKey: pr.key, reason: "pr-link" as const, confidence: 0.97 },
    { sessionId: "b", changeKey: pr.key, reason: "branch" as const, confidence: 0.8 },
  ];
  const now = Date.parse("2026-11-20T00:00:00Z");
  const judgements: Judgement[] = judgeAllHeuristic(sessions, matches, [pr], now);
  const tasks = buildTasks(sessions, matches, [pr], judgements);
  const input = { sessions, judgements, tasks };

  const rules = ruleItems(input);
  assert.equal(rules.length, 3, "a and b share the PR");
  assert.equal(rules[0].title, "Add login page");
  assert.equal(rules[0].sessions.length, 2);
  assert.equal(rules.at(-1)!.category, "Wasted", "d edited code that never shipped");
  assert.equal(Math.round(rules.reduce((x, i) => x + i.costUsd, 0)), 40, "items add up to the spend");

  const lines = sessionLines(input);
  assert.deepEqual(lines.map((l) => l.id), ["S1", "S2", "S3", "S4"]);
  const items = itemsFromAnswer([{ category: "Wasted", title: "Dead end", sessions: ["S4"] }, { category: "Built", title: "Login page", sessions: ["S1", "S2"] }], lines, input);
  assert.equal(items.length, 3, "S3 was left out by the AI and comes back from the rules");
  assert.equal(items.at(-1)!.category, "Wasted");
  assert.equal(countLine(items), "Built 1 thing, figured out 1 problem and went in circles once.");
});

test("efficiency: dropped plans, plans built later, open questions, and the timeline of a merged item", () => {
  const now = Date.parse("2026-11-20T00:00:00Z");
  const noEdits = { filesEdited: [], linesAdded: 0, linesRemoved: 0 };
  // A plan nobody acted on (a different folder, nothing afterwards).
  const dropped = fakeSession("plan1", { ...noEdits, cwd: "/c/other", repos: [], startedAt: "2026-11-02T09:00:00Z", endedAt: "2026-11-02T09:20:00Z", timeline: { firstPromptAt: "2026-11-02T09:00:00Z", planAt: "2026-11-02T09:10:00Z" } });
  // A plan that the next session built.
  const plan2 = fakeSession("plan2", { ...noEdits, startedAt: "2026-11-03T09:00:00Z", endedAt: "2026-11-03T09:30:00Z", timeline: { firstPromptAt: "2026-11-03T09:00:00Z", planAt: "2026-11-03T09:20:00Z" } });
  const built = fakeSession("build", {
    startedAt: "2026-11-03T11:00:00Z",
    endedAt: "2026-11-03T12:00:00Z",
    timeline: { firstPromptAt: "2026-11-03T11:00:00Z", firstEditAt: "2026-11-03T11:30:00Z", firstCommitAt: "2026-11-03T11:40:00Z", lastEditAt: "2026-11-03T11:50:00Z", endsOnQuestion: false },
  });
  // The AI asked something at the end and nobody came back.
  const hanging = fakeSession("q", { ...noEdits, cwd: "/c/third", repos: [], startedAt: "2026-11-04T09:00:00Z", endedAt: "2026-11-04T09:10:00Z", timeline: { firstPromptAt: "2026-11-04T09:00:00Z", endsOnQuestion: true } });
  const sessions = [dropped, plan2, built, hanging];
  const pr = fakeChange("acme/app#9", { createdAt: "2026-11-03T12:00:00Z", mergedAt: "2026-11-04T12:00:00Z" });
  const matches = [{ sessionId: "build", changeKey: pr.key, reason: "pr-link" as const, confidence: 0.97 }];
  const judgements = judgeAllHeuristic(sessions, matches, [pr], now).map((j) => (j.sessionId.startsWith("plan") ? { ...j, category: "Planned" as const, label: "Learned" as const } : j));
  const tasks = buildTasks(sessions, matches, [pr], judgements);
  const items = [
    { id: "i1", category: "Built" as const, title: "Login page", inProgress: false, sessions: ["plan2", "build"], costUsd: 20, prs: [{ key: pr.key, url: pr.url, title: pr.title, state: "merged", reverted: false }], tools: ["claude-code"] },
    { id: "i2", category: "Planned" as const, title: "Dropped idea", inProgress: false, sessions: ["plan1"], costUsd: 10, prs: [], tools: ["claude-code"] },
  ];
  const e = computeEfficiency({ sessions, allSessions: sessions, judgements, tasks, changes: [pr], items, now });
  assert.deepEqual(e.waste.abandonedPlans.sessions, ["plan1"], "only the plan nobody built is waste");
  assert.equal(e.waste.abandonedPlans.usd, 10);
  assert.deepEqual(e.waste.leftHanging.sessions, ["q"]);
  assert.equal(e.waste.leftHanging.usd, 0, "an open question is counted, not charged");
  const tl = e.items.i1;
  assert.equal(tl.ideaToCode, 150, "idea (first prompt of the plan) to first edit: 2.5 hours");
  assert.equal(tl.codeToCommit, 10);
  assert.equal(tl.commitToPr, 20);
  assert.equal(tl.prToMerge, 24 * 60);
  assert.equal(e.prs.merged, 1);
  assert.equal(e.spend.wasted, 10);
});

test("receipts: sign the week list, verify, catch tampering, reveal only some items", async () => {
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

  const r = buildReceipt({ owner: account.address, author: "octocat", periodId: w.id, summary, judgements });
  r.signature = await account.signTypedData(typedDataFor(r));
  assert.equal((await verifyReceipt(r)).ok, true);
  const n = signedNumbers(r);
  assert.equal(n.author, "octocat");
  assert.equal(n.spendUsd, 14);
  assert.equal(r.items.length, summary.items.length);
  assert.equal(n.categoryCounts.Built + n.categoryCounts.Fixed + n.categoryCounts.Wasted, r.items.length);

  const tampered = structuredClone(r);
  tampered.message.spendCents = "1";
  assert.equal((await verifyReceipt(tampered)).ok, false);

  const renamed = structuredClone(r);
  renamed.items[0].title = "Something I did not do";
  assert.equal((await verifyReceipt(renamed)).ok, false, "item titles are signed");

  const badEvidence = structuredClone(r);
  badEvidence.evidence[0].costCents += 1;
  assert.equal((await verifyReceipt(badEvidence)).ok, false);

  // Version 3 signs the efficiency numbers too.
  assert.equal(r.kind, "receipts.v3");
  assert.ok(n.efficiency, "efficiency numbers are in the signed message");
  const slower = structuredClone(r);
  slower.message.stageMinutes![0] = slower.message.stageMinutes![0] === 4294967295 ? 5 : slower.message.stageMinutes![0] + 60;
  assert.equal((await verifyReceipt(slower)).ok, false, "changing a timeline number breaks the signature");

  // Hide one item: the rest still verify with proofs, and the signed counts still include it.
  const partial = revealItems(r, (_, i) => i > 0);
  assert.equal(partial.items.length, r.items.length - 1);
  const pv = await verifyReceipt(partial);
  assert.equal(pv.ok, true, JSON.stringify(pv.checks));
  const forged = structuredClone(partial);
  forged.items[0].proof = [];
  assert.equal((await verifyReceipt(forged)).ok, false);

  const leaves = r.evidence.map((e) => e.leaf);
  const root = merkleRoot(leaves);
  assert.equal(root, r.message.evidenceRoot);
  assert.equal(verifyProof(root, leaves[0], merkleProof(leaves, leaves[0])), true);
});

test("sending a week: the whole receipt sealed on Swarm opens with the company key and still verifies", async () => {
  // What /api/share does (the whole week, nothing left out), then what the company page does when it opens the Swarm copy.
  const account = privateKeyToAccount(generatePrivateKey());
  const sessions = ["a", "b", "c"].map((id, n) => fakeSession(id, { startedAt: `2026-11-0${3 + n}T10:00:00Z`, endedAt: `2026-11-0${3 + n}T11:00:00Z` }));
  const changes = [fakeChange("acme/app#11"), fakeChange("acme/app#12"), fakeChange("acme/app#13")];
  const matches = sessions.map((s, i) => ({ sessionId: s.id, changeKey: changes[i].key, reason: "pr-link" as const, confidence: 0.97 }));
  const judgements = judgeAllHeuristic(sessions, matches, changes, Date.parse("2026-11-20T00:00:00Z"));
  const tasks = buildTasks(sessions, matches, changes, judgements);
  const w = weekOf(new Date("2026-11-03T00:00:00Z"));
  const summary = summarize({ periodStart: w.start, periodEnd: w.end, sessions, judgements, tasks, changes });
  const r = buildReceipt({ owner: account.address, author: "octocat", periodId: w.id, summary, judgements });
  r.signature = await account.signTypedData(typedDataFor(r));

  const company = generatePrivateKey();
  const { key, blob } = encryptBlob(new TextEncoder().encode(JSON.stringify(r)));
  const pointer = openPointer(company, sealPointer(publicKeyOf(company), { ref: "cd".repeat(32), key: Buffer.from(key).toString("hex") }));
  const opened = JSON.parse(new TextDecoder().decode(decryptBlob(Buffer.from(pointer.key, "hex"), blob)));
  const v = await verifyReceipt(opened);
  assert.equal(v.ok, true, JSON.stringify(v.checks));
  assert.equal(opened.items.length, r.items.length, "every line arrives");
  assert.equal(opened.digest, r.digest, "the same signed receipt");
});

test("receipts: a version 2 receipt (already shared on Arkiv) still verifies", async () => {
  const v2 = JSON.parse(readFileSync(join(__dirname, "fixtures", "receipt-v2.json"), "utf8"));
  assert.equal(v2.kind, "receipts.v2");
  const v = await verifyReceipt(v2);
  assert.equal(v.ok, true, JSON.stringify(v.checks));
  assert.equal(signedNumbers(v2).efficiency, undefined, "v2 has no efficiency numbers");
});

test("sealing: only the company key opens a shared week", () => {
  const company = generatePrivateKey();
  const stranger = generatePrivateKey();
  const week = new TextEncoder().encode(JSON.stringify({ items: ["Built the login page"] }));
  const { key, blob } = encryptBlob(week);
  assert.notDeepEqual(blob.slice(12, 20), week.slice(0, 8), "stored bytes are not the plain text");
  assert.deepEqual(decryptBlob(key, blob), week);

  const sealed = sealPointer(publicKeyOf(company), { ref: "ab".repeat(32), key: Buffer.from(key).toString("hex") });
  const opened = openPointer(company, sealed);
  assert.equal(opened.ref, "ab".repeat(32));
  assert.deepEqual(decryptBlob(Buffer.from(opened.key, "hex"), blob), week);
  assert.throws(() => openPointer(stranger, sealed), "a different key cannot open it");
  const flipped = sealed.slice(0, -2) + (sealed.endsWith("00") ? "01" : "00");
  assert.throws(() => openPointer(company, flipped), "tampering is detected");
});

test("codex: prices OpenAI usage with cached tokens inside input", async () => {
  const { priceOpenAiUsage, openAiPriceFor } = await import("../src/lib/receipts/pricing");
  // gpt-5.5: $5 input, $0.50 cached, $30 output per 1M
  const r = priceOpenAiUsage("gpt-5.5", { input_tokens: 200_000, cached_input_tokens: 80_000, output_tokens: 10_000 });
  assert.ok(Math.abs(r.usd - (0.12 * 5 + 0.08 * 0.5 + 0.01 * 30)) < 1e-9, `got ${r.usd}`);
  assert.equal(r.tokens.cacheRead, 80_000);
  // over 272K input tokens the long-context rate applies
  const long = priceOpenAiUsage("gpt-5.4", { input_tokens: 300_000, output_tokens: 0 });
  assert.ok(Math.abs(long.usd - 0.3 * 5) < 1e-9);
  assert.equal(openAiPriceFor("gpt-5.2-codex").known, true, "codex variants use the base model price");
});

test("codex: reads a synthetic rollout (usage records, patch edits, exit codes, PR links)", async () => {
  const { parseCodexSession, parsePatch } = await import("../src/lib/receipts/codex");
  const p = parsePatch("*** Begin Patch\n*** Update File: src/a.ts\n@@\n-old\n+new\n+more\n*** Add File: src/b.ts\n+x\n*** End Patch\n");
  assert.deepEqual(p, { files: ["src/a.ts", "src/b.ts"], added: 3, removed: 1 });

  const dir = mkdtempSync(join(tmpdir(), "receipts-codex-"));
  const file = join(dir, "rollout-2026-11-02T10-00-00-01a0a470-5bc2-7612-ae63-f6d73ddd0394.jsonl");
  const t = (m: number) => new Date(Date.parse("2026-11-02T10:00:00Z") + m * 60_000).toISOString();
  const rows = [
    { timestamp: t(0), type: "session_meta", payload: { id: "01a0a470-5bc2-7612-ae63-f6d73ddd0394", cwd: "/Users/x/code/app" } },
    { timestamp: t(0), type: "turn_context", payload: { model: "gpt-5.5", cwd: "/Users/x/code/app" } },
    { timestamp: t(0), type: "event_msg", payload: { type: "user_message", message: "fix the login bug" } },
    { timestamp: t(1), type: "response_item", payload: { type: "custom_tool_call", name: "apply_patch", call_id: "c1", input: "*** Begin Patch\n*** Update File: src/login.ts\n-a\n+b\n*** End Patch" } },
    { timestamp: t(2), type: "response_item", payload: { type: "function_call", name: "exec_command", call_id: "c2", arguments: JSON.stringify({ cmd: "npm test" }) } },
    { timestamp: t(3), type: "response_item", payload: { type: "function_call_output", call_id: "c2", output: "Process exited with code 1\nOutput:\nfail" } },
    { timestamp: t(4), type: "response_item", payload: { type: "function_call", name: "exec_command", call_id: "c3", arguments: JSON.stringify({ cmd: "gh pr create" }) } },
    { timestamp: t(5), type: "response_item", payload: { type: "function_call_output", call_id: "c3", output: "Process exited with code 0\nOutput:\nhttps://github.com/acme/app/pull/9\n" } },
    { timestamp: t(5), type: "token_usage_record", payload: { response_id: "r1", usage: { input_tokens: 1000, cached_input_tokens: 0, output_tokens: 100 } } },
    { timestamp: t(6), type: "token_usage_record", payload: { response_id: "r1", usage: { input_tokens: 1000, cached_input_tokens: 0, output_tokens: 100 } } },
  ];
  writeFileSync(file, rows.map((r) => JSON.stringify(r)).join("\n"));
  const s = (await parseCodexSession(file))!;
  assert.equal(s.tool, "codex");
  assert.equal(s.signals.assistantTurns, 1, "usage is counted once per response id");
  assert.ok(Math.abs(s.cost.usd - (1000 * 5 + 100 * 30) / 1e6) < 1e-6);
  assert.deepEqual(s.filesEdited, ["/Users/x/code/app/src/login.ts"]);
  assert.equal(s.signals.toolErrors, 1);
  assert.equal(s.signals.testRuns, 1);
  assert.deepEqual(s.git.prs.map((x) => x.url), ["https://github.com/acme/app/pull/9"]);
  assert.equal(s.signals.userPrompts, 1);
});
