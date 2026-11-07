# Reach

Juicebox was first called Receipts, which is why the schema and folder names keep that word. A "receipt" is the signed weekly list one person sends.

## Who it is for

Companies whose engineers use AI coding agents (Claude Code, Codex) and who are asked "what are we getting for this AI budget?". AI coding spend of hundreds to thousands of dollars per engineer per month is now common, and the usual answer is a token leaderboard, which rewards burning tokens. Juicebox answers with one signed receipt per engineer per week.

Two kinds of people touch Arkiv:

- **Employees write.** Each one runs Juicebox on their laptop and sends their week. They never need a wallet, tGLM or a faucet: the company wallet pays the fee and the entity is handed to them.
- **Leads, managers and reviewers read.** They never write. Every time someone opens the company page, it queries Arkiv and re-checks every receipt. Anyone with a receipt link (a reviewer, a new manager) reads one entity straight from Arkiv.

## Would they use it?

What makes it easy to say yes:

- **For the employee it costs almost nothing.** No wallet, no tGLM, no faucet. The private AI on 0G costs about a cent a week, paid from their own 0G credits. Nothing leaves the laptop until they click Send, and prompts never leave it at all.
- **For the company there is nothing to set up per person.** The company is the GitHub org and a team is a GitHub team, so a lead signs in with GitHub and sees everyone who has sent a week.
- **It replaces something people already dislike.** A token leaderboard ranks people by how much they burn. A receipt says what got done, and the person who did the work signs it.

What we have, honestly:

- **The author uses it on their own work.** This week: 9 Claude Code and Codex sessions, written up by the private AI on 0G in about 20 seconds for under $0.01, all TEE verified.
- **No outside company has sent receipts yet.** The 89 live entities belong to the demo company Acme (synthetic data, safe to show). Getting one real team to send receipts for a month is the first thing we do after Mumbai.

## Can they try it today?

Yes, in three ways:

1. **The demo, nothing to set up.** `cd web && npm install && npm run dev`, then open http://localhost:3000/demo and pick a role at Acme: its lead, an engineer, or someone with a link. With a free `ARKIV_ACCESS_KEY` (https://hub.arkiv.network/access-keys) in `web/.env.local`, the company pages read Acme's receipts live from Arkiv. Without one, Arkiv refuses anonymous queries, so the page shows the bundled demo files and says Arkiv did not answer.
2. **Their own week.** `npm run receipts -- scan` reads their Claude Code and Codex logs (nothing leaves the laptop). Then in the app, My week, Setup: Sign in with 0G, join the company from their GitHub teams, and Write my week.
3. **Check a receipt without running anything.** Open one on the Arkiv explorer, for example [this sealed week](https://rabdi.explorer.arkiv.network/entity/0xea50b76a7c871350d819fac561481bfb8070e3da040b3828e9369d0d99cb9ca6), or run the `curl` query in the [README](../README.md#arkiv-build-on-arkiv-from-scratch-with-the-arkiv--swarm-bonus).

## How it grows Arkiv usage

- **One entity per engineer per week, read every week.** A 20-person team writes about 1,000 receipts a year; 100 such companies write 100,000, and every one is read again each time a lead opens the page.
- **Readers outnumber writers, and none of them needs a wallet.** Each company brings its managers to Arkiv as readers.
- **Receipts travel.** A receipt is portable evidence. When someone changes jobs, the Arkiv entity key is something they can hand to a new manager, who reads it from Arkiv to check it.
- **Other tools can build on the schema.** The schema is documented ([schema.md](schema.md)) and every payload is signed, so a budgeting tool, a monthly scoring job (we built one on Chainlink CRE that reads the same entities with a raw `arkiv_query`) or a different dashboard can read the same entities without asking us.

## Live numbers (Arkiv testnet Rabdi, checked Nov 7)

- **89 receipt entities** for the demo company Acme: 12 people in 3 teams over 5 weeks. 60 carry the full list on Arkiv; 29 are sealed, with the list encrypted on Swarm.
- **12 owners**: every receipt is owned by the person who signed it, not by the wallet that paid for it.
- The author's own logs: about 50 Claude Code sessions a month, which turn into 4 or 5 weekly receipts a month for one person.

## Will we keep building it after Mumbai?

Yes. In this order:

1. Get one real team to send receipts for a month, and read them with the Chainlink check.
2. Ship the employee app as an npm package, so a company can roll it out with one command.
3. Publish the schema and a small reader library, so other tools can query a company's receipts.
4. Let a company run its own Arkiv writer and Swarm batch, so it pays for its own receipts and their storage lives as long as the receipts do.
