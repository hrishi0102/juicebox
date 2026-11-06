# AI tool readers

Code: `web/src/lib/receipts/parse.ts` (Claude Code), `web/src/lib/receipts/codex.ts` (Codex), prices in `pricing.ts`

Each AI coding tool gets one small reader that turns its local logs into the shared `Session` shape (with `tool` set). Everything after that (matching to GitHub, the judge, scoring, receipts, the org view) is tool-agnostic. `scanSessions` runs every reader and merges the results.

| Tool | `tool` value | Where its logs live | Status |
|---|---|---|---|
| Claude Code | `claude-code` | `~/.claude/projects/<folder>/<sessionId>.jsonl` (+ subagents) | Built, see [log-parser.md](log-parser.md) |
| OpenAI Codex (CLI and desktop) | `codex` | `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl` | Built |
| Cursor, Copilot, others | | Little or no local token data | Not built; plan: import the vendor's usage export per person |

Sessions saved before multi-tool support have no `tool` field; `toolOf()` treats them as Claude Code.

## Codex format (checked against Codex 0.119 to 0.153)

| Record | What we take |
|---|---|
| `session_meta` | session id, working folder |
| `turn_context` | model for the following responses (`gpt-5.4`, `gpt-5.5`, `gpt-5.6-terra`...) |
| `token_usage_record` | usage per API response, deduped by `response_id` (newer versions) |
| `event_msg / token_count` | running `total_token_usage`; we use the increase between events (older versions, only when no usage records exist) |
| `event_msg / user_message` | prompt count, title, prompts for the private AI (read on demand) |
| `event_msg / agent_message` (or `response_item / message` from the assistant in older logs) | the AI's answers for the private AI (read on demand, `codexTranscript`) |
| `response_item / custom_tool_call` `apply_patch` | edited files and lines from the patch text (`*** Update File:` headers, `+`/`-` lines) |
| `response_item / function_call` `exec`, `exec_command` | shell commands: test runs, repeated commands, branches created |
| `response_item / function_call_output` | `Process exited with code N` (errors and error streaks), GitHub PR URLs, `git commit` output `[branch sha]` |

## Pricing

OpenAI list prices from developers.openai.com/api/docs/pricing (read Nov 6, 2026), per million tokens. Codex logs count cached tokens inside `input_tokens` and reasoning inside `output_tokens`, so cost = (input minus cached) x input price + cached x cached price + output x output price. Above 272K input tokens in one request, the long-context rates apply (gpt-5.4, 5.5, 5.6). Older `*-codex` model ids use their base model's price; unknown models are priced like gpt-5.5 and flagged.

As with Claude, this is the API list price of the tokens, not what a subscription plan bills.

## Adding a tool

1. Write `<tool>.ts` with `scan<Tool>Sessions()` returning `Session[]` with `tool` set, and a way to read its prompts on demand.
2. Add the id to `AiTool`, `AI_TOOLS` and `TOOL_NAMES` in `types.ts`, and a color in the org page.
3. Call it from `scanSessions` and `buildPrivateDigest` in `parse.ts`.
4. Add a test with a synthetic log built at test time (never a real transcript).
