# Architecture overview

Receipts shows what AI coding spend bought, for each person and for the whole company. It runs on each person's machine, reads the local logs of their AI coding tools (Claude Code and Codex today), checks GitHub for outcomes, labels sessions with a private AI judge, and produces a signed weekly receipt the user owns.

Keep these files in sync with the code. When a module changes shape, update its file here in the same commit.

## Data flow

```
~/.claude/projects   ~/.codex/sessions   GitHub API (PRs, commits, blame)
          \            /                          |
           v          v                           v
   [1 Tool readers] --sessions--> [2 Matcher] <---+
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
          Org page and team pages       /r/<entity key>        [7 CRE monthly job]
                                                              (optional, writes score
                                                               to TeamScoreboard)
```

## Modules

| # | Module | Code | Doc |
|---|---|---|---|
| 1 | Log parser and pricing (Claude Code) | `web/src/lib/receipts/parse.ts`, `pricing.ts` | [log-parser.md](log-parser.md) |
| 1b | Other AI tool readers (Codex) | `codex.ts` | [ai-tools.md](ai-tools.md) |
| 2 | GitHub outcomes and matching | `github.ts`, `outcomes.ts`, `match.ts` | [github-outcomes-and-matching.md](github-outcomes-and-matching.md) |
| 3 | Judge (rules and 0G) | `heuristics.ts`, `judge.ts`, `review.ts` | [judge.md](judge.md) |
| 4 | Scoring | `score.ts` | [scoring.md](scoring.md) |
| 5 | Receipts and signing | `receipt.ts` | [receipts-and-signing.md](receipts-and-signing.md) |
| 6 | Arkiv sharing | `arkiv.ts` | [arkiv-sharing.md](arkiv-sharing.md) |
| 7 | Web app, API and CLI | `web/src/app`, `web/src/lib/server`, `web/scripts` | [web-app.md](web-app.md) |
| 7b | Org view (company dashboard) | `web/src/app/org`, `web/src/lib/server/org.ts` | [org-view.md](org-view.md) |
| 8 | CRE job and contracts (optional) | `cre/`, `contracts/` | [cre-and-contracts.md](cre-and-contracts.md) |

Key decisions and their reasons are in [decisions.md](decisions.md).

## Where data lives

| Data | Location | In git? |
|---|---|---|
| Raw Claude Code and Codex logs | `~/.claude/projects`, `~/.codex/sessions` | Never |
| Parsed dataset, signed receipts, reviews, GitHub cache | `~/.receipts` (or `RECEIPTS_DATA_DIR`, `/tmp/receipts` on Vercel) | Never |
| Synthetic demo company (3 teams) | `web/fixtures/demo` (`dataset.json`, `org.json`) | Yes |
| Shared receipts | Arkiv testnet Rabdi | Public chain data |

A pre-commit hook (`.githooks/pre-commit`, enabled with `git config core.hooksPath .githooks`) blocks `.jsonl` files, the data folders, and any file containing Claude Code transcript lines.

## Shared types

All shapes live in `web/src/lib/receipts/types.ts`: `Session`, `Change`, `SessionMatch`, `Judgement`, `Task`, `PeriodSummary`. A `Dataset` (in `pipeline.ts`) bundles them and is what the app and CLI read.
