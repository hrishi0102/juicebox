# The company side

Code: `web/src/app/company/*` (Overview, Teams, People, Pull requests, Setup), `web/src/components/company-door.tsx`, `company-identity.tsx`, `person-week.tsx`, `web/src/lib/server/org.ts`, `viewer.ts`, `web/src/lib/receipts/aggregate.ts`

This is the main product's other half: leads and managers see everyone's signed week. It has its own header (Company, the company name, its tabs, and who is signed in), and nothing from the employee side (writing, signing, 0G) appears here.

## Policy

- A company is a GitHub org and a team is a GitHub team.
- Everyone shares a signed week: their list of what they got done (category, title, cost), the pull requests behind it, and the totals (spend, spend per AI tool and per category, things done, merged PRs).
- Prompts, the AI's answers, session titles and file names are never collected. People can keep single items private; they still count in the signed totals.

## Data

`loadOrg(source)` returns the company's teams and every shared receipt:

- Demo mode: `web/fixtures/demo/org.json` (Acme: Payments, Platform, Mobile; 12 people; Claude Code and Codex; "You" uses the weeks written by the 0G model), merged with anything live on Arkiv for org `acme`.
- Your own data: the company you joined on this laptop (`~/.receipts/org.json`, written by My week, Setup or the CLI), else the GitHub sign-in, else the orgs and teams of the laptop's GitHub login. When none of those is known (`companyKnown` is false), every company page shows the door instead: Sign in with GitHub, or try the demo. Receipts are read from Arkiv by the indexed `org` attribute (5 second limit).

Every receipt is re-verified; only verified ones count, and only signed fields are used. Sealed weeks (list encrypted on Swarm) are opened only for members of the org (signed in with GitHub, or through the laptop's GitHub login) and in the demo, and only with the company key; a row then says "Opened from Swarm with the company key". Otherwise the rows show the signed totals, and one note at the top (`MemberNote`) says why the lists are closed: sign in as a member, or this copy has no company key.

## Overview (`/company`)

- "What did <company> get done this week?" with a week switcher.
- One headline ("$795 of AI got 34 things done"), the sentence by category ("Built 21 things, fixed 5 bugs, ..."), people, sessions, merged PRs and what went in circles, the spend bar by category, and who sent their receipt ("12 of 12 people sent their receipt this week", with a link to People).
- How the company worked (step times, PR funnel, waste by reason), from everyone's signed numbers.
- Teams table: people, spend, things done, merged PRs, share that went in circles, tool mix. Teams are compared, people are not ranked.
- Collapsed: spend by AI tool, week by week, what the company can and cannot see.

## People (`/company/people`)

Everyone's week: one collapsible row per person (name or GitHub login, team, things done, spend, merged PRs, their AI sentence) that opens to their signed list, their PRs, and whether the signature checked out. People who did not send are listed as such (when their names are known, as in the demo). `?who=<signing address>` opens that person's row; the employee's "See it as your company sees it" link uses it.

## Teams (`/company/team?team=<id>`)

Team and week switchers, the team headline and sentence, then everyone's week (the first one open). Default: your own team.

## Pull requests (`/company/prs`)

Every pull request in the week's signed receipts, with who and which team, most expensive first.

## Setup (`/company/setup`)

For whoever runs Receipts for the company. Read-only; everything is set in `web/.env.local`:

1. The company on GitHub (org and teams).
2. Sign in with GitHub for leads (OAuth App and its callback for this address).
3. The wallet that pays for records (`ARKIV_PRIVATE_KEY`) and its tGLM balance.
4. The company key that opens the lists (`COMPANY_PRIVATE_KEY`, default the wallet key) and its public key. When they are the same key, the page warns: set a separate company key before giving employees a wallet for fees, and give them only `COMPANY_PUBLIC_KEY`.
5. Swarm, where the encrypted lists live.
6. Invite your people: what each employee runs, and the only lines their `.env.local` needs (`ARKIV_PRIVATE_KEY` for fees, `COMPANY_PUBLIC_KEY`, the `SWARM_*` lines). They pay for the private AI themselves with Sign in with 0G.

## Not built yet

- Proving that a signing key belongs to a GitHub login (today the login inside the signed receipt is shown as claimed, next to the signing address). A one-time "link my key" step could post a signed note to the employee's GitHub that the company page checks.
- Automatic weekly sending (today: a button, or the CLI `share`).
- Restricting the company page to managers (today any member of the org can open the lists; GitHub can tell us who is an org owner or team maintainer).
