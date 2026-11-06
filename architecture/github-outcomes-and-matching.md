# GitHub outcomes and matching

Code: `web/src/lib/receipts/github.ts`, `outcomes.ts`, `match.ts`

## GitHub client

REST and GraphQL with an on-disk cache in `~/.receipts/cache/github` (PRs 1 hour, files and blame up to a day). Token from `GITHUB_TOKEN`, else `gh auth token`. 404 and 422 answers are cached as "missing".

## Matching sessions to changes

A **change** is a PR or a commit pushed straight to the default branch with no PR. Many people push to main directly, so both count as shipped. Signals, strongest first:

| Reason | Confidence | How |
|---|---|---|
| `pr-link` | 0.93 to 0.97 | PR URL recorded in the session (`pr-link` lines or `gitOperation.pr`) |
| `commit` | 0.85 to 0.9 | A commit SHA made in the session, looked up with `/commits/{sha}/pulls`; if no PR, the commit itself, which counts as pushed to main only if GitHub's compare (`{default}...{sha}` is `behind` or `identical`) shows the default branch contains it. Otherwise it is in progress (`open`) |
| `branch` | 0.75 | PRs whose head branch the session worked on or pushed, created within 21 days |
| `files-time` | up to 0.7 | Only if nothing stronger matched: overlap between edited files and PR files, PR within a week of the session. PRs over 100 files need a 30% overlap |
| `files-time` (pushes) | up to 0.65 | Only if still nothing matched: the token owner's own commits on the default branch with no PR (`commitsSince`, then `/commits/{sha}/pulls` is empty), committed from 10 minutes before the session to 2 days after it, at most 8 nearest, same overlap rule. This catches work committed and pushed from your own terminal, outside the AI session |

A session's cost is split across its linked changes by confidence (`attributeCost`), and each task keeps how much each session contributed.

## Outcomes

- **State:** merged, open, closed, or direct (pushed to main with no PR, confirmed on the default branch). Merged and direct both count as shipped, in the signed count (`mergedPrs`, shown as "shipped changes") and everywhere else.
- **Reverts:** base-branch commits after the merge are scanned for `This reverts commit <sha>`, `Revert "<title>"` and `Reverts owner/repo#N`.
- **Survival:** GraphQL blame on the base branch at merge + 30 days (or today, marked not matured). For the 8 files with the most added lines, count lines still attributed to the change's own commits: PR commits, the merge or squash commit, and base commits within two minutes of the merge (rebase merges). Lock files, images and build output are skipped.

## Known limits

- Deleted worktrees and scratch folders often cannot be linked to a repo; those sessions stay "Open" rather than being called abandoned.
- Survival is sampled, not exhaustive.
