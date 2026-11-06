# Sign-in: who you are, who pays, who signs

Three things used to look like logins. Each now has one job and lives in one place:

| | What it is for | Where it lives |
|---|---|---|
| **GitHub** | Who you are. Your company is your GitHub org, your team is your GitHub team | Employee: the laptop's GitHub login, no extra sign-in (My week, Setup). Company: Sign in with GitHub (header and the company door) |
| **Sign in with 0G** | Who pays for the private AI: your own 0G account (iAI daily credits or a top-up) | Employee side: header chip, My week, Setup, and every private AI button. Also Roast me on AI Wrapped |
| **The laptop key** | Your signature on the receipt | Step 1 (Sign it) of Sign and send. A wallet works too |

## GitHub: one identity, proven where you are

Code: `web/src/lib/server/session.ts`, `web/src/lib/server/viewer.ts`, `web/src/app/api/auth/*`, `web/src/components/company-identity.tsx`, `web/src/lib/receipts/identity.ts`, `web/src/app/api/join/route.ts`

- **Employees: no extra sign-in.** The app already uses the laptop's GitHub login (`gh auth login` or `GITHUB_TOKEN`) to find pull requests. The same token gives your login (`githubLogin`) and your orgs and teams (`githubTeams`, `/user/orgs` and `/user/teams`), cached for a day in `~/.receipts/identity.json`. In My week, Setup you **join your company**: pick one of your GitHub teams (or "Everyone" in an org without teams). `/api/join` checks that your GitHub login really is in that org and team, then saves it in `~/.receipts/org.json` and `team.json` (the same files the CLI `org` and `team` commands write). Until you join, receipts would go to your first GitHub team, and the page says so.
- **Company side: Sign in with GitHub** (OAuth App, scopes `read:user read:org`, no access to code). `/api/auth/login` sets a short-lived state cookie and redirects to GitHub; `/api/auth/callback` checks the state, swaps the code for a token, reads `/user`, `/user/orgs` and `/user/teams`, keeps only login, name, avatar, orgs and teams in an HMAC-signed cookie (`AUTH_SECRET`, or the client secret) for a week, and drops the token. On the laptop, the laptop's GitHub login counts too, so the person running the app does not have to sign in twice.
- **Who may open the lists** (`isMember` in `viewer.ts`): a member of the org, signed in with GitHub or through the laptop's GitHub login, or anyone in the demo. Opening also needs the company key in that copy. Everyone else sees the signed totals, which are public on Arkiv anyway, and one note at the top of the page says why the lists are closed.
- Callback URL: `<address>/api/auth/callback`, shown on Company, Setup (an OAuth App allows up to 10).
- Orgs with OAuth App access restrictions (the default for new orgs) only show up after an org owner approves the app.

## 0G: every private AI call is paid from your own 0G account

Code: `web/src/components/zero-g.tsx` (the session), `web/src/lib/zerog-balance.ts` (reading the balance), `zero-g-button.tsx`, `ai-actions.tsx`, `zero-g-setup.tsx`, `web/src/lib/zerog-tasks.ts`, `web/src/app/api/week/browser/route.ts`, `api/review`, `api/wrapped/roast`, `browserPlan` / `browserPlanSessions` / `browserSessions` / `browserWeek` / `browserJudgeInfo` in `web/src/lib/receipts/week.ts`

One way to pay, so there is no choice to make: **Sign in with 0G**. Nobody hands out an AI key, and the 0G bonus ("users sign in with their 0G account and spend their own daily credits") is the main flow, not an option.

1. The browser logs in with 0G's Privy app (`NEXT_PUBLIC_PRIVY_APP_ID`, default `cmn5w697g01xp0bl80c8dskc8`, the one pc.0g.ai uses). Privy only allows `http://localhost:3000` for apps like ours, so the server tells the page whether it was opened there (`zeroGAllowed`), and `ZeroGProvider` in the root layout only loads Privy then. Anywhere else, every AI button says where it works instead.
2. It swaps the Privy token for a 0G router session: `POST https://router-api.0g.ai/v1/auth/privy` with `{ token }` returns `{ token, wallet_address }`. The balance comes from `GET /v1/account/balance`, in neuron (10^18 neuron = 1 0G): `total_balance` (deposit plus credits), `credit_balance`, `pending_charge`. `parseBalance` shows what you can spend now, total minus pending, in 0G (an account billed in dollars, `currency: "usd"`, is in micro-dollars instead). The header chip shows your wallet and that number; Setup shows it larger, with credits and pending charges called out, and links to your balance and calls on pc.0g.ai and to your account on 0G ChainScan.
3. Each task asks this laptop's server for the private message (`plan`), calls 0G from the browser with `Authorization: Bearer <0G token>` in private trust mode (same models, same fallback), and sends the answer back (`save`, or `sessions` and `week` for Write my week). Tasks: Write my week, one session again (its page), the private review of a week, and Roast me.
4. After each task the balance is read again and the page says what the call cost ("This cost 0.000312 0G: your 0G balance went from 4.2158 0G to 4.2155 0G."), so you see your own balance go down. 0G sometimes charges a moment later; then it says so.

The server builds every message and keeps the results, so nothing changes about what is stored. It re-checks each answer's TEE signature itself, hashes exactly what was sent (the hash is fixed when the message is built), and records the paying wallet (`payer`). Prompts only travel between the local server, its browser tab and 0G (its router, then the model in a TEE).

The app's own `ZG_API_KEY` is only used by the command line (`npm run receipts -- write`, `judge`), for developers and as a fallback if 0G sign-in is down. No web route spends it.

Privy pulls in optional Solana and Stripe code: installs need `legacy-peer-deps` (`web/.npmrc`) and the kit-5 build of `@solana-program/system`.

## The laptop key

`laptopAccount` in `identity.ts`: made the first time you sign, kept in `~/.receipts/identity.json` (mode 0600), never leaves the laptop. `RECEIPTS_SIGNER_KEY` overrides it; "Use a wallet instead" signs the same EIP-712 receipt with a browser wallet. In the demo, the engineer signs with a fixed demo key.
