# Arkiv + Swarm

Receipts uses Swarm for the two kinds of files people care about, and Arkiv to index and point to them.

1. **Private weeks, encrypted on Swarm.** A person's full week (the list of what they got done, the pull requests, the private AI records) is encrypted on their laptop and stored on Swarm. The public Arkiv record keeps only the signed totals plus the Swarm reference, and a pointer (reference, key, SHA-256, size) sealed to the company's public key. Anyone can check the totals; only the company can open the list.
2. **Public cards on Swarm, listed on Arkiv.** When someone makes their weekly card public ("Get a Swarm link"), the PNG is stored on Swarm and a small Arkiv record points to it. Posts link to the card on Swarm, and the wall page (`/wall`) shows everyone's cards from Arkiv records.

Why this matters: Arkiv is public, and work titles can name customers or unreleased features. Without Swarm we had to choose between hiding the list from the company or publishing it to everyone. Now the signed numbers stay public and verifiable, and the details go only to the company, with no server of ours holding them.

## What is where

| Data | Where | Who can read it |
|---|---|---|
| Signed totals: spend, things done, items and spend per category, merged PRs, spend per AI tool, the three Merkle roots | Arkiv entity payload (`receipts-ethglobal-mumbai.receipt.v2`) | Anyone |
| The full signed week: list, PRs, private AI records | Swarm, as AES-256-GCM ciphertext (encrypted on the laptop before upload) | Only the holder of the company key |
| Swarm reference of that ciphertext | Arkiv attribute `swarm` (64 hex) | Anyone (it only finds ciphertext) |
| Where it is, its key, SHA-256 and size | Arkiv attribute `sealed` (bytes): ECIES to the company's secp256k1 public key | Only the holder of the company key |
| A public card (PNG) | Swarm, as a file (`/bzz/<ref>/`) | Anyone with the link |
| Who, which week, things done, the card's Swarm reference, SHA-256 and size | Arkiv entity `receipts-ethglobal-mumbai.card.v1`, attributes `swarm`, `sha256`, `size`, `mediaType` | Anyone |

Both entity types are created **read-only** and handed to the person who signed or made them in the same transaction (`executeBatch`: create, then change ownership), so the company wallet pays gas but the record belongs to the employee.

## Live examples (Arkiv testnet Rabdi, Swarm testnet)

A sealed week (demo company Acme, @you, week 45, receipt v3 with the efficiency numbers):

