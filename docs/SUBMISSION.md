# Submission kit

Deadline: **Sat Nov 7, 9:00 AM IST** (submissions close, late ones are rejected). Judging starts 9:30 AM.

## What is done and what is left

Done and tested: reading Claude Code and Codex logs, linking PRs, the private AI on 0G writing your week (live, TEE verified), the new home page, the share card (download, copy, X, PDF), receipt v2 signed with a laptop key, the company and team pages, GitHub identity from your token, and a production build.

Built but needs you (each needs your account, a captcha or a key):

1. **Sign in with 0G** (5 min): open http://localhost:3000 in your own browser, click "Sign in with 0G", log in with the account that has your 0G credits, then "Write it with my 0G credits". If `/v1/auth/privy` refuses, sign in once on pc.0g.ai and try again. Ask 0G to confirm the Privy app ID `cmn5w697g01xp0bl80c8dskc8`.
2. **Arkiv and Swarm: done.** Your keys are in and the demo company is live: 77 shared weeks on Arkiv (week 45 for all 12 people sealed on Swarm) and 12 public cards on the wall. Swarm uses the free testnet gateway (see `arkiv/swarm.md`). Still yours:
   - Decide whether to share your own week (it publishes your signed totals publicly under your GitHub org; the list itself is encrypted on Swarm for the company).
   - Optional: your own Swarm batch (Bee light node on testnet, Sepolia ETH from ethglobal.com/faucet, sBZZ via Uniswap), then set `SWARM_API_URL` and `SWARM_POSTAGE_BATCH_ID` and update the batch section of `arkiv/swarm.md`.
   - Swarm: the Swarm team confirmed the testnet is fine, so the free testnet gateway stays. Running your own testnet node is optional; it would only add your own batch ID to `arkiv/swarm.md`.
3. **GitHub sign-in** (optional, 5 min): github.com/settings/developers, New OAuth App, homepage `http://localhost:3000`, callback `http://localhost:3000/api/auth/callback`. Put `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` in `web/.env.local`. A "Sign in" button appears in the header. If your org restricts OAuth apps, approve it as an owner, or use a personal test org.
4. **Live demo link** (optional, 0G asks for one): deploy `web/` to Vercel (root directory `web`). It runs in demo mode. Add `ZG_API_KEY` only for judging (anyone can spend it with "Write it again") and remove it after. Sign in with 0G does not work there (0G only allows localhost:3000).
5. **Video** (you): 2:00 to 2:59, at least 720p, your own voice, no speed-up. Script below.
6. **Submit** on the ETHGlobal dashboard. Partners: **0G, Arkiv, Ethereum Foundation**. For Arkiv, pick **Build on Arkiv** and also tick the **Arkiv + Swarm bonus** (it does not use another pick). After recording, put the Swarm timestamp in `arkiv/swarm.md` (it is a required field). Text below.
7. **AI usage**: keep `docs/AI_USAGE.md` honest and add what you changed yourself.

## Video script (about 2:45)

1. **Hook (0:00 to 0:15).** "AI tools make it easy to spend a lot and hard to say what came out of it. Token leaderboards reward burning tokens. So: what did you get done this week?" Show the home page.
2. **The answer (0:15 to 0:50).** Click "Write my week". "Each session goes to a private AI on 0G that runs inside a hardware enclave. It reads what I asked and what the AI answered, and writes one line." Show the list: Built, Researched, Planned, with sessions, PRs and cost. Read the AI's sentence.
3. **Privacy, 0G (0:50 to 1:20).** Open "How this was written": 10 private AI calls, TEE verified, request ids. Open one session: "this is exactly what was sent; it goes only to 0G, the model runs in a TEE, and we check its signature ourselves." Mention Sign in with 0G: each person can pay from their own 0G credits.
4. **Share it for fun (1:20 to 1:45).** Click "Share it". Untick one line, edit a title, show the card update. Cost is hidden by default. Post on X.
5. **Share it with your company, Arkiv and Swarm (1:45 to 2:25).** Back on the home page: Sign (no wallet: a key made on the laptop), Share with my company. "My list goes to Swarm, encrypted on my laptop. Arkiv gets a read-only record with the signed totals and a key only my company can open, and it belongs to me." Open the company page: everyone's week, "Opened from Swarm with the company key". Open one week's public link: the totals check out, the list is private. Then the wall: public cards on Swarm, listed on Arkiv. (Note this timestamp for `arkiv/swarm.md`.)
6. **Verify (2:20 to 2:40).** Download the receipt, paste it in Verify: all checks pass. Change one title: it fails.
7. **Close (2:40 to 2:55).** "No server of ours, prompts stay on your laptop, MIT licensed. What did you get done this week?"

