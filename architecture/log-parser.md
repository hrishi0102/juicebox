# Log parser and pricing

Code: `web/src/lib/receipts/parse.ts`, `web/src/lib/receipts/pricing.ts`

## Input

Claude Code writes one JSONL file per session at `~/.claude/projects/<folder>/<sessionId>.jsonl`, and subagent transcripts at `<sessionId>/subagents/**/agent-*.jsonl` (same `sessionId`). The parser streams each file line by line (`readline`), so big transcripts (hundreds of MB) do not load into memory.

## Record types we use

| Record | What we take |
|---|---|
| `assistant` | `message.usage` (tokens), `message.model`, tool calls (`tool_use` blocks), `cwd`, `gitBranch` |
| `user` | real prompts (count only), tool results (`is_error`), `toolUseResult.structuredPatch` (lines added and removed), `toolUseResult.gitOperation` (commits, pushes, PRs) |
| `pr-link` | PRs the session created or linked |
| `cost-state` | Claude Code's own running cost total, for a cross-check |
| `ai-title`, `custom-title` | session title (stays local) |
| `system` | API errors, context compactions |

## Gotchas handled

- **Repeated usage.** One API response is written as several lines (one per content block), each repeating the same `usage`. Usage is counted once per `message.id + requestId`; content blocks are read from every line, deduped by tool-use id.
- **Resumed sessions.** `cost-state` is cumulative per Claude Code process and resets when a session is resumed. We sum the last value of each segment.
- **Moved folders.** The session's folder may no longer exist. Repo resolution tries, in order: PR URLs recorded in the session, the folder's git remote, the git remote of edited files, a path segment that matches a known repo name, then other sessions from the same folder.

## Pricing

`pricing.ts` holds list prices per million tokens for every Claude model (input, output, cache read), with cache writes at 1.25x input (5 minute TTL) and 2x input (1 hour TTL), fast mode at 2x, Haiku 5.5 long-context pricing, and web searches at $0.01. Unknown model versions fall back to their family's price and are flagged.

The billed number for a session is `max(our price, Claude Code's tracker)` (`sessionUsd`), so hidden side calls Claude Code makes are not under-counted. On real logs the two agree within about 2%.

## Output

A `Session`: cost (total, per model, tokens), folder, repos, branches, times and active minutes, files edited, lines added and removed, git operations, and loop signals (error streaks, repeated commands, edits to the same file, test runs). Prompts are not stored. `buildPrivateDigest` re-reads the transcript on demand when the private AI needs it: the prompts, and the text of the AI's last three answers (joined per `message.id`, subagent lines skipped).

## Continued conversations

Claude Code keeps a full copy of a conversation when it is continued or forked, so the same lines (same `uuid`, same API response) sit in several files. `scanSessions` reads files with fewer message lines first and skips any line already seen, so the original owns the shared history and each copy keeps only its new part. Without this, one long conversation was counted once per copy (about \$615 instead of \$272 in one real week). Byte size and raw line count are not reliable for the order: copies drop bookkeeping lines the original has.

## Step times

`TimelineBuilder` (`timeline.ts`) records, per session: first and last prompt, first and last code edit, plan mode (`ExitPlanMode`), first commit, PR opened or linked, and whether the AI's last answer asked something or offered more with nobody replying. Commits made through the shell (`git commit`, `gh pr create`) count when their tool result succeeded, since Claude Code does not always write `gitOperation` records; the sha is kept when the output shows it. Codex sessions use `user_message`, `agent_message`, `apply_patch` and commit output.
