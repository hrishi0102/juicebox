# Architecture overview

Receipts answers one question for a company: **what did everyone's AI spend get done?** It runs on each person's laptop, reads the local logs of their AI tools (Claude Code and Codex today), links sessions to GitHub, and has a private AI on 0G (paid from the person's own 0G credits) write the week as a short list (Built, Fixed, Figured out, Researched, Wrote, Planned, Wasted). The person reviews it, signs it and sends it to their company, which sees everyone's signed lists and totals but never prompts. As a side product, anyone can post their week as a card or see their AI Wrapped.

## Who it is for

One main product with two sides, joined by the signed receipt, and one side product:

- **The employee** runs Receipts on their laptop (My week, `/me`). Set up once (GitHub, join the company, Sign in with 0G, read logs), then every week: write (the private AI on 0G, paid from their own 0G credits), review what the company will see, sign, send.
- **The company** (leads and managers) signs in with GitHub and sees everyone's signed week, by team and person, with the pull requests behind it (`/company`). Whoever runs it sets up a wallet for fees, a company key and Swarm once (Company, Setup).
- **For fun**, for anyone: AI Wrapped, a card of your week for socials, and the wall (`/wrapped`, `/card`, `/wall`). Nothing there is signed or sent to a company.

Anyone with a link can check a shared receipt (`/r/<key>`, `/verify`); the demo company has a role picker (`/demo`). Details: [web-app.md](web-app.md).

Keep these files in sync with the code. When a module changes shape, update its file here in the same commit.

## Data flow

```
~/.claude/projects   ~/.codex/sessions          GitHub API (PRs, commits)
          \            /                                 |
           v          v                                  v
   [1 Tool readers] --sessions--> [2 Matcher + outcomes: merged, open, reverted]
          |                                  |
          v                                  v
   [3 Rules]  category + title for every session (no AI, instant)
          |
          |   "Write my week" (on demand only)
          v
   [3 Private AI on 0G, TEE only]
      call 1, per session: private digest -> category + title
      call 2, per week: the titles only -> merged list + one sentence
          |
          v
   [4 Week story + scoring] --> what you got, spend by category and tool
          |                                   |
          v                                   v
   [5 Share card] (PNG drawn locally)   [6 Receipt v2: EIP-712, Merkle roots over items, PRs, AI calls]
                                              |  signed with a key made on the laptop
                                              v
                                   [7 Arkiv] read-only record, owned by the signer
                                              |  signed totals in public; the full week
                                              |  encrypted on Swarm, key sealed to the company
                                              |
                     +------------------------+------------------------+
                     v                        v                        v
          Company and team pages       /r/<entity key>        [8 CRE job] (optional)
          (company = GitHub org)
```

## Modules

| # | Module | Code | Doc |
|---|---|---|---|
| 1 | Log parser and pricing (Claude Code) | `web/src/lib/receipts/parse.ts`, `pricing.ts` | [log-parser.md](log-parser.md) |
| 1b | Other AI tool readers (Codex) | `codex.ts` | [ai-tools.md](ai-tools.md) |
| 2 | GitHub outcomes and matching | `github.ts`, `outcomes.ts`, `match.ts` | [github-outcomes-and-matching.md](github-outcomes-and-matching.md) |
| 3 | Rules and the private AI | `heuristics.ts`, `judge-core.ts`, `judge.ts`, `week.ts`, `review.ts` | [judge.md](judge.md) |
| 4 | Week story and scoring | `story.ts`, `score.ts`, `aggregate.ts` | [scoring.md](scoring.md) |
| 5 | Week card (side product) | `card.ts`, `app/api/card`, `app/(personal)/card` | [web-app.md](web-app.md) |
| 6 | Receipts and signing | `receipt.ts`, `identity.ts` | [receipts-and-signing.md](receipts-and-signing.md) |
| 7 | Arkiv sharing | `arkiv.ts` | [arkiv-sharing.md](arkiv-sharing.md) |
| 7a | Swarm storage: sealed weeks and public cards | `swarm.ts`, `seal.ts`, `cards.ts`, `app/(personal)/wall` | [../arkiv/swarm.md](../arkiv/swarm.md) |
| 7b | The company side | `app/company`, `lib/server/org.ts`, `lib/server/viewer.ts` | [org-view.md](org-view.md) |
| 7c | Who you are, who pays, who signs (GitHub, Sign in with 0G, the laptop key) | `lib/server/session.ts`, `app/api/auth`, `app/api/join`, `components/zero-g.tsx`, `lib/zerog-tasks.ts` | [sign-in.md](sign-in.md) |
| 7d | The employee side (My week): set up, write, review, sign, send | `app/me`, `components/send-flow.tsx`, `lib/server/employee.ts`, `lib/receipts/flow.ts` | [web-app.md](web-app.md) |
| 8 | Web app, API and CLI | `web/src/app`, `web/src/lib/server`, `web/scripts` | [web-app.md](web-app.md) |
| 9 | CRE job and contracts (optional) | `cre/`, `contracts/` | [cre-and-contracts.md](cre-and-contracts.md) |
| 10 | AI Wrapped (fun segments, persona, chat exports) | `chat-stats.ts`, `wrapped.ts`, `chat-import.ts`, `app/(personal)/wrapped` | [wrapped.md](wrapped.md) |

Key decisions and their reasons are in [decisions.md](decisions.md).

## Where data lives

| Data | Location | In git? |
|---|---|---|
| Raw Claude Code and Codex logs | `~/.claude/projects`, `~/.codex/sessions` | Never |
| Parsed dataset, week stories, signed receipts, GitHub cache | `~/.receipts` (or `RECEIPTS_DATA_DIR`, `/tmp/receipts` on Vercel) | Never |
| The laptop's signing key | `~/.receipts/identity.json` (mode 0600) | Never |
| AI Wrapped roast lines | `~/.receipts/wrapped-roasts.json` | Never |
| Synthetic demo company (Acme, 3 teams, 12 people) | `web/fixtures/demo` (`dataset.json`, `org.json`, `weeks/`) | Yes |
| Shared receipts | Arkiv testnet Rabdi | Public chain data |
| Shared weeks' lists (encrypted) and public cards | Swarm (testnet gateway by default) | Public network data; the lists are ciphertext |

A pre-commit hook (`.githooks/pre-commit`, enabled with `git config core.hooksPath .githooks`) blocks `.jsonl` files, the data folders, and any file containing Claude Code transcript lines.

## Shared types

All shapes live in `web/src/lib/receipts/types.ts`: `Session`, `Change`, `SessionMatch`, `Judgement` (category, title, label, difficulty, AI record), `Task`, `WeekItem`, `WeekStory`, `PeriodSummary`. A `Dataset` (in `pipeline.ts`) bundles them and is what the app and CLI read.
