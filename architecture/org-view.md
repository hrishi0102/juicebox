# Org view (company dashboard)

Code: `web/src/app/org/page.tsx`, `web/src/app/team/page.tsx`, `web/src/lib/server/org.ts`

## Policy

- Everyone in the org shares a signed weekly receipt: spend, spend per AI tool, sessions, shipped tasks, % still alive, kept work, waste, label counts, **and the list of pull requests** the spend went into (title, link, status, % alive, AI cost each).
- Prompts, session titles, file names and the AI conversations themselves are never collected. They stay on the laptop.

The company can check exactly which PRs its AI money paid for; the employee keeps their prompts private and owns a signed record nobody can edit. (Earlier versions made the PR list optional; see decision 17.)

## Data

`loadOrg(source)` returns the org's teams and every shared receipt:

- Demo mode: `web/fixtures/demo/org.json` (Acme: Payments, Platform, Mobile; 12 people; Claude Code and Codex) merged with anything live on Arkiv for org `acme`.
- My logs mode: the org in `~/.receipts/org.json` (`npm run receipts -- org <id> "Name" team-id:Name ...`), receipts read from Arkiv by the indexed `org` attribute.

Every receipt is re-verified; only verified ones count, and only signed fields are used (`signedNumbers`).

## Company page (`/org`)

Top to bottom, most important first:

- Period: last 4 weeks or one week.
- One headline ("$X bought N shipped tasks, Y% still alive") and four numbers: AI spend (with tool split), shipped tasks, still alive, waste.
- **Pull requests it paid for**: the 8 most expensive with title, who, team, status and AI cost; "All N pull requests" opens the full list.
- Teams table: people, spend, shipped, alive, waste, tool mix; links to each team. Teams are compared, people are not ranked.
- Collapsed: spend by AI tool, week by week, what the company can and cannot see.

## Team page (`/team?team=<id>`)

A team lead's view: team and week switchers, the team headline and four numbers, then one collapsible row per person (headline and PR count) that opens to their PR table and receipt. People without a receipt that week are listed as such.

## Not built yet

- Org membership and invites (today the org is a config file plus Arkiv data).
- Automatic weekly sharing from each laptop (today: a button or the CLI `share`).
- Outcomes per tool (receipts carry spend per tool, not shipped tasks per tool).
