# Submission kit

Deadline: **Sat Nov 7, 9:00 AM IST** (submissions close, late ones are rejected). Judging starts 9:30 AM.

## Morning checklist

In order. Items marked (you) need a sign-up, a captcha or a decision, so the overnight build left them for you.

1. **Run it** (5 min): `cd web && npm install && npm run receipts -- scan && npm run dev`, open http://localhost:3000. Flip "My logs" and "Demo team" in the top right.
2. **0G key (you)**: get an API key at https://pc.0g.ai (Dashboard, API Keys) and ask at the 0G booth for the hackathon compute credits. Put it in `web/.env.local` as `ZG_API_KEY=...`, restart `npm run dev`, then click "Ask the private judge" and "Get a private review" on the home page. Check `/sessions/<id>` shows a request id. If the router answers `503 no_provider_for_trust_mode`, the TEE model is busy: retry, or set `ZG_TRUST_MODE=verified` for the demo and say so.
3. **Arkiv (you)**: create a throwaway wallet, claim tGLM at https://hub.arkiv.network/faucet (wallet, sign-in, email, captcha), optionally get an access key at https://hub.arkiv.network/access-keys. Put `ARKIV_PRIVATE_KEY` (and `ARKIV_ACCESS_KEY`) in `web/.env.local`. Then:
   - `npm run receipts -- publish-demo` (writes the demo team's 20 signed receipts)
   - `npm run receipts -- arkiv acme-payments` (reads them back)
   - Open `/team` in demo mode: rows now say "on Arkiv".
   - Put the writer address (`npm run receipts -- doctor` shows whether the key is set; the publish command prints the address) into the README under "Arkiv".
4. **Your own receipt**: in "My logs", go to a week with shipped work, click "Sign with wallet" (or set `RECEIPTS_SIGNER_KEY`), then "Share totals with team". Set your team id first: `npm run receipts -- team payman "Payman"`.
5. **Repo (you)**: create a public GitHub repo and push. Check `git log` first; nothing under `~/.receipts` or any `.jsonl` can be committed (a pre-commit hook blocks them), but read the diff anyway.
6. **Live demo link (you, optional but 0G asks for one)**: deploy `web/` to Vercel in demo mode. Set `RECEIPTS_DATA_DIR=/tmp/receipts`. Scanning will not work there (no logs on a server), the demo team, signing with a wallet, verify and team pages will.
7. **Video (you)**: 2:00 to 2:59, at least 720p, your own voice (no AI voiceover, no speed-up). Script below.
8. **Submit** on the ETHGlobal dashboard. Pick the three partners: **0G, Arkiv, Ethereum Foundation**. Text below.
9. **AI usage**: keep `docs/AI_USAGE.md` honest and add what you changed yourself today. ETHGlobal requires it, and a project that looks fully AI-built can lose partner eligibility, so make real changes of your own during the day (see "Ideas you could build today" below) and commit them.

## Video script (about 2:45)

1. **Hook (0:00 to 0:15).** "Companies rank engineers by tokens burned. That gets gamed, and it says nothing about what the money bought. This is Receipts." Show the home page receipt printing.
2. **The receipt (0:15 to 0:45).** Read the headline: "$X bought N shipped tasks, Y% still alive". Point at the itemized lines (Shipped, Learned, Looped, Abandoned, Overkill), waste, and the stamp. "Every number comes from my own Claude Code logs and GitHub."
3. **What it bought (0:45 to 1:10).** Scroll to the PR list with survival bars. Open one session page: cost check against Claude Code's own tracker, how it was linked (PR link, commit, branch), blame-based survival.
4. **Private judge, 0G (1:10 to 1:40).** Click "Ask the private judge". "Prompts never go to a normal AI API. They go to 0G Private Computer in private mode: only a model inside a TEE can read them, sealed end to end." Show the request id and "TEE signature verified". Click "Get a private review" and show the tips.
5. **Sign and share, Arkiv (1:40 to 2:10).** Click "Sign with wallet", then "Share totals with team". Switch to the Team page: totals, who shared, who did not, every receipt re-verified from Arkiv. Show the query.
6. **Verify (2:10 to 2:30).** Download the receipt JSON, paste it in Verify: all checks pass. Change one number: the signature check fails.
7. **Close (2:30 to 2:50).** "No server of ours, MIT licensed, prompts stay on your laptop. Receipts, not leaderboards."

## Submission text

**Project name:** Receipts

**Short description (one line):** See what your AI coding spend actually bought: signed weekly receipts from your own Claude Code logs, judged privately on 0G and shared on Arkiv.

**Description:**
Companies hand out big AI budgets and rank people by tokens burned. Those leaderboards get gamed, and tokens are a small part of what a pull request costs. Receipts reads Claude Code's local logs, prices every call, links each session to the pull requests it produced, and checks on GitHub what merged, what got reverted, and how much code is still alive 30 days later. A private AI judge on 0G labels each session (Shipped, Learned, Looped, Abandoned, Overkill) and rates difficulty, so cost is only compared across similar tasks. Every week you get a receipt like "$2,140 bought 14 shipped tasks, 91% still alive" that you sign with your own key. It is your evidence at review time. Managers only see team totals and the receipts people choose to share on Arkiv, never prompts.

**How it's made:**
Next.js 16 and TypeScript with shadcn/ui, all running locally. A streaming parser reads `~/.claude/projects` (including subagent transcripts), dedupes the repeated usage lines Claude Code writes per response, prices tokens at list prices including cache tiers and fast mode, and matches Claude Code's own cost tracker within 2% on real logs. Matching uses the PR links and git operations Claude Code records, branches, and file overlap. Survival uses GitHub GraphQL blame on the base branch. The judge calls the 0G router in private trust mode (TEE-only model `0gm-1.0-35b-a3b`, sealed inference), asks it to verify the TEE signature, and re-checks the signature itself with the 0G SDK. Receipts are EIP-712 typed data with two Merkle roots (task evidence and judge records), so an owner can reveal one task without the rest, and any edit breaks the signature. Shared receipts are Arkiv entities with indexed attributes; the team view queries Arkiv and re-verifies every signature, ignoring anything unsigned.

**0G (Build with 0G Private Computer):**
The judge is the product's core and it must read prompts. We never send them to a normal AI API: every judge call and the weekly review go through the 0G router with `X-0G-Provider-Trust-Mode: private`, and each result keeps its request id, provider, sealed flag and TEE verification, which go into the signed receipt. What breaks without 0G: the AI judge itself; every session would fall back to rules that cannot tell learning from a dead end. Code: `web/src/lib/receipts/judge.ts`, `review.ts`.

**Arkiv (Build on Arkiv):**
Shared receipts live on Arkiv (Rabdi testnet) as entities with indexed team, week, signer and numbers, plus the signed JSON as payload, expiring after 120 days. The Team page and Verify page read them back from Arkiv and re-check signatures. See `/arkiv` for schema, usage, why Arkiv, reach and friction notes.

**Ethereum Foundation (Best CROPS App):**
Lead property: Private. Raw logs and prompts never leave the laptop; there is no Receipts server; receipts are signed with the user's key and verifiable by anyone; the client has no trackers. The README has a CROPS section with what each third party learns and our trust assumptions.

## Ideas you could build today

Good, contained pieces of real work for you during the hackathon:

- **Chainlink CRE monthly job** (only if you swap it in for one of the three partners): a cron workflow that reads the team's shared receipts from `/api/team`, re-checks each evidence PR on GitHub (still merged, not reverted), and writes a verified monthly team score on-chain. CRE supports Arc testnet (`arc-testnet`) and Sepolia. Needs `cre login` (free account). Notes in `docs/NEXT_STEPS.md`.
- **Claude Code OpenTelemetry input**: a small OTLP/HTTP endpoint so a company can collect totals without touching laptops.
- **Encrypted team payloads** on Arkiv (only team members can read evidence).
- **Better matching** for deleted worktrees: read `git worktree add` commands from Bash calls.
