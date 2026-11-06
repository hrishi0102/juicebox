# Week story and scoring

Code: `web/src/lib/receipts/story.ts` (the list), `score.ts` (tasks and period numbers), `aggregate.ts` (company and team totals)

## The list: what you got

A `WeekItem` is one line of "what you got done this week": category, title, in progress or not, the sessions behind it, cost, linked PRs and AI tools.

- **With an AI story** (`applyStory`): the saved grouping and titles are re-applied to the current data. Every number (cost, PR states) is recomputed, so a saved story never shows stale costs. Sessions added since it was written are shown with the rules and counted as "new since".
- **Without one** (`ruleItems`): sessions that share a PR become one item named after it; the others stand alone. Above 10 items the smallest are folded into "N smaller bits and questions", and dead ends into their own line, so waste never hides.

`countLine` turns the items into "Built 3 things, fixed 2 bugs and figured out 4 problems." The AI's one sentence is shown when there is one. `sessionsHash` (session ids and end times) tells whether a story is out of date.

## Tasks

`buildTasks` turns each linked change into a task: state, reverted, survival, difficulty, kind, total cost, and cost per contributing session. `summarize` re-costs each task at only the share spent inside the period, so task costs add up to the period's spend.

## Numbers

| Number | Meaning |
|---|---|
| Spend | Sum of `sessionUsd` for sessions started in the period |
| Things done | Items that are not Wasted |
| Spend by category | Sum of item costs per category (items add up to spend) |
| Waste | Spend on Wasted items |
| Merged PRs | Tasks merged or pushed to main and not reverted |
| Cost by difficulty | Per difficulty bucket only, never compared across buckets or ranked across people |

Survival (lines still alive after 30 days) is still measured for PRs but no longer headlined or signed: people did not find it useful.

## Company and team totals

`aggregate` adds up shared receipts using only signed fields (`signedNumbers`): spend, sessions, things done, merged PRs, items and spend per category, spend per tool, people. `countsLine` writes the same kind of sentence for a whole team or company.

## Tips

Plain rules: loops above 10% of spend, abandoned work above 10%, overkill above 10%, very high cache-read share with very long sessions, one session dominating the week.

## Weeks

ISO weeks starting Monday 00:00 UTC (`weekOf`, `weeksBetween`).
