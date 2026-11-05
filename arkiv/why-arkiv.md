# Why Arkiv

Shared receipts need a home with four properties:

1. **Not owned by the employer's tool, and not by us.** The whole point of a receipt is that it is the employee's evidence. If it lived in the company dashboard's database, the company could edit or delete it; if it lived on our server, it would disappear with us. Arkiv is a public data layer neither party controls.
2. **Queryable.** A manager's view needs "all receipts for team X in week Y", and later "weeks where spend was high and survival was low". Arkiv entities carry typed, indexed attributes and a real query language. Plain blob storage (IPFS, a bucket) cannot answer that without an indexer we would have to run.
3. **Cheap, small writes.** One small entity per person per week. Storing that in contract storage on an L2 would cost far more and still need an indexer to query.
4. **Expiry built in.** Performance evidence should not live forever. Arkiv entities expire by design; we set 120 days.

## What we considered instead

| Option | Why not |
|---|---|
| Our own database | We would control the data and become the thing people have to trust (and a single point of failure). Fails the CROPS "works without you" test |
| A smart contract with events | Expensive per write, no attribute queries without running an indexer, data never expires |
| IPFS / Swarm only | Good for blobs, but no way to ask "all receipts for this team and week" without a separate index |
| Just a shared folder | No signatures checked, no history, depends on whoever hosts it |

## The trade-off we accept

Arkiv data is public. That is fine for what we store (signed totals the owner chose to share, or totals plus PR links), and it is why prompts, titles and file names never go there. Encrypting payloads for a private team is a natural next step.