- Arkiv entity: [`0xea50b76a7c871350d819fac561481bfb8070e3da040b3828e9369d0d99cb9ca6`](https://rabdi.explorer.arkiv.network/entity/0xea50b76a7c871350d819fac561481bfb8070e3da040b3828e9369d0d99cb9ca6)
- Swarm reference (`swarm` attribute): `6483e19496c5b16f1f7b35da826f42ff140caedb31732c4e7a7fa90d597eeb75`
- The encrypted bytes on Swarm: https://api.gateway.testnet.ethswarm.org/bytes/6483e19496c5b16f1f7b35da826f42ff140caedb31732c4e7a7fa90d597eeb75 (only ciphertext: this is the point)
- The same week as the public sees it, in the app: `/r/0xea50b76a7c871350d819fac561481bfb8070e3da040b3828e9369d0d99cb9ca6`
- An earlier v2 share of the same week, still verifiable: [`0xb68e…735c`](https://rabdi.explorer.arkiv.network/entity/0xb68e90172784a003d42f4ebee3262bb00d4db637685c10de96f3bbae6391735c), Swarm `46901a99…083e`

Another sealed week (@asha-acme, week 45): entity [`0x2cf1448bb9216afa63c6c64b8ebe5cf772ec85ddf7e35cc78280d1ebb65ba969`](https://rabdi.explorer.arkiv.network/entity/0x2cf1448bb9216afa63c6c64b8ebe5cf772ec85ddf7e35cc78280d1ebb65ba969), Swarm `77255ee633acb56ce7b613c9dcc00717273318b705a4eb954abbedb4eab8717c`.

A public card (@you, week 45), the link judges can open:

- Arkiv entity: [`0xd4785a1b1487ae296e6c0ccc79a7f85a5254b1d2572d32da9979d8211afa3819`](https://rabdi.explorer.arkiv.network/entity/0xd4785a1b1487ae296e6c0ccc79a7f85a5254b1d2572d32da9979d8211afa3819)
- The card on Swarm: https://api.gateway.testnet.ethswarm.org/bzz/edca15e00de285fe548539a746674a8115b90a86c3f4aac494891bbfac475a38/

Queries:

```
arkiv.schema = str('receipts-ethglobal-mumbai.receipt.v2') AND org = str('acme') AND period = str('2026-W45') AND level = str('sealed')
arkiv.schema = str('receipts-ethglobal-mumbai.card.v1') AND type = str('card') AND org = str('acme')
```

Company wallet that writes (pays gas): `0x09351DC0A6AFa87da28D00914fE87373C5C82747`. The company key used for sealing in the demo is the same wallet's key.

## Batch and node

- **Service:** the public Swarm testnet gateway, `https://api.gateway.testnet.ethswarm.org` (Bee HTTP API).
- **Batch:** we send the all-zero batch id (`0000…0000`); the gateway stamps uploads with its own postage batch, the way Swarm's own upload pages do. No wallet of ours bought it, and no stamps were given to us. The gateway is meant for testing and does not promise how long data stays.
- **Checked with the Swarm team:** at ETHGlobal Mumbai (Nov 6), the Swarm team confirmed that using the Swarm testnet is fine for this bonus.
- **Own batch instead:** run a Bee light node on the testnet (`bee start --mainnet=false ...`), fund it with Sepolia ETH and sBZZ, buy a batch, then set `SWARM_API_URL=http://localhost:1633` and `SWARM_POSTAGE_BATCH_ID=<batch id>`. Nothing else changes.

## Code

| What | File |
|---|---|
| Upload bytes or a file, download, links (Bee HTTP API, `swarm-deferred-upload: false`) | [`web/src/lib/receipts/swarm.ts`](../web/src/lib/receipts/swarm.ts) |
| Encrypt a week (AES-256-GCM) and seal the pointer to the company key (ECIES on secp256k1) | [`web/src/lib/receipts/seal.ts`](../web/src/lib/receipts/seal.ts) |
| Share sealed: encrypt, upload, seal, write the entity (`publishReceipt`) | [`web/src/lib/receipts/arkiv.ts`](../web/src/lib/receipts/arkiv.ts) |
| Read: open the pointer, download, check size and SHA-256, decrypt, check it is the same signed receipt (`decodeRow`) | [`web/src/lib/receipts/arkiv.ts`](../web/src/lib/receipts/arkiv.ts) |
| Public cards: upload the PNG and write the card entity | [`web/src/app/api/card/swarm/route.ts`](../web/src/app/api/card/swarm/route.ts), [`web/src/lib/receipts/cards.ts`](../web/src/lib/receipts/cards.ts) |
| The wall (reads card entities, shows images from Swarm) | [`web/src/app/(personal)/wall/page.tsx`](../web/src/app/(personal)/wall/page.tsx) |
| Who may open sealed weeks on the company page (members of the org, and the demo) | [`web/src/lib/server/viewer.ts`](../web/src/lib/server/viewer.ts) (`isMember`), used by [`org.ts`](../web/src/lib/server/org.ts) |
| CLI: share sealed, seed cards, read one entity | [`web/scripts/receipts.ts`](../web/scripts/receipts.ts) (`publish-demo`, `publish-demo-cards`, `entity`) |
| Tests for sealing | [`web/test/receipts.test.ts`](../web/test/receipts.test.ts) ("sealing: only the company key opens a shared week") |

## Run one upload and one read

From `web/`, with `ARKIV_PRIVATE_KEY`, `ARKIV_ACCESS_KEY` and the `SWARM_*` lines from `.env.example` in `.env.local`:

```bash
npm run receipts -- publish-demo --week 2026-W45 --who you
```

This signs nothing new: it takes the demo's signed week, encrypts it, uploads it to Swarm, seals the pointer and writes the Arkiv entity. It prints the entity key and the Swarm reference. Then read it back both ways:

```bash
npm run receipts -- entity 0x<entity key>
```

"As the company" opens the Swarm copy (size, SHA-256 and signature checked) and prints the list; "As the public" shows only the signed totals. The raw ciphertext is at `https://api.gateway.testnet.ethswarm.org/bytes/<swarm ref>`.

For a card: `npm run dev`, open http://localhost:3000/card, click **Get a Swarm link**, then open http://localhost:3000/wall.

## Demo video

Swarm appears at: **TODO (add the timestamp after recording)**: the company page opening sealed weeks ("Opened from Swarm with the company key"), the public receipt page saying the list is private, and Get a Swarm link plus the wall.

## What got in our way

- **Stamps.** Uploading needs a postage batch paid in BZZ. On mainnet that is real money; on the testnet it means Sepolia ETH, swapping for sBZZ on Uniswap, and running and syncing a Bee node. No hackathon stamps or gift codes were offered for Mumbai, so we used the public testnet gateway, which is "for testing only" and does not say how long data lives.
- **Lifetimes do not match.** Swarm data lives as long as its batch; our Arkiv records expire after 120 days (weeks) and 60 days (cards). With the gateway's batch we cannot line them up. With our own batch we would set the batch TTL to at least the entity's life.
- **Encrypted references carry their key.** Swarm's own encrypted upload returns a 128-hex reference that includes the decryption key, so it cannot go on public Arkiv. We encrypt on the laptop instead, upload plain ciphertext, and seal the key to the company.
- **Arkiv string attributes are limited to 128 bytes.** Our first version stored the sealed pointer as a string and would have failed on every write; it is now a `bytes` attribute.
- **ACT (Access Control Trie) would be the Swarm-native way** to grant the company access, but every reader needs their own Bee node, and a public gateway cannot decrypt for them. Good future work for companies that run a node.
- **Tooling churn.** `bee dev` is gone (bee-factory needs Docker), and bee-js 13 needs Node 22 or newer, so we call the Bee HTTP API directly.
