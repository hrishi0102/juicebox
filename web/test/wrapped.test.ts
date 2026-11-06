// AI Wrapped tests. Run with: npm test
// Every message and export below is made up. No real chats are used.

import { test } from "node:test";
import assert from "node:assert/strict";
import { ChatStatsBuilder, classify, emptyChatStats, type ChatStats, type FunSegment } from "../src/lib/receipts/chat-stats";
import { buildWrapped, toCard, type WrappedInput } from "../src/lib/receipts/wrapped";
import { readExport, wrappedFromExport } from "../src/lib/receipts/chat-import";
import { WrappedCardInput } from "../src/lib/receipts/wrapped-schema";

const segs = (t: string) => classify(t).segments;

test("wrapped rules: hellos, yeses, overthinking, therapy, student mode, rage, brain dumps", () => {
  assert.deepEqual(segs("hi"), ["hi"]);
  assert.deepEqual(segs("Hey Claude!"), ["hi"]);
  assert.deepEqual(segs("yes go ahead"), ["goAhead"]);
  assert.deepEqual(segs("ok do it"), ["goAhead"]);
  assert.ok(segs("wait, actually should I use Postgres or SQLite?").includes("overthinking"));
  assert.ok(segs("I feel so overwhelmed with this launch").includes("therapy"));
  assert.ok(!segs("I feel like we should rename the button").includes("therapy"));
  assert.ok(!segs("retries exhausted after 3 attempts").includes("therapy"));
  assert.ok(segs("explain how webhooks work").includes("student"));
  assert.ok(segs("WHY IS THIS STILL BROKEN").includes("rage"));
  assert.ok(segs("it is still not working").includes("rage"));
  assert.ok(!segs("set the API URL and JSON in the SDK config").includes("rage"));
  assert.ok(!segs("use KEK HKDF AES GCM for the keys").includes("rage"));
  assert.ok(segs("word ".repeat(260)).includes("brainDump"));
  assert.ok(segs("<pasted_content>a long log</pasted_content> what is this").includes("brainDump"));
  const c = classify("please explain why this fails, thanks");
  assert.equal(c.manners, 2);
  assert.equal(c.whys, 1);
});

test("wrapped time: a message runs to the next one, capped at 15 minutes; nights and days", () => {
  const at = (h: number, m: number) => new Date(2026, 10, 3, h, m).getTime(); // local time, Tuesday Nov 3
  const b = new ChatStatsBuilder();
  b.message(at(1, 0), "hmm, which is better?");
  b.message(at(1, 10), "hi");
  b.message(at(2, 10), "explain the plan please");
  b.seen(at(2, 14));
  const s = b.finish()!;
  assert.equal(s.prompts, 3);
  assert.equal(s.seg.overthinking.min, 10);
  assert.equal(s.seg.hi.min, 15); // an hour of silence counts as 15 minutes
  assert.equal(s.seg.student.min, 4); // the last message runs to the last answer
  assert.equal(s.minutes, 29);
  assert.equal(s.nightMinutes, 29);
  assert.equal(s.latestMinuteOfNight, 130);
  assert.equal(s.hours[1], 2);
  assert.equal(s.days[2], 3);
  assert.deepEqual(s.dayKeys, ["2026-11-03"]);
  assert.equal(s.manners, 1);
});

function input(seg: Partial<Record<FunSegment, number>>, prompts = 100, extra: Partial<ChatStats> = {}): WrappedInput {
  const chat = emptyChatStats();
  chat.prompts = prompts;
  chat.words = prompts * 20;
  chat.hours[14] = prompts;
  chat.days[3] = prompts;
  chat.minutes = prompts * 3;
  for (const [k, n] of Object.entries(seg)) chat.seg[k as FunSegment] = { n: n!, min: n! * 3 };
  Object.assign(chat, extra);
  return { tool: "chatgpt", startedAt: "2026-11-02T10:00:00Z", minutes: prompts * 3, usd: 0, chat };
}