Tip: record with the Demo company for the company page, and with your own data for the home page if you are happy to show it (titles are written to avoid secrets, but check them first).

## Submission text

**Project name:** Receipts

**Short description (one line):** What did you get done this week? A private AI on 0G reads your Claude Code and Codex sessions and writes the answer; share it as a card, or signed with your company on Arkiv.

**Description:**
AI tools make it easy to spend a lot and hard to say what came out of it, and token leaderboards reward burning tokens, not getting things done. Receipts reads your Claude Code and Codex logs on your laptop, links sessions to the pull requests they produced, and, when you click Write my week, has a private AI on the 0G Private Computer, running inside a hardware enclave (TEE), read each session and write one line: Built, Fixed, Figured out, Researched, Wrote, Planned or Wasted, with a short title. A second call merges those lines into your week and one sentence about it. You can post it as a card (cost hidden by default), or sign it with a key made on your laptop and share it with your company. Your company, which is just your GitHub org, sees everyone's signed list, the PRs behind it and the totals by category and AI tool. Never prompts.

**How it's made:**
Next.js 16 and TypeScript with shadcn/ui, running locally. Streaming readers for Claude Code (with subagents) and Codex logs price every call and match Claude Code's own cost tracker within 2%. Sessions are linked to PRs through the PR links and git operations in the logs, branches and file overlap. The private AI calls the 0G router in private trust mode (TEE-only), model `0gm-1.0-35b-a3b-sia` with thinking off (about 2 seconds and $0.001 a call), falling back to `glm-5.3`; the router verifies each TEE signature and we re-check it with the 0G SDK. The weekly call sees only the titles, never prompts. Sign in with 0G uses 0G's Privy app and the router's `/v1/auth/privy` session, so each person can pay from their own credits while the laptop's server keeps building every message. The share card is drawn with `next/og`. Receipts are EIP-712 typed data with three Merkle roots (the items, the PRs and the 0G calls), so an owner can hide one item with proofs while the signed totals stay intact, and any edit breaks the signature. Sharing is one Arkiv transaction that creates a read-only entity and hands its ownership to the signer; the company and team pages query Arkiv by org and re-verify every signature.

**0G (Build with 0G Private Computer):**
The private AI is the product's core and must read prompts and the AI's answers to say what you got. Every call goes through the 0G router with `X-0G-Provider-Trust-Mode: private` and `verify_tee`, and we re-check the TEE signature ourselves. Each result keeps its request id, provider, TEE checks, cost and hashes of what was sent and answered, which go into the signed receipt. Sign in with 0G lets each person pay from their own 0G credits. What breaks without 0G: the AI that writes the list; we refuse to send prompts to an ordinary API, so it falls back to rules. Code: `web/src/lib/receipts/judge-core.ts`, `judge.ts`, `week.ts`, `web/src/components/zero-g-pay.tsx`.

**Arkiv (Build on Arkiv + Swarm bonus):**
Shared weeks are Arkiv entities (schema `receipts-ethglobal-mumbai.receipt.v2`, Rabdi testnet) with indexed org, team, week, signer, GitHub login and numbers. One `executeBatch` creates each entity read-only and hands ownership to the signer, so the company pays gas but the employee owns an uneditable record. With Swarm, the full week is encrypted on the laptop and stored on Swarm; the Arkiv record keeps only the signed totals, the Swarm reference, and the key sealed to the company, so everyone can verify the numbers while only the company can open the list. Public cards are stored on Swarm and listed on Arkiv (`card.v1`), shown on the wall. The company and team pages read Arkiv directly and re-check signatures. See `/arkiv` for schema, usage, why Arkiv, reach, friction, and `arkiv/swarm.md` for the Swarm details.

**Ethereum Foundation (Best CROPS App):**
Lead property: Private. Raw logs never leave the laptop; only a trimmed digest of each session goes to 0G's private computer (model in a TEE), and only when you ask; there is no Receipts server; weeks are signed with a key that stays on the laptop and stored on Arkiv as records the person owns; the share card is drawn locally; no trackers. The README has a CROPS section with what each third party learns and our trust assumptions.
