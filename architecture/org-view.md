# Company and team view

Code: `web/src/app/org/page.tsx`, `web/src/app/team/page.tsx`, `web/src/components/person-week.tsx`, `web/src/lib/server/org.ts`, `web/src/lib/receipts/aggregate.ts`

## Policy

- A company is a GitHub org and a team is a GitHub team.
- Everyone shares a signed week: their list of what they got done (category, title, cost), the pull requests behind it, and the totals (spend, spend per AI tool and per category, things done, merged PRs).
- Prompts, the AI's answers, session titles and file names are never collected. People can keep single items private; they still count in the signed totals.

## Data

`loadOrg(source)` returns the company's teams and every shared receipt:

- Demo mode: `web/fixtures/demo/org.json` (Acme: Payments, Platform, Mobile; 12 people; Claude Code and Codex; "You" uses the weeks written by the 0G model), merged with anything live on Arkiv for org `acme`.
- My logs mode: the org and team from `shareTarget()`: CLI settings in `~/.receipts/org.json` if present, else the GitHub sign-in, else the orgs and teams of the GitHub token the app already uses. Receipts are read from Arkiv by the indexed `org` attribute (5 second limit).

Every receipt is re-verified; only verified ones count, and only signed fields are used.

## Company page (`/org`)

- "What did <company> get done this week?" with a week switcher.
- One headline ("$795 of AI got 34 things done"), the sentence by category ("Built 21 things, fixed 5 bugs, ..."), people, sessions, merged PRs and what went in circles, and the spend bar by category.
- **Everyone's week**: one collapsible row per person (name or GitHub login, team, things done, spend, merged PRs, their AI sentence) that opens to their signed list, their PRs, and whether the signature checked out. People who did not share are listed as such.
- Teams table: people, spend, things done, merged PRs, share that went in circles, tool mix. Teams are compared, people are not ranked.
- Collapsed: every PR, spend by AI tool, week by week, what the company can and cannot see.

## Team page (`/team?team=<id>`)

Team and week switchers, the team headline and sentence, then everyone's week (the first one open).

## Not built yet

- Pinning each signing address to a GitHub login on first sight (today the login inside the signed receipt is shown as claimed).
- Automatic weekly sharing (today: a button, or the CLI `share`).
- Restricting who can read a company's page (Arkiv data is public; the page is a view, not a lock).
