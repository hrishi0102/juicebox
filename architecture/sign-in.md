# Sign-in: GitHub and 0G

## GitHub: one login, company = org, team = team

Code: `web/src/lib/server/session.ts`, `web/src/app/api/auth/*`, `web/src/components/auth-menu.tsx`, `web/src/lib/receipts/identity.ts`

- **On the laptop no extra login is needed.** The app already uses your GitHub token (from `gh auth login` or `GITHUB_TOKEN`) to find PRs. The same token gives your login (`githubLogin`), and your orgs and teams (`githubTeams`, `/user/orgs` and `/user/teams`), cached for a day in `~/.receipts/identity.json`. "Share with my company" goes to your first GitHub team, unless CLI settings say otherwise.
- **For the company view, "Sign in with GitHub"** (OAuth App, scopes `read:user read:org`, no access to code). `/api/auth/login` sets a short-lived state cookie and redirects to GitHub; `/api/auth/callback` checks the state, swaps the code for a token, reads `/user`, `/user/orgs` and `/user/teams`, keeps only login, name, avatar, orgs and teams in an HMAC-signed cookie (`AUTH_SECRET`, or the client secret) for a week, and drops the token. Hidden until `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` are set.
- Callback URL: `http://localhost:3000/api/auth/callback` (add the hosted one too; an OAuth App allows up to 10).
- Orgs with OAuth App access restrictions (the default for new orgs) only show up after an org owner approves the app.

## 0G: pay with your own credits

Code: `web/src/components/zero-g-pay.tsx`, `web/src/app/api/week/browser/route.ts`, `browserPlan` / `browserSessions` / `browserWeek` in `web/src/lib/receipts/week.ts`

"Sign in with 0G" lets a person pay for the private AI from their own 0G account (iAI or credits) instead of the app's `ZG_API_KEY`.

1. The browser logs in with 0G's Privy app (`NEXT_PUBLIC_PRIVY_APP_ID`, default `cmn5w697g01xp0bl80c8dskc8`, the one pc.0g.ai uses). Privy only allows `http://localhost:3000` for apps like ours, so the button only shows there.
2. It swaps the Privy token for a 0G router session: `POST https://router-api.0g.ai/v1/auth/privy` with `{ token }` returns `{ token, wallet_address }`. The balance comes from `GET /v1/account/balance`.
3. "Write it with my 0G credits" asks this laptop's server for the private messages (`plan`), calls 0G from the browser with `Authorization: Bearer <0G token>` in private trust mode (same models, same fallback), sends the answers back (`sessions`), then does the same for the weekly call (`week`).

The server builds every message and keeps the results, so nothing changes about what is stored. It re-checks each answer's TEE signature itself, hashes exactly what was sent (the hash is fixed when the message is built), and records the paying wallet (`payer`). Prompts only travel between the local server, its browser tab and 0G (its router, then the model in a TEE).

Privy pulls in optional Solana and Stripe code: installs need `legacy-peer-deps` (`web/.npmrc`) and the kit-5 build of `@solana-program/system`.
