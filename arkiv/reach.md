# Reach

## Who uses this

Companies whose engineers use AI coding agents (Claude Code, Codex) and who are asked "what are we getting for this AI budget?". AI coding spend of hundreds to thousands of dollars per engineer per month is now common, and the usual answer is a token leaderboard, which rewards burning tokens. Receipts answers with one signed receipt per engineer per week.

Two kinds of people touch Arkiv:

- **Employees write.** Each one runs Receipts on their laptop and sends their week. They never need a wallet, tGLM or a faucet: the company wallet pays the fee and the entity is handed to them.
- **Leads, managers and reviewers read.** They never write. Every time someone opens the company page, it queries Arkiv and re-checks every receipt. Anyone with a receipt link (a reviewer, a new manager) reads one entity straight from Arkiv.

## How it grows Arkiv usage

- **One entity per engineer per week, read every week.** A 20-person team writes about 1,000 receipts a year; 100 such companies write 100,000, and every one is read again each time a lead opens the page.
- **Readers outnumber writers, and none of them needs a wallet.** Each company brings its managers to Arkiv as readers.
- **Receipts travel.** A receipt is portable evidence. When someone changes jobs, the Arkiv entity key is something they can hand to a new manager, who reads it from Arkiv to check it.
- **Other tools can build on the schema.** The schema is documented ([schema.md](schema.md)) and every payload is signed, so a budgeting tool, a monthly scoring job (we built one on Chainlink CRE that reads the same entities with a raw `arkiv_query`) or a different dashboard can read the same entities without asking us.

## Live numbers (Arkiv testnet Rabdi, checked Nov 7)

- **89 receipt entities** for the demo company Acme: 12 people in 3 teams over 5 weeks. 60 carry the full list on Arkiv; 29 are sealed, with the list encrypted on Swarm.
- **12 owners**: every receipt is owned by the person who signed it, not by the wallet that paid for it.
- **12 card entities** on the wall, each pointing to an image on Swarm.
- The author's own logs: about 50 Claude Code sessions a month, which turn into 4 or 5 weekly receipts a month for one person.

## Plan after the hackathon

1. Ship the employee app as an npm package (`npx receipts`), so a company can roll it out with one command.
2. Publish the schema and a small reader library, so other tools can query a company's receipts.
3. Let a company run its own Arkiv writer and Swarm batch, so it pays for its own receipts and their storage lives as long as the receipts do.
