# Web app, API and CLI

Next.js 16 (App Router, Turbopack), React 19, shadcn/ui on Base UI, Tailwind 4. Fonts: Schibsted Grotesk for the UI, Fragment Mono only on receipt paper and the share card. Everything renders on the server from local files; client components only handle buttons, the share studio and the 0G sign-in.

## UI rules

- Nav: My week, My sessions, Team, Company. How it works, Check a receipt and sign-in live in the header and footer.
- The home page asks the question and answers it: "What did you get done this week?", the AI's sentence, then the list. Secondary detail (PRs, how it was written, money leaks, cost by difficulty, category meanings) sits in a `Collapsible` with a one-line hint.
- Nothing runs in the background. The AI only runs on "Write my week"; logs are only read on "Refresh from my logs".
- Category colours are tokens (`--c-built`, `--c-fixed`, ...) in `globals.css`, with dark variants; `CategoryBadge` and `CategoryBar` use them.
- Phones show the list before the receipt paper. Printing shows only the share card.

## Data source

A cookie picks **My logs** (`~/.receipts/dataset.json`) or **Demo** (`web/fixtures/demo`). Without a local dataset the app falls back to the demo. Helpers in `web/src/lib/server/data.ts` (`currentSource`, `weekView` loads the saved week story, `periodView`, `shareTarget`).

## Pages

| Route | What it shows |
|---|---|
| `/` (My week) | The question, the AI's sentence, Write my week / Share it, Sign in with 0G; the list; the receipt paper with Sign and Share with my company; collapsed PRs, how it was written (0G request ids), money leaks, cost by difficulty |
| `/share` | Share studio: tick and edit items, name, sentence and cost toggles; live card; Post on X, Download, Copy image, Copy text, Save as PDF |
| `/sessions` | All sessions with category, AI title (and the session's own title), difficulty, linked work, who wrote it, cost; filter by category |
| `/sessions/[id]` | Cost breakdown, signals, linked changes, the private AI record (who paid, cost), the exact message the private AI is sent |
| `/org` | Company view: what the company got done, everyone's signed week, teams, PRs, tools, weeks (see [org-view.md](org-view.md)) |
| `/team?team=<id>` | One team: headline, everyone's week |
| `/r/[key]` | One shared receipt loaded from Arkiv and checked, with its list and PRs |
| `/wall` | Everyone's public cards: Arkiv card entities, images straight from Swarm |
| `/verify` | Paste a receipt JSON or an Arkiv key and run the checks |
| `/how` | How it works and what leaves the laptop |

## API routes (`web/src/app/api`)

`source`, `scan`, `week` (write a week with the app key), `week/browser` (the three steps for paying with your own 0G account), `card` (PNG), `card/swarm` (put the card on Swarm and list it on Arkiv), `judge`, `review`, `receipt` (GET build or saved, POST save a wallet-signed receipt), `receipt/sign-local`, `share`, `verify`, `team`, `auth/login`, `auth/callback`, `auth/logout`.

## Share card (`/api/card`)

`next/og` `ImageResponse`, 1080x1350, fonts read from `web/assets/fonts` (OFL). Input is validated with zod (`CardInput` in `card.ts`): week, range, optional name and sentence, up to 12 items (cost only if the person turns it on), sessions, tools, who wrote it. Satori needs `display: flex` on every element with more than one child. `cardPostText` makes the X text; X cannot take an image through a link, so Post on X downloads the PNG and opens the composer.

## Security

- `next dev` and `next start` bind to 127.0.0.1.
- `src/proxy.ts` only answers requests whose Host is localhost (blocks DNS rebinding); `RECEIPTS_ALLOWED_HOSTS` or a Vercel deploy can widen it.
- `src/lib/server/guard.ts`: every POST rejects cross-site requests (`Sec-Fetch-Site`, `Origin`) and non-JSON bodies, so other websites cannot make the local server sign, publish or spend.
- Sessions are HMAC-signed cookies with no tokens inside.

## CLI (`web/scripts/receipts.ts`)

`scan`, `judge`, `week` (print a week's list), `write` (have the private AI write a week; `--demo` for the demo), `sign`, `team`, `org`, `share`, `demo`, `publish-demo` (`--week`, `--who`, `--from`, `--limit`; sealed on Swarm when it is set up), `publish-demo-cards` (needs the app running to draw cards), `arkiv`, `entity <key>` (read one shared week as the company and as the public), `doctor` (keys, company wallet and its tGLM balance). Run with `npm run receipts -- <command>`. Loads `web/.env.local` itself.

## Tests

`npm test` (node:test via tsx): pricing against a real Claude Code cost record, OpenAI pricing, the Claude and Codex readers on synthetic logs built at test time, rules, forgiving parsing of AI answers and safe titles, the week list (grouping, skipped sessions, waste last), receipt v2 signing, tampering, and revealing only some items with proofs.
