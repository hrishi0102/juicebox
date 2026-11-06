// Proving a signing key belongs to a GitHub login. Run with: npm test
// Every key below is made up at test time; no real gists are read.

import { test } from "node:test";
import assert from "node:assert/strict";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { findProof, parseProof, proofStatement, proofText, proves, PROOF_FILE, type GistLike } from "../src/lib/receipts/key-proof";

async function signedProof(login: string) {
  const account = privateKeyToAccount(generatePrivateKey());
  const statement = proofStatement(login, account.address, "2026-11-07");
  const text = proofText(statement, await account.signMessage({ message: statement }));
  return { account, text };
}

test("key proof: a signed note proves the key belongs to the login", async () => {
  const { account, text } = await signedProof("octocat");
  const p = parseProof(text);
  assert.ok(p);
  assert.equal(p.login, "octocat");
  assert.equal(p.address, account.address);
  assert.equal(await proves(text, "octocat", account.address), true);
  assert.equal(await proves(text, "OctoCat", account.address.toLowerCase()), true, "case does not matter");
  assert.equal(await proves(text.replace(/\n/g, "\r\n"), "octocat", account.address), true, "Windows line endings still work");
});

test("key proof: the wrong login, the wrong key or an edited note do not prove anything", async () => {
  const { account, text } = await signedProof("octocat");
  const other = privateKeyToAccount(generatePrivateKey());
  assert.equal(await proves(text, "mallory", account.address), false, "someone else's login");
  assert.equal(await proves(text, "octocat", other.address), false, "someone else's key");
  assert.equal(await proves(text.replace("github: octocat", "github: mallory").replace("@octocat", "@mallory"), "mallory", account.address), false, "edited note");
  // A note that names one key but was signed by another.
  const forged = proofText(proofStatement("octocat", account.address, "2026-11-07"), await other.signMessage({ message: proofStatement("octocat", account.address, "2026-11-07") }));
  assert.equal(await proves(forged, "octocat", account.address), false, "signed by a different key");
  assert.equal(parseProof("hello"), undefined);
});

test("key proof: only a gist that GitHub says the login owns counts", async () => {
  const { account, text } = await signedProof("octocat");
  const files = (name: string) => ({ [name]: { filename: name, raw_url: `https://example.test/${name}` } });
  const read = async () => text;
  const copied: GistLike = { html_url: "https://gist.github.com/mallory/1", owner: { login: "mallory" }, files: files(PROOF_FILE) };
  const otherFile: GistLike = { html_url: "https://gist.github.com/octocat/2", owner: { login: "octocat" }, files: files("notes.txt") };
  const real: GistLike = { html_url: "https://gist.github.com/octocat/3", owner: { login: "octocat" }, files: files(PROOF_FILE) };
  assert.equal(await findProof([copied, otherFile], "octocat", account.address, read), undefined, "a copy in someone else's gist does not count");
  assert.equal(await findProof([copied, otherFile, real], "octocat", account.address, read), "https://gist.github.com/octocat/3");
  assert.equal(await findProof([real], "octocat", privateKeyToAccount(generatePrivateKey()).address, read), undefined, "a proof for another key does not count");
});