test("wrapped persona: the segment furthest above typical wins, few messages means calm, the card has numbers only", () => {
  assert.equal(buildWrapped([input({ overthinking: 30, student: 12 })], { label: "Test" })!.persona.id, "overthinker");
  assert.equal(buildWrapped([input({ therapy: 6, student: 10 })], { label: "Test" })!.persona.id, "deep-talker");
  assert.equal(buildWrapped([input({ student: 13, rage: 5 })], { label: "Test" })!.persona.id, "calm");
  assert.equal(buildWrapped([input({ overthinking: 5 }, 8)], { label: "Test" })!.persona.id, "calm");
  assert.equal(buildWrapped([input({}, 50, { manners: 40 })], { label: "Test" })!.persona.id, "polite");
  const w = buildWrapped([input({ goAhead: 40, rage: 15 }, 100, { topWords: [["secretproject", 9]] })], { label: "Test" })!;
  assert.equal(w.persona.id, "delegator");
  assert.deepEqual(w.traits.map((t) => t.id), ["keyboard-warrior"]);
  const card = toCard(w);
  assert.ok(WrappedCardInput.safeParse(card).success);
  assert.ok(!JSON.stringify(card).includes("secretproject"));
  assert.equal(buildWrapped([], { label: "Empty" }), undefined);
});

test("wrapped exports: reads made-up ChatGPT and Claude.ai exports", () => {
  const t0 = Date.UTC(2026, 10, 2, 10, 0) / 1000; // ChatGPT uses seconds
  const chatgpt = [
    {
      title: "Trip",
      create_time: t0,
      mapping: {
        a: { message: null, children: ["b"] },
        b: { message: { author: { role: "user" }, create_time: t0, content: { content_type: "text", parts: ["hi"] } } },
        c: { message: { author: { role: "assistant" }, create_time: t0 + 5, content: { content_type: "text", parts: ["Hello!"] } } },
        d: {
          message: {
            author: { role: "user" },
            create_time: t0 + 60,
            content: { content_type: "multimodal_text", parts: [{ content_type: "image_asset_pointer", asset_pointer: "file-service://x" }, "I feel so stressed about this trip, what should I pack?"] },
          },
        },
        e: { message: { author: { role: "assistant" }, create_time: t0 + 70, content: { content_type: "text", parts: ["Here is a list."] } } },
        f: { message: { author: { role: "user" }, create_time: t0 + 80, metadata: { is_visually_hidden_from_conversation: true }, content: { content_type: "text", parts: ["hidden"] } } },
      },
    },
  ];
  const x = readExport(chatgpt);
  assert.equal(x.tool, "chatgpt");
  const w = wrappedFromExport(x, "all", Date.UTC(2026, 10, 6))!;
  assert.equal(w.prompts, 2);
  assert.equal(w.images, 1);
  assert.equal(w.seg.find((s) => s.key === "hi")!.n, 1);
  assert.equal(w.seg.find((s) => s.key === "therapy")!.n, 1);
  assert.equal(w.sources[0].name, "ChatGPT");

  const claude = [
    {
      uuid: "1",
      name: "Essay",
      created_at: "2026-11-01T20:00:00Z",
      chat_messages: [
        { sender: "human", text: "explain the french revolution like I am five", created_at: "2026-11-01T20:00:00Z", content: [], attachments: [], files: [] },
        { sender: "assistant", text: "Once upon a time...", created_at: "2026-11-01T20:00:20Z" },
        { sender: "human", text: "", content: [{ type: "text", text: "THIS IS WAY TOO LONG" }], created_at: "2026-11-01T20:02:00Z", attachments: [{ file_name: "notes.txt" }], files: [] },
      ],
    },
  ];
  const y = readExport(claude);
  assert.equal(y.tool, "claude-ai");
  const v = wrappedFromExport(y, "30d", Date.UTC(2026, 10, 6))!;
  assert.equal(v.prompts, 2);
  assert.equal(v.seg.find((s) => s.key === "student")!.n, 1);
  assert.equal(v.seg.find((s) => s.key === "rage")!.n, 1);
  assert.equal(v.seg.find((s) => s.key === "brainDump")!.n, 1);
  assert.equal(wrappedFromExport(y, "30d", Date.UTC(2027, 5, 1)), undefined);
  assert.throws(() => readExport([{ foo: 1 }]));
});
