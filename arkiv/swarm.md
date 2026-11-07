# Arkiv + Swarm

Juicebox (first called Receipts) uses Swarm for the one file that must not be public, and Arkiv to index it and point to it.

**Private weeks, encrypted on Swarm.** When an employee sends their week, the full receipt (the list of what they got done, the pull requests, the private AI records) is encrypted on their laptop and stored on Swarm. The public Arkiv record keeps only the signed totals plus the Swarm reference, and a pointer (reference, key, SHA-256, size) sealed to the company's public key. Anyone can check the totals; only the company can open the list.

Why this matters: Arkiv is public, and work titles can name customers or unreleased features. Without Swarm we had to choose between hiding the list from the company or publishing it to everyone. Now the signed numbers stay public and verifiable, and the details go only to the company, with no server of ours holding them.

## Where each thing the bonus asks for is

| The bonus asks for | Where |
|---|---|
| What is on Swarm, what is on Arkiv, and which entity field holds the Swarm reference | [What is where](#what-is-where): the `swarm` attribute, plus the key in `sealed` |
| One Arkiv entity key and the Swarm reference it points to, with a link | [Live examples](#live-examples-arkiv-testnet-rabdi-swarm-testnet-every-link-below-checked-on-nov-7) |
| The postage batch, who gave it, and the Bee node or service | [Batch and node](#batch-and-node) |
| The files that upload to Swarm and read from it | [Code](#code) |
| Steps to run one upload and one read, what they need, what you should see | [Run one upload and one read](#run-one-upload-and-one-read) |
| The moment in the demo video where Swarm is used | [Demo video](#demo-video) |
| What got in our way | [What got in our way](#what-got-in-our-way) |
| No encrypted Swarm reference stored on Arkiv as it is | We never use Swarm's own encryption. The week is encrypted on the laptop and uploaded as plain bytes, so `swarm` is a normal 64 hex reference that only finds ciphertext. The AES key travels only inside `sealed`, encrypted to the company's key |

## What is where

| Data | Where | Who can read it |
|---|---|---|
| Signed totals: spend, things done, items and spend per category, merged PRs, spend per AI tool, the three Merkle roots | Arkiv entity payload (`receipts-ethglobal-mumbai.receipt.v2`) | Anyone |
| The full signed week: list, PRs, private AI records | Swarm, as AES-256-GCM ciphertext (encrypted on the laptop before upload) | Only the holder of the company key |
| Swarm reference of that ciphertext | Arkiv attribute `swarm` (64 hex) | Anyone (it only finds ciphertext) |
| Where it is, its key, SHA-256 and size | Arkiv attribute `sealed` (bytes): ECIES to the company's secp256k1 public key | Only the holder of the company key |

The entity is created **read-only** and handed to the person who signed it in the same transaction (`executeBatch`: create, then change ownership), so the company wallet pays gas but the record belongs to the employee.

## Live examples (Arkiv testnet Rabdi, Swarm testnet; every link below checked on Nov 7)

A sealed week (demo company Acme, @you, week 45, receipt v3 with the efficiency numbers):

- Arkiv entity: [`0xea50b76a7c871350d819fac561481bfb8070e3da040b3828e9369d0d99cb9ca6`](https://rabdi.explorer.arkiv.network/entity/0xea50b76a7c871350d819fac561481bfb8070e3da040b3828e9369d0d99cb9ca6). The explorer page lists its attributes: `swarm` holds the reference below, and `sealed` (296 bytes) holds the key, sealed to the company
- Swarm reference (`swarm` attribute): `6483e19496c5b16f1f7b35da826f42ff140caedb31732c4e7a7fa90d597eeb75`
- The encrypted bytes on Swarm: https://api.gateway.testnet.ethswarm.org/bytes/6483e19496c5b16f1f7b35da826f42ff140caedb31732c4e7a7fa90d597eeb75 (only ciphertext: this is the point; the gateway serves it as a file, so the browser downloads it)
- The same bytes fetched live and checked in the app: [https://juiceboxx.vercel.app/proof/swarm/6483e194…eb75](https://juiceboxx.vercel.app/proof/swarm/6483e19496c5b16f1f7b35da826f42ff140caedb31732c4e7a7fa90d597eeb75?entity=0xea50b76a7c871350d819fac561481bfb8070e3da040b3828e9369d0d99cb9ca6) (size, SHA-256 and first bytes of the ciphertext, fetched from Swarm when you open it)
- The same week as the public sees it: [https://juiceboxx.vercel.app/r/0xea50…9ca6](https://juiceboxx.vercel.app/r/0xea50b76a7c871350d819fac561481bfb8070e3da040b3828e9369d0d99cb9ca6)
- An earlier v2 share of the same week, still verifiable: [`0xb68e…735c`](https://rabdi.explorer.arkiv.network/entity/0xb68e90172784a003d42f4ebee3262bb00d4db637685c10de96f3bbae6391735c), Swarm `46901a99…083e`

Another sealed week (@asha-acme, week 45): entity [`0x2cf1448bb9216afa63c6c64b8ebe5cf772ec85ddf7e35cc78280d1ebb65ba969`](https://rabdi.explorer.arkiv.network/entity/0x2cf1448bb9216afa63c6c64b8ebe5cf772ec85ddf7e35cc78280d1ebb65ba969), Swarm `77255ee633acb56ce7b613c9dcc00717273318b705a4eb954abbedb4eab8717c`.

Query:

```
arkiv.schema = str('receipts-ethglobal-mumbai.receipt.v2') AND org = str('acme') AND period = str('2026-W45') AND level = str('sealed')
```

Company wallet that writes (pays gas): `0x09351DC0A6AFa87da28D00914fE87373C5C82747`. The company key used for sealing in the demo is the same wallet's key.

## Batch and node

- **Service:** the public Swarm testnet gateway, `https://api.gateway.testnet.ethswarm.org` (Bee HTTP API).
- **Batch:** we send the all-zero batch id (`0000000000000000000000000000000000000000000000000000000000000000`); the gateway stamps uploads with its own postage batch, the way Swarm's own upload pages do. No wallet of ours bought it, and no stamps were given to us: the batch belongs to the gateway, run by the Swarm team. We tried to read its id, but the gateway does not publish it: `/stamps` and `/addresses` answer 404, and `/batches` lists 100 testnet batches from 63 owners without saying which one is the gateway's. The gateway is meant for testing and does not promise how long data stays.
- **Checked with the Swarm team:** at ETHGlobal Mumbai (Nov 6), the Swarm team confirmed that using the Swarm testnet is fine for this bonus.
- **Own batch instead:** run a Bee light node on the testnet (`bee start --mainnet=false ...`), fund it with Sepolia ETH and sBZZ, buy a batch, then set `SWARM_API_URL=http://localhost:1633` and `SWARM_POSTAGE_BATCH_ID=<batch id>`. Nothing else changes.

## Code

| What | File |
|---|---|
| Upload bytes and download them (Bee HTTP API, `swarm-deferred-upload: false`) | [`web/src/lib/receipts/swarm.ts`](../web/src/lib/receipts/swarm.ts) |
| Encrypt a week (AES-256-GCM) and seal the pointer to the company key (ECIES on secp256k1) | [`web/src/lib/receipts/seal.ts`](../web/src/lib/receipts/seal.ts) |
| Share sealed: encrypt, upload, seal, write the entity (`publishReceipt`) | [`web/src/lib/receipts/arkiv.ts`](../web/src/lib/receipts/arkiv.ts) |
| Read: open the pointer, download, check size and SHA-256, decrypt, check it is the same signed receipt (`decodeRow`) | [`web/src/lib/receipts/arkiv.ts`](../web/src/lib/receipts/arkiv.ts) |
| The proof page: fetch the ciphertext live, show its size, SHA-256 and first bytes, and for company members check it against the sealed pointer (`swarmPointer`) | [`web/src/app/(public)/proof/swarm/[ref]/page.tsx`](../web/src/app/(public)/proof/swarm/[ref]/page.tsx) |
| Who may open sealed weeks on the company page (members of the org, and the demo) | [`web/src/lib/server/viewer.ts`](../web/src/lib/server/viewer.ts) (`isMember`), used by [`org.ts`](../web/src/lib/server/org.ts) |
| CLI: share sealed, read one entity | [`web/scripts/receipts.ts`](../web/scripts/receipts.ts) (`publish-demo`, `entity`) |
| Tests for sealing | [`web/test/receipts.test.ts`](../web/test/receipts.test.ts) ("sealing: only the company key opens a shared week", "sending a week: the whole receipt sealed on Swarm opens with the company key and still verifies") |

## Run one upload and one read

You need: Node 20+, `npm install` in `web/`, and in `web/.env.local` the `SWARM_*` lines from `.env.example` (the free testnet gateway), `ARKIV_ACCESS_KEY` (free, from https://hub.arkiv.network/access-keys), and for the upload a funded `ARKIV_PRIVATE_KEY` (tGLM from the faucet; it pays the Arkiv fee). The read needs no wallet.

**One read** (no fee). From `web/`:

```bash
npm run receipts -- entity 0xea50b76a7c871350d819fac561481bfb8070e3da040b3828e9369d0d99cb9ca6
```

What to expect (this is the output on Nov 7):

```
As the company (with the company key):
  signature verified, level full, owner 0xfFC57B874f841B7B849Ff3F194907A2e903F7a74
  5 items shown, 4 PRs, 0 private AI records
    Built        Team spend dashboard
    ...
  Swarm 6483e194...eb75: opened and checked (SHA-256, signature)

As the public (no key):
  signature verified, level sealed, owner 0xfFC57B874f841B7B849Ff3F194907A2e903F7a74
  0 items shown, 0 PRs, 0 private AI records
  Swarm 6483e194...eb75: not opened
```

"As the company" opens the pointer with the company key, downloads the ciphertext from Swarm, checks its size and SHA-256, decrypts it and checks it is the same signed receipt. "As the public" sees only the signed totals. The raw ciphertext is at `https://api.gateway.testnet.ethswarm.org/bytes/<swarm ref>`. (Opening the list needs the company key, which for the demo is the writer wallet's key; without it you see the public view.)

**One upload** (pays a small Arkiv fee from the company wallet):

```bash
npm run receipts -- publish-demo --week 2026-W45 --who you
```

It takes the demo engineer's signed week, encrypts it on your machine, uploads the ciphertext to Swarm (waiting until it is on the network), seals the pointer to the company key, and writes one read-only Arkiv entity handed to the signer. It prints the entity key and the Swarm reference; read it back with the `entity` command above.

**In the [live demo](https://juiceboxx.vercel.app/demo)** (read only): be Acme's lead, then People or Teams, Payments: each list says "Opened from Swarm with the company key", with a Swarm link next to each person. Be someone with a link: the list is private. Every **Fetch it from Swarm now** link opens the proof page above.

**On your laptop** (`npm run dev`, which can also send): be an engineer in the demo (`/demo`), then on This week press **Sign and send**: sign it, then **Send to Acme**. The list goes to Swarm and the Arkiv record keeps the totals. Under **Check it yourself**, **Fetch it from Swarm now** opens `/proof/swarm/<ref>`, which downloads the ciphertext from the gateway right then and, for a company member, checks it against the SHA-256 sealed in the Arkiv record. Be Acme's lead: People shows each list "Opened from Swarm with the company key", with a Swarm link next to each person. Be someone with a public link: the list is private.

## Demo video

Swarm appears at: **TODO (add the timestamps after recording)**. Planned, following the video script in `docs/SUBMISSION.md`: around 1:35, sending a week ("my list goes to Swarm, encrypted on my laptop") and **Fetch it from Swarm now** showing the ciphertext fetched live and matching the SHA-256 sealed in the Arkiv record; around 2:05, the company's People page opening each list from Swarm ("Opened from Swarm with the company key"); around 2:35, the public link saying the list is private.

## What got in our way

- **Stamps.** Uploading needs a postage batch paid in BZZ. On mainnet that is real money; on the testnet it means Sepolia ETH, swapping for sBZZ on Uniswap, and running and syncing a Bee node. No hackathon stamps or gift codes were offered for Mumbai, so we used the public testnet gateway, which is "for testing only" and does not say how long data lives.
- **Lifetimes do not match.** Swarm data lives as long as its batch; our Arkiv records expire after 120 days. With the gateway's batch we cannot line them up. With our own batch we would set the batch TTL to at least the entity's life.
- **Encrypted references carry their key.** Swarm's own encrypted upload returns a 128-hex reference that includes the decryption key, so it cannot go on public Arkiv. We encrypt on the laptop instead, upload plain ciphertext, and seal the key to the company.
- **Arkiv string attributes are limited to 128 bytes.** Our first version stored the sealed pointer as a string and would have failed on every write; it is now a `bytes` attribute.
- **ACT (Access Control Trie) would be the Swarm-native way** to grant the company access, but every reader needs their own Bee node, and a public gateway cannot decrypt for them. Good future work for companies that run a node.
- **Tooling churn.** `bee dev` is gone (bee-factory needs Docker), and bee-js 13 needs Node 22 or newer, so we call the Bee HTTP API directly.
