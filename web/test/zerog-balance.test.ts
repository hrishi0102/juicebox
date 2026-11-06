// Showing a 0G balance. Run with: npm test
// The shapes follow 0G's documented answer for GET /v1/account/balance; the numbers are made up.

import { test } from "node:test";
import assert from "node:assert/strict";
import { formatAmount, parseBalance, spentLine } from "../src/lib/zerog-balance";

test("0G balance: neuron becomes 0G, minus what is still being charged", () => {
  const b = parseBalance({
    address: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
    balance: "4215831000000000000",
    credit_balance: "100000000000000000",
    currency: "0g",
    deposit_balance: "4115831000000000000",
    pending_charge: "312000000000000",
    total_balance: "4215831000000000000",
  });
  assert.ok(b);
  assert.equal(b.value, 4.215519);
  assert.equal(b.text, "4.2155 0G");
  assert.equal(b.credits, 0.1);
  assert.equal(b.pending, 0.000312);
});

test("0G balance: the older short answer, and nothing usable", () => {
  assert.equal(parseBalance({ address: "0x1", deposit_balance: "2000000000000000000", total_balance: "2000000000000000000" })?.text, "2.0000 0G");
  assert.equal(parseBalance({ hello: "world" }), null);
  assert.equal(parseBalance(null), null);
});

test("0G balance: accounts billed in dollars use micro-dollars", () => {
  assert.equal(parseBalance({ currency: "usd", total_balance: "4210000" })?.text, "$4.2100");
});

test("0G balance: what a call cost, in small amounts", () => {
  assert.equal(formatAmount(0.000312), "0.000312 0G");
  const before = parseBalance({ total_balance: "4215831000000000000" });
  const after = parseBalance({ total_balance: "4215519000000000000" });
  assert.equal(spentLine(before, after), "This cost 0.000312 0G: your 0G balance went from 4.2158 0G to 4.2155 0G.");
});
