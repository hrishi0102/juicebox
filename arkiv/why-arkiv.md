# Why Arkiv

Juicebox (first called Receipts) sits between an employee and their company. The employee proves what their AI spend got done; the company reads everyone's receipts.

**In one line:** swap Arkiv for Postgres and the employee loses their evidence. Whoever runs the database could edit or delete a receipt, the company could no longer check one without trusting that server, and a receipt would vanish with the server instead of expiring when its owner decides.

The place those receipts live needs five properties:

1. **Owned by neither the company nor us.** A receipt is the employee's evidence. If it lived in the company dashboard's database, the company could edit or delete it; if it lived on our server, it would disappear with us. On Arkiv, each receipt is a read-only entity owned by the person who signed it: the company can read it, but not change or delete it, and neither can we.
2. **Queryable by the company.** A lead needs "everyone's receipt for week 45", "one team", or "weeks where spend was high and much of it went in circles". Arkiv entities carry typed, indexed attributes and a real query language, so the company page is one query by `org`. Plain blob storage (IPFS, Swarm alone, a bucket) cannot answer that without an indexer we would have to run.
3. **Cheap, small writes that someone else can pay for.** One small entity per person per week. The company wallet pays the fee and hands the entity to the employee in the same transaction, so employees never touch a faucet. Contract storage on an L2 would cost far more and still need an indexer.
4. **Expiry built in.** Performance evidence should not live forever. Receipts expire after 120 days unless their owner extends them.
5. **Public enough to check, private where it matters.** Anyone can verify a receipt's signed totals on Arkiv without trusting us. The list itself (work titles can name customers or unreleased features) is encrypted on the laptop and stored on Swarm, with the key sealed to the company in the Arkiv record. Arkiv is the index everyone can check; Swarm holds what only the company should read.

## What we considered instead

| Option | Why not |
|---|---|
| Our own database | We would control the data and become the thing people have to trust (and a single point of failure). Fails the CROPS "works without you" test |
| The company's own database or HR tool | The company could quietly edit or delete an employee's evidence |
| A smart contract with events | Expensive per write, no attribute queries without running an indexer, data never expires |
| IPFS or Swarm only | Good for files, but no way to ask "all receipts for this team and week" without a separate index. We use Swarm for the files, with Arkiv as the index |
| A shared folder | No signatures checked, no history, depends on whoever hosts it |

## What we kept off Arkiv, and why

Arkiv is public, so only what everyone may check goes there. Everything else stays somewhere else on purpose:

| Kept off Arkiv | Where it is instead | Why |
|---|---|---|
| Raw logs, prompts and the AI's answers | Only on the employee's laptop (`~/.claude`, `~/.codex`) | They can hold code, secrets and customer names. They never leave the laptop, except a trimmed digest sent to 0G's private computer when the employee clicks Write my week |
| Session titles, file and folder names | `~/.receipts` on the laptop | Same reason. Only hashes of what was sent to 0G go into the signed receipt |
| The full list, its PRs and the private AI records | Swarm, encrypted on the laptop (AES-256-GCM), with the key sealed to the company inside the entity | Work titles can name customers or unreleased features: the company should read them, the public should not. Arkiv keeps the signed totals and the sealed pointer |
| The laptop signing key and the company's private key | The laptop (`~/.receipts`, mode 0600) and the company's machine | Keys never go anywhere |
| The monthly team score | `TeamScoreboard` on Ethereum Sepolia | Chainlink CRE writes its reports through Chainlink's forwarder to an EVM contract, and the contract enforces that only the forwarder posts and that a month is never rewritten |
| Raw 0G requests and answers | Not stored anywhere | The signed receipt keeps only the 0G request id, provider, cost and hashes |

## The trade-off we accept

Arkiv data is public, so the signed totals of every receipt (spend, things done, merged PRs, spend per AI tool) are public too. That is the point of a checkable receipt, and it is why prompts, session titles and file names never go there, and why the list goes to Swarm encrypted. An employee who wants nothing public can simply not send a week.
