// The employee's weekly flow: write, sign, send. Run with: npm test

import { test } from "node:test";
import assert from "node:assert/strict";
import { receiptStatus, weekFlow, type WeekStatus } from "../src/lib/receipts/flow";

const base: WeekStatus = { aiWritten: false, storyStale: false, signed: false, receiptStale: false, sent: false };

test("a new week starts at write", () => {
  const f = weekFlow(base);
  assert.equal(f.next, "write");
  assert.deepEqual([f.write, f.sign, f.send], ["current", "todo", "todo"]);
});

test("once the private AI wrote it, signing is next", () => {
  const f = weekFlow({ ...base, aiWritten: true });
  assert.equal(f.next, "sign");
  assert.equal(f.write, "done");
  assert.equal(f.sign, "current");
});

test("new sessions after the write-up put write back in front", () => {
  assert.equal(weekFlow({ ...base, aiWritten: true, storyStale: true }).next, "write");
});

test("after signing, sending is next", () => {
  const f = weekFlow({ ...base, aiWritten: true, signed: true });
  assert.equal(f.next, "send");
  assert.deepEqual([f.write, f.sign, f.send], ["done", "done", "current"]);
});

test("a list drafted by rules can still be signed and sent", () => {
  const f = weekFlow({ ...base, signed: true, sent: true });
  assert.equal(f.next, "done");
  assert.equal(f.write, "done");
});

test("a week that changed after signing has to be signed again, even if it was sent", () => {
  const f = weekFlow({ ...base, aiWritten: true, signed: true, sent: true, receiptStale: true });
  assert.equal(f.next, "sign");
  assert.equal(f.send, "todo");
});

test("receipt status for the list of past weeks", () => {
  assert.equal(receiptStatus(undefined), "not signed");
  assert.equal(receiptStatus({ signature: "0x1" }), "signed");
  assert.equal(receiptStatus({ signature: "0x1", share: { arkivKey: "0xabc" } }), "sent");
});
