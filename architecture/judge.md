# Judge

Code: `web/src/lib/receipts/heuristics.ts`, `judge.ts`, `review.ts`

Every session gets a label (Shipped, Learned, Looped, Abandoned, Overkill, or Open for work still in flight), a difficulty from 1 to 5, a kind (feature, fix, refactor...) and a short generic reason.

## Offline rules (always run)

- **Shipped:** linked to a merged change that was not reverted.
- **Looped:** loop score 3 or more (error streaks, repeated commands, edits to one file, error rate, interruptions, API errors).
- **Abandoned:** edited code, a known repo, older than 3 days, and nothing shipped; or the linked PR was closed or reverted.
- **Open (`Pending` in code):** open PR, fresh edits, or no GitHub repo found. Never counted as waste.
- **Learned:** no code edits.
- **Overkill:** shipped small work (session difficulty 1 or 2) for more than `max($15, 4 x typical small task)`. The typical cost is the median of small shipped sessions when there are 5 or more, else $5.

**Difficulty** of a session comes from its own edits (lines and files), or its active minutes when it edited nothing. Task difficulty comes from the PR size, unless an AI judge rated it.

## Private AI judge (0G)

`judgeSessions` sends one message per session to the 0G router (`https://router-api.0g.ai/v1`, OpenAI-compatible):

- Header `X-0G-Provider-Trust-Mode: private`: only providers whose model runs inside a TEE. Model `0gm-1.0-35b-a3b`, the only TEE chat model on the router.
- Body `verify_tee: true`: the router checks the TEE signature.
- `selfVerifyTee` re-checks the signature with the 0G SDK (`processResponse`) against the signer registered on 0G mainnet, without trusting the router.
- 503 `no_provider_for_trust_mode` is retried twice.

The message contains trimmed prompts, a tool-use summary, the GitHub outcome, the cost, and the rule-based guess. The session page shows exactly this message before anything is sent.

We keep the verdict, the 0G request id, chat id, provider, sealed flag, verification results, and keccak hashes of what was sent and returned. Prompts are never stored.

A rescan keeps earlier AI verdicts for sessions whose activity and GitHub outcome did not change.

`openai-compatible` (for example Ollama) uses the same path without the 0G headers.

## Weekly review

`review.ts` sends one line per session of a week (label, cost, signals, outcome, first ask trimmed to 160 characters) and gets back a two-sentence summary and three tips. Saved in `~/.receipts/reviews`.
