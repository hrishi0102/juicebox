# Scoring

Code: `web/src/lib/receipts/score.ts`

## Tasks

`buildTasks` turns each linked change into a task: state, reverted, survival ratio, difficulty, kind, total cost, and cost per contributing session. `summarize` picks the sessions that started inside a period and the tasks they touched, and re-costs each task at only the share spent inside that period, so task costs add up to the period's spend.

## Definitions

| Number | Meaning |
|---|---|
| Spend | Sum of `sessionUsd` for sessions started in the period |
| Shipped tasks | Tasks merged or pushed to main. Reverted ones still count, at 0% alive |
| Still alive | Line-weighted: alive lines over added lines across shipped tasks; reverted tasks add their lines as dead |
| Kept work | Sum of each shipped task's alive share (a 91% alive task counts 0.91) |
| Kept work per $100 | Kept work / spend x 100 |
| Waste | Looped spend + Abandoned spend + the part of Overkill spend above the median shipped cost for that difficulty |
| Cost per kept task | Per difficulty bucket only. Never compared across buckets or ranked across people |

## Tips

Plain rules: loops above 10% of spend, abandoned work above 10%, overkill excess above 5%, very high cache-read share with very long sessions, one session dominating the week.

## Weeks

ISO weeks starting Monday 00:00 UTC (`weekOf`, `weeksBetween`).
