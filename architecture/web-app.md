# Web app, API and CLI

Next.js 16 (App Router, Turbopack), React 19, shadcn/ui on Base UI, Tailwind 4. Fonts: Schibsted Grotesk for the UI, Fragment Mono only on receipt paper. Everything renders on the server from local files; client components only handle buttons.

## Data source

A cookie picks **My logs** (`~/.receipts/dataset.json`) or **Demo team** (`web/fixtures/demo`). Without a local dataset the app falls back to the demo. Helpers in `web/src/lib/server/data.ts` (`currentSource`, `weekView`, `periodView`).

## Pages

| Route | What it shows |
|---|---|
| `/` | Weekly receipt (thermal paper), headline, what it bought, where it leaked, private review, cost per kept task by difficulty, sign and share buttons, 0G request ids |
| `/sessions` | All sessions with label, difficulty, linked work, judge, cost; filter by label |
| `/sessions/[id]` | Cost breakdown, signals, linked changes, judge record, the exact message the private judge would get |
| `/team?team=<id>` | One team: totals from signed fields, who shared, each shared receipt; team switcher |
| `/org` | Company view: totals, spend by AI tool, by team, week by week (see [org-view.md](org-view.md)) |
| `/r/[key]` | One shared receipt loaded from Arkiv and checked |
| `/verify` | Paste a receipt JSON or an Arkiv key and run the checks |
| `/how` | How it works and what leaves the laptop |

## API routes (`web/src/app/api`)

`source`, `scan`, `judge`, `review`, `receipt` (GET build or saved, POST save a wallet-signed receipt), `receipt/sign-local`, `share`, `verify`, `team` (GET, read from Arkiv).

## Security

- `next dev` and `next start` bind to 127.0.0.1.
- `src/proxy.ts` only answers requests whose Host is localhost (blocks DNS rebinding); `RECEIPTS_ALLOWED_HOSTS` or a Vercel deploy can widen it.
- `src/lib/server/guard.ts`: every POST rejects cross-site requests (`Sec-Fetch-Site`, `Origin`) and non-JSON bodies, so other websites cannot make the local server sign or publish.

## CLI (`web/scripts/receipts.ts`)

`scan`, `judge`, `week`, `sign`, `team`, `org`, `share`, `demo`, `publish-demo`, `arkiv`, `doctor`. Run with `npm run receipts -- <command>`. Loads `web/.env.local` itself.

## Tests

`npm test` (node:test via tsx): pricing against a real Claude Code cost record, OpenAI pricing, the Claude and Codex readers on synthetic logs built at test time, judge rules, signing, tampering and Merkle proofs.
