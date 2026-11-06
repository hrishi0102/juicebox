# Rules and the private AI

Code: `web/src/lib/receipts/heuristics.ts` (rules), `judge-core.ts` (prompts and parsers, browser-safe), `judge.ts` (server calls), `week.ts` (writing a week), `review.ts` (optional weekly tips)

Every session gets a **category** (Built, Fixed, Figured out, Researched, Wrote, Planned, Wasted), a plain **title**, a difficulty from 1 to 5, a kind (feature, fix, ...) and a short generic reason. The older outcome **label** (Shipped, Learned, Looped, Abandoned, Overkill, Open) is still computed for scoring and tips.

## Rules (always, instant, no AI)

- Category: a linked PR or commit makes it Built (or Fixed for a fix, Wrote for docs-only work); no edits and two or more web searches make it Researched; Claude Code plan mode makes it Planned; otherwise Figured out. Abandoned work, and looping with nothing shipped, is Wasted.
- Title: the PR title without its `feat:` style prefix, else the session's own title (Claude's AI title, or Codex's first prompt), else "Session in <repo>".
- Labels: Shipped (merged, not reverted), Looped (loop score 3+), Abandoned (edited code in a known repo, older than 3 days, nothing shipped), Open (`Pending`: open PR, fresh edits, or no repo found), Learned (no edits), Overkill (small shipped work that cost far more than usual).

Reading logs (`scan`) only runs these rules. The AI runs only when someone asks for their week to be written.

## The private AI on 0G

Two kinds of calls, both to the 0G router (`https://router-api.0g.ai/v1`, OpenAI-compatible):

1. **One call per session** (`SESSION_SYSTEM`). The message is a private digest: the trimmed prompts (first 6 and last 3 when there are many), the AI's last three answers (600 characters each), a tool-use summary, the GitHub outcome with PR titles, the cost, and the rules' guess. The answer is JSON: category, title, in_progress, difficulty, kind, reason, tip.
2. **One call per week** (`WEEK_SYSTEM`). The message holds only one line per session (`S1 | Built | title | $cost | PR: title (state)`), never prompts. The answer merges sessions about the same work into 3 to 10 items, most impressive first, Wasted last, plus one sentence about the week. Sessions the model leaves out come back through the rules (`itemsFromAnswer`).

Every call:

- `X-0G-Provider-Trust-Mode: private`: only providers running the model inside a TEE may answer; the router never falls back silently.
- `verify_tee: true`: the router checks the TEE signature (`x_0g_trace.tee_verified`).
- `selfVerifyTee` checks the same signature again with the 0G SDK (`processResponse`) against the signer registered on 0G mainnet, without trusting the router.
- Model `0gm-1.0-35b-a3b-sia` with `chat_template_kwargs: { enable_thinking: false }` (about 2 seconds and $0.001 a call). If its provider is down, `glm-5.3`, then `0gm-1.0-35b-a3b`. 503 and 429 are retried; 401, 402 and 403 stop at once.
- The answer is parsed forgivingly (`<think>` blocks, code fences, "figured out" vs "Figured out") and titles are cleaned (`cleanTitle`: no keys, addresses, emails, paths or em dashes).

We keep: category, title, difficulty, kind, reason, the 0G request id, chat id, provider, TEE check results, who paid, the cost, and keccak hashes of exactly what was sent and returned. Prompts and answers are never stored. The session page shows the exact message before anything is sent.

## Writing a week (`week.ts`)

`writeWeekStory(source, week)`: sessions in the week whose judgement is still rules-only (`needsAi`) go to call 1 (6 at a time); then call 2 writes the list. The result is a `WeekStory` saved to `~/.receipts/weeks/<week>.json` (demo: `~/.receipts/demo-weeks/`, with a committed copy in `web/fixtures/demo/weeks/`). The demo has no transcripts, so only call 2 runs for it.

Paying with your own 0G account ("Sign in with 0G") runs the same three steps from the browser instead: `browserPlan` (messages), `browserSessions` (answers to judgements), `browserWeek` (answer to story), behind `/api/week/browser`. See [sign-in.md](sign-in.md).

A rescan keeps earlier AI judgements for sessions whose activity and GitHub outcome did not change.

`openai-compatible` (for example Ollama) uses the same path without the 0G headers.

## Weekly review

`review.ts` sends one line per session of a week and gets back a two-sentence summary and three tips about where money leaked. Saved in `~/.receipts/reviews`.
