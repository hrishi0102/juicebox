# Org view (company dashboard)

Code: `web/src/app/org/page.tsx`, `web/src/app/team/page.tsx`, `web/src/lib/server/org.ts`

## Policy (the "middle path")

- Everyone in the org shares their signed weekly **totals**: spend, spend per AI tool, sessions, shipped tasks, % still alive, kept work, waste, label counts.
- Sharing the **PR list** (evidence) is each person's choice.
- Prompts, session titles, file names and unshared sessions are never collected.

The company gets real numbers across people and AI tools; the employee keeps their prompts private and owns a signed record nobody can edit.

## Data

`loadOrg(source)` returns the org's teams and every shared receipt:

- Demo mode: `web/fixtures/demo/org.json` (Acme: Payments, Platform, Mobile; 12 people; Claude Code and Codex) merged with anything live on Arkiv for org `acme`.
- My logs mode: the org in `~/.receipts/org.json` (`npm run receipts -- org <id> "Name" team-id:Name ...`), receipts read from Arkiv by the indexed `org` attribute.

Every receipt is re-verified; only verified ones count, and only signed fields are used (`signedNumbers`).

## Org page (`/org`)

- Period: last 4 weeks or one week.
- Totals: AI spend, shipped tasks, % still alive, waste, kept work per $100.
- Spend by AI tool (from the signed `tools` and `toolSpendCents` fields).
- By team: people (and how many share PRs), spend, shipped, alive, waste, kept per $100, tool mix. Teams are compared, people are not ranked.
- Week by week: spend bar split by tool, with shipped tasks and % alive.

## Team page (`/team?team=<id>`)

A team lead's view: team totals for a week, each person's headline and share level, their receipt paper, and evidence when shared. People without a receipt that week are listed as such.

## Not built yet

- Org membership and invites (today the org is a config file plus Arkiv data).
- Automatic weekly sharing from each laptop (today: a button or the CLI `share`).
- Outcomes per tool (receipts carry spend per tool, not shipped tasks per tool).
