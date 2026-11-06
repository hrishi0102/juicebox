# Architecture overview

Receipts shows what AI coding spend bought. It runs on the user's own machine, reads Claude Code's local logs, checks GitHub for outcomes, labels sessions with a private AI judge, and produces a signed weekly receipt the user owns.

Keep these files in sync with the code. When a module changes shape, update its file here in the same commit.

## Data flow

```
~/.claude/projects/*.jsonl          GitHub API (PRs, commits, blame)
          |                                   |
          v                                   v
   [1 Log parser] --sessions--> [2 Matcher] <--+
          |                         |
          |                    links + changes
          v                         v
   [3 Judge] <--- outcomes --- [2 Outcomes: merged, reverted, survival]
   (rules always, 0G private model when configured)
          |
          v
   [4 Scorer] --> weekly summary --> [5 Receipt (EIP-712 + Merkle roots)]
                                              |
                                   signed by the user's key
                                              |
                                              v
                                   [6 Arkiv] shared receipts
                                              |
                     +------------------------+------------------------+
                     v                        v                        v
               Team page               /r/<entity key>        [7 CRE monthly job]
                                                              (optional, writes score
                                                               to TeamScoreboard)
```

## Modules

| # | Module | Code | Doc |
|---|---|---|---|
| 1 | Log parser and pricing | `web/src/lib/receipts/parse.ts`, `pricing.ts` | [log-parser.md](log-parser.md) |
| 2 | GitHub outcomes and matching | `github.ts`, `outcomes.ts`, `match.ts` | [github-outcomes-and-matching.md](github-outcomes-and-matching.md) |
| 3 | Judge (rules and 0G) | `heuristics.ts`, `judge.ts`, `review.ts` | [judge.md](judge.md) |
| 4 | Scoring | `score.ts` | [scoring.md](scoring.md) |
| 5 | Receipts and signing | `receipt.ts` | [receipts-and-signing.md](receipts-and-signing.md) |
| 6 | Arkiv sharing | `arkiv.ts` | [arkiv-sharing.md](arkiv-sharing.md) |
| 7 | Web app, API and CLI | `web/src/app`, `web/src/lib/server`, `web/scripts` | [web-app.md](web-app.md) |
| 8 | CRE job and contracts (optional) | `cre/`, `contracts/` | [cre-and-contracts.md](cre-and-contracts.md) |

Key decisions and their reasons are in [decisions.md](decisions.md).

## Where data lives

| Data | Location | In git? |
|---|---|---|
| Raw Claude Code logs | `~/.claude/projects` | Never |
| Parsed dataset, signed receipts, reviews, GitHub cache | `~/.receipts` (or `RECEIPTS_DATA_DIR`, `/tmp/receipts` on Vercel) | Never |
| Synthetic demo team | `web/fixtures/demo` | Yes |
| Shared receipts | Arkiv testnet Rabdi | Public chain data |

A pre-commit hook (`.githooks/pre-commit`, enabled with `git config core.hooksPath .githooks`) blocks `.jsonl` files, the data folders, and any file containing Claude Code transcript lines.

## Shared types

All shapes live in `web/src/lib/receipts/types.ts`: `Session`, `Change`, `SessionMatch`, `Judgement`, `Task`, `PeriodSummary`. A `Dataset` (in `pipeline.ts`) bundles them and is what the app and CLI read.
