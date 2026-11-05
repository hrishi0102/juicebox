# Reach

## Who uses this

Any engineer who uses an AI coding agent and wants evidence of what that spend bought, and any team lead who has been asked "what are we getting for this AI budget?". Today that is most software teams: AI coding budgets of hundreds to thousands of dollars per engineer per month are common, and the default answer is a token leaderboard.

## How it grows Arkiv usage

- **One entity per engineer per week.** A team of 20 sharing weekly writes about 1,000 entities a year; 100 such teams write 100,000. Every one of those is also read back, every time someone opens the team page.
- **Reads come from people who never write.** Managers, reviewers and HR only read. Each share pulls new readers onto Arkiv without them needing a wallet.
- **Receipts travel.** A receipt is portable evidence. When someone changes jobs, an Arkiv entity key is something they can hand to a new manager, who then reads from Arkiv to check it.
- **Other tools can build on the schema.** The schema is documented ([schema.md](schema.md)) and the payload is signed, so a monthly scoring job, a budgeting tool, or a different dashboard can read the same entities without asking us.

## Numbers from the first run

- Author's own last 30 days: 49 Claude Code sessions, about $684 of usage, 39 linked pull requests or commits. That turns into 5 weekly receipts, so 5 entities a month for one person, each a few KB.
- The demo team (5 people, 4 shared, 4 weeks) is 19 signed receipts.

## Plan after the hackathon

1. Ship the CLI as an npm package (`npx receipts scan`) so anyone can try it in a minute.
2. Publish the schema and a small reader library so other tools can query team receipts.
3. Offer encrypted team payloads (only team members can decrypt), so companies that cannot share PR names in public can still use Arkiv as the neutral store.
