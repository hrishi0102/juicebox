# Arkiv schema

One entity per shared weekly receipt.

- Network: Arkiv testnet **Rabdi**, chain id `7794095`, RPC `https://rpc.rabdi.db-chain.testnet.arkiv.network`
- SDK: `@arkiv-network/sdk` 1.0.1
- Schema name: `receipts-ethglobal-mumbai.receipt.v1` (named schema, so every entity also carries the indexed `arkiv.schema` tag)
- Lifetime: 120 days from publishing (`ExpirationTime.fromDays(120)`), well under the 182 day maximum
- Code: [`web/src/lib/receipts/arkiv.ts`](../web/src/lib/receipts/arkiv.ts)

| Attribute | Type | Indexed | Meaning |
|---|---|---|---|
| `type` | `str` | yes | Always `receipt` |
| `team` | `str` | yes | Team id the owner shared with, for example `acme-payments` |
| `period` | `str` | yes | ISO week, for example `2026-W45` |
| `signer` | `str` | yes | Lowercased address that signed the receipt (EIP-712). Can differ from the entity owner when a team relayer writes it |
| `level` | `str` | yes | `totals` or `full` (full adds per-task evidence) |
| `spendCents` | `u64` | yes | Total spend for the week in US cents |
| `shipped` | `i32` | yes | Shipped tasks |
| `survivalBps` | `i32` | yes | Share of shipped code still alive, basis points (65535 = unknown) |
| `wasteBps` | `i32` | yes | Share of spend that was waste, basis points |
| `digest` | `str` | no | EIP-712 digest of the receipt |
| `payload` | `bytes` | no | The signed receipt JSON (see below), at most a few KB |

## Payload

The payload is the signed receipt (`kind: "receipts.v1"`), the same JSON a person can download from the app:

- `message`: the EIP-712 typed data that was signed (owner, week, spend, shipped tasks, survival, kept work, waste, label counts, spend per label, `evidenceRoot`, `judgeRoot`, judge name)
- `signature`: the owner's signature over `message`
- `evidence`: per task leaves (PR URL, state, survival, cost, difficulty). Empty when shared as `totals`
- `judges`: per session judge leaves (label, difficulty, 0G request id, provider, hashes of what the judge saw and said). Empty when shared as `totals`
- `share`: level, team, time

Never in the payload: prompts, session titles, session ids (only their hashes inside judge leaves), file names, folder names.

## Queries

All shared receipts of a team:

```
arkiv.schema = str('receipts-ethglobal-mumbai.receipt.v1') AND type = str('receipt') AND team = str('acme-payments')
```

One week:

```
arkiv.schema = str('receipts-ethglobal-mumbai.receipt.v1') AND team = str('acme-payments') AND period = str('2026-W45')
```

Weeks where someone spent more than $100 and kept less than 80% of the code:

```
arkiv.schema = str('receipts-ethglobal-mumbai.receipt.v1') AND team = str('acme-payments') AND spendCents > u64(10000) AND survivalBps < i32(8000)
```

From code (what the team page does):

```ts
await publicClient
  .select({ $key: true, $owner: true, $expiresAt: true, payload: true })
  .from(ReceiptSchema)
  .where(and(eq("type", "receipt"), eq("team", team)))
  .orderBy(desc("spendCents"))
  .limit(100)
  .fetch();
```
