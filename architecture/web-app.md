# Web app, API and CLI

Next.js 16 (App Router, Turbopack), React 19, shadcn/ui on Base UI, Tailwind 4. Fonts: Schibsted Grotesk for the UI, Fragment Mono only on receipt paper and the Wrapped card. Everything renders on the server from local files; client components only handle buttons, the send flow, the sidebar, AI Wrapped's share buttons and Sign in with 0G.

## Who it is for: separate parts, one each

The app is split by who is using it, so nobody sees another role's pages, sign-ins or fallbacks. Each part has its own route folder, layout, header (a coloured label and its own identity on the right) and footer line. The company and employee parts list their pages in a sidebar (`components/sidebar-nav.tsx`, a scrolling row on phones) inside `SpaceShell` (`components/space-header.tsx`); For fun is one page, so it has no menu.

| Part | Routes | Who | Identity | Runs |
|---|---|---|---|---|
| Front door and public pages | `app/(public)`: `/`, `/demo`, `/r/[key]`, `/verify`, `/how`, `/proof/0g/[provider]`, `/proof/swarm/[ref]` | anyone | none | anywhere |
| My week (the employee) | `app/me`: `/me`, `/me/send`, `/me/sessions`, `/me/setup` | an employee | the laptop's GitHub login (GitHub CLI or `GITHUB_TOKEN`); Sign in with 0G pays the AI | the laptop |
| Company | `app/company`: `/company`, `/company/team`, `/company/people`, `/company/prs`, `/company/setup` | leads and managers | Sign in with GitHub (or the laptop's GitHub login) | anywhere |
| For fun (side product) | `app/(personal)`: `/wrapped` | anyone | none (Sign in with 0G only for Roast me) | anywhere; Wrapped from Claude Code or Codex logs needs the laptop, a ChatGPT or Claude.ai export works anywhere |

The main product is the company side and the employee side, joined by the signed receipt. AI Wrapped is a separate side product, one page: a picture of how you talk to AI, for socials (not signed, never stored, never sent to a company). A receipt is evidence for the company (signed, nobody can edit it), so it never appears on the For fun side.

## UI rules

- Each part leads with one question and one next step. The employee's week shows three steps (`components/flow-steps.tsx`, logic in `lib/receipts/flow.ts`): write, sign, send; the current one is ringed and the button under the sentence is always that step. There is no review step: the employee cannot pick lines out or edit them, so the company gets the whole week.
- Sign-ins live in exactly one place each: GitHub on the company side (header and door), Sign in with 0G on the employee side (header chip, setup, and every AI button), the laptop key in the Sign step.
- Fallbacks belong to the side that owns them: no logs shows "Read my logs" (never someone else's data); a company with no wallet or key shows up in Company, Setup, and the employee just sees "your company has not turned on receipts yet"; Sign in with 0G off localhost:3000 says where it works.
- **Check it yourself.** Wherever the app says something happened on 0G, Arkiv or Swarm, a `ProofLinks` box (`components/proof-links.tsx`, every URL built in `lib/proof-urls.ts`) links to a place outside the app's own claims: the Arkiv explorer (the record, its transaction, the owner), `/proof/swarm/<ref>` (fetches the ciphertext from the Swarm gateway right then), `/proof/0g/<provider>` (0G's TEE verdicts for the provider, read live from the router), 0G ChainScan and pc.0g.ai.
- Secondary detail (PRs, how it was written, money leaks, cost by difficulty, category meanings) sits in a `Collapsible` with a one-line hint.
- Nothing runs in the background. The AI only runs on a click; logs are only read on "Read my logs" or "Refresh from my logs".
- Category colours are tokens (`--c-built`, `--c-fixed`, ...) in `globals.css`, with dark variants; `CategoryBadge` and `CategoryBar` use them. Each part's label reuses one: Company `--c-researched`, My week `--c-built`, For fun `--c-wrote`.
- Phones show the list before the receipt paper, and the sidebar becomes a row of links under the header.

## Data source and the demo

Your own data (`~/.receipts`) unless you picked the demo company on `/demo`, which sets a cookie (`currentSource` in `web/src/lib/server/data.ts`). There is no silent fallback to the demo: without logs, My week asks you to read them. A hosted copy (Vercel) has no logs, so it opens on the demo until someone leaves it. While in the demo, a thin banner (`components/demo.tsx`) says who you are (Acme's lead, an engineer on Payments, someone with a public link, or just for fun), links to the other roles, and has Leave the demo. `/demo/link` opens one of the demo engineer's sealed weeks from Arkiv, as anyone with the link sees it.

Other helpers in `data.ts`: `weekView` (loads the saved week story), `periodView`, `shareTarget` (where receipts go: the company you joined, else your first GitHub team), `onLaptop`, `zeroGAllowed`. Employee helpers are in `lib/server/employee.ts`, the company viewer in `lib/server/viewer.ts`.

## Pages

| Route | What it shows |
|---|---|
| `/` | Front door: the company side and the employee side (each with its steps), what it runs on and where to check it (0G, Arkiv, Swarm), then For fun, the demo and Check a receipt |
| `/demo` | Pick a role at the demo company |
| `/me` | This week: who you are and where your receipts go, the three steps, the question and the AI's sentence, Write my week (Sign in with 0G) and Sign and send; Check it yourself (the 0G provider's TEE check, the sent record on Arkiv, the Swarm copy); the list (each item with its own timeline); "How the week went"; collapsed PRs, how it was written (0G request ids, who paid), money leaks with a private review, cost by difficulty; the receipt paper and your past receipts (sent or not) |
| `/me/send` | The whole receipt next to two steps: Sign (laptop key or wallet), Send (to your team and company). Then links to the company's view, the public link, the record and its transaction on the Arkiv explorer, and the Swarm copy; and a short list of what goes where (the company, anyone, the laptop) |
| `/me/setup` | Set up once: connect GitHub, join your company (your GitHub orgs and teams), Sign in with 0G (then the balance you can spend, in 0G, with links to pc.0g.ai and 0G ChainScan), read your logs |
| `/me/sessions`, `/me/sessions/[id]` | All sessions; one session's cost, signals, linked changes, private AI record (with links to the provider's TEE check, ChainScan and pc.0g.ai) and the exact message the private AI is sent |
| `/company` | What the company got done this week, how it worked, teams side by side, week by week, spend by AI tool (see [org-view.md](org-view.md)) |
| `/company/team`, `/company/people`, `/company/prs` | One team; everyone's signed week (`?who=<address>` opens one person), each with Check it links (Arkiv record, Swarm copy, 0G TEE check, what anyone sees); every pull request |
| `/company/setup` | For whoever runs it: GitHub org, GitHub sign-in, the wallet that pays for records and its balance (and every record it wrote, on the Arkiv explorer), the company key, Swarm, and what to give employees |
| `/r/[key]` | One shared receipt loaded from Arkiv and checked: signed totals; the list stays sealed; links to the record and its writer on the Arkiv explorer and to the Swarm copy |
| `/proof/0g/[provider]` | The 0G provider that ran the private AI: 0G's TEE verdicts for it, read live from `router-api.0g.ai/v1/providers/<address>/identity`, with links to the raw verdicts, ChainScan and pc.0g.ai |
| `/proof/swarm/[ref]` | An encrypted week fetched from the Swarm gateway right now: size, SHA-256 and the first bytes (the gateway's own `/bytes/` link downloads a file instead). With `?entity=<key>`, a company member also sees it checked against the SHA-256 and size sealed in the Arkiv record |
| `/verify` | Paste a receipt JSON or an Arkiv key and run the checks |
| `/how` | Both sides step by step, one identity and one way to pay, what leaves the laptop |
| `/wrapped` | My AI Wrapped: how you talk to AI, then Share it (Share, Post on X, Download the card, Copy the text) |

Old addresses (`/org`, `/team`, `/sessions`, `/share`, `/card`, `/wall`) redirect to the new ones (`next.config.ts`).

## API routes (`web/src/app/api`)

`source` (demo on or off), `scan`, `join` (save the company and team you joined), `week/browser` (the private AI, paid from your own 0G account: `plan`, `plan-sessions`, `sessions`, `week`), `review` (`plan`, `save`), `wrapped/roast` (`plan`, `save`), `card/wrapped` (the Wrapped PNG), `receipt` (GET build or saved, POST save a wallet-signed receipt), `receipt/sign-local`, `share` (send the whole week to the company), `verify`, `team`, `auth/login`, `auth/callback`, `auth/logout`. No route spends the app's own 0G key: the browser pays every private AI call with Sign in with 0G (see [sign-in.md](sign-in.md)).

## Wrapped card (`/api/card/wrapped`)

`next/og` `ImageResponse`, 1080x1350, fonts read from `web/assets/fonts` (OFL), numbers only (checked with `wrapped-schema.ts`). Satori needs `display: flex` on every element with more than one child. X cannot take an image through a link, so Post on X downloads the PNG and opens the composer with the text; where the browser can share files (phones), Share hands over the image itself. See [wrapped.md](wrapped.md).

## Security

- `next dev` and `next start` bind to 127.0.0.1.
- `src/proxy.ts` only answers requests whose Host is localhost (blocks DNS rebinding); `RECEIPTS_ALLOWED_HOSTS` or a Vercel deploy can widen it.
- `src/lib/server/guard.ts`: every POST rejects cross-site requests (`Sec-Fetch-Site`, `Origin`) and non-JSON bodies, so other websites cannot make the local server sign, publish or spend.
- Sessions are HMAC-signed cookies with no tokens inside.

## CLI (`web/scripts/receipts.ts`)

`scan`, `judge`, `week` (print a week's list), `write` (have the private AI write a week; `--demo` for the demo), `sign`, `team`, `org`, `share`, `demo`, `publish-demo` (`--week`, `--who`, `--from`, `--limit`; sealed on Swarm when it is set up), `arkiv`, `entity <key>` (read one shared week as the company and as the public), `doctor` (keys, company wallet and its tGLM balance). Run with `npm run receipts -- <command>`. Loads `web/.env.local` itself.

## Tests

`npm test` (node:test via tsx): pricing against a real Claude Code cost record, OpenAI pricing, the Claude and Codex readers on synthetic logs built at test time, rules, forgiving parsing of AI answers and safe titles, the week list (grouping, skipped sessions, waste last), receipt signing, tampering, and revealing only some items with proofs (older receipts), sending the whole week sealed on Swarm (it opens with the company key and still verifies), the employee's weekly steps (`test/flow.test.ts`), the 0G balance in 0G (`test/zerog-balance.test.ts`), and AI Wrapped (`test/wrapped.test.ts`).
