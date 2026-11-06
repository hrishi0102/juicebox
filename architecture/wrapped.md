# AI Wrapped

A fun look at how someone talks to AI, for everyone, not just coders: how much time went into overthinking, treating the AI as a therapist, just saying hi, and so on, plus an AI personality. It lives at `/wrapped`.

It works on two kinds of data:

- **Claude Code and Codex logs on the laptop.** The readers count each real message while they read the logs (`parse.ts`, `codex.ts`).
- **A ChatGPT or Claude.ai data export**, picked in the browser (the zip, or `conversations.json` inside it). It is read in the browser tab and never uploaded (`chat-import.ts`).

No AI is needed. Everything comes from simple rules on the person's own messages and their timestamps.

## The segments

| Segment | A message counts when it has |
|---|---|
| Overthinking | "wait", "actually", "hmm", "on second thought", "what if", "should I use", "which is better", "not sure if", or 5+ question marks in a short message |
| AI as your therapist | a feeling: "I feel so stressed", overwhelmed, anxious, burnt out, "cheer me up", "my career"... ("I feel like we should..." does not count) |
| Student mode | "explain", "what is", "how does", "why is", "ELI5", "teach me", "difference between" |
| Just saying hi | nothing but a greeting: "hi", "hey Claude", "gm", "good morning" |
| "Yes, go ahead" | a one-line yes: "yes", "ok do it", "continue", "lgtm", "ship it" |
| Rage moments | "wtf", "still not working", "why did you", "useless", "!!!", "?!", or three ALL-CAPS words in a row (acronyms like API or USDC on their own do not count) |
| Brain dumps | 250+ words, or pasted text |

A message can be in more than one segment. Also counted: messages, words, the longest message, questions, "why"s, please/thanks/sorry, images, messages with three or more questions, messages per hour and weekday, time after midnight and the latest message after midnight, days with AI and the longest streak, the most used words, and (for logs) spend.

**Time.** A message counts from when it was sent until the next one, capped at 15 minutes (the same idea as active time). The last message runs until the AI's last answer. Each segment's time is the sum over its messages. "Time with AI" is the sessions' active minutes for logs, and the sum of all exchanges for exports.

## The persona

Each segment has a rough "typical" share of messages (overthinking 7%, therapy 1.5%, student 12%, hi 3%, yes 8%, rage 5%, brain dumps 8%; please/thanks 0.2 per message; 10% of messages after midnight). The persona is the one furthest above typical, if it is at least 15% above and has 3+ messages; the next three become side traits. Under 10 messages, or nothing above typical, gives The Calm Operator.

| Wins on | Persona |
|---|---|
| Overthinking | The Overthinker |
| Therapy | The Deep Talker |
| Student mode | The Eternal Student |
| Just saying hi | The Small-Talk Champion |
| "Yes, go ahead" | The Delegator |
| Rage moments | The Keyboard Warrior |
| Brain dumps | The Brain Dumper |
| Please and thanks | The Most Polite Human Alive |
| After midnight | The 2 a.m. Philosopher |

## What goes where

| Data | Where |
|---|---|
| Message text | Only read while counting. Never stored. Exports stay in the browser tab's memory until it is closed |
| Counts, minutes, hours, days | `~/.receipts/dataset.json` with the sessions (logs), or the browser tab (exports) |
| Most used words | Same place. Shown only on the page, never on the card or sent anywhere |
| The share card | Drawn by the local server from numbers only: persona, minutes, message count, top 4 segments, night share, peak hour, streak, messages per hour scaled 0 to 100 (`/api/card/wrapped`, checked with `wrapped-schema.ts`) |
| "Roast me" | Optional. Sends the same numbers (plus a few counts) to the private AI on 0G, which writes one playful line. Never a message or a word the person typed. Kept in `~/.receipts/wrapped-roasts.json` so the same numbers never cost twice, and capped at 30 new calls an hour. About $0.0003 a call |

## Code

| What | File |
|---|---|
| Rules and per-session counting | `web/src/lib/receipts/chat-stats.ts` |
| Totals, persona, facts, the card's numbers | `web/src/lib/receipts/wrapped.ts`, `wrapped-schema.ts` |
| ChatGPT and Claude.ai exports | `web/src/lib/receipts/chat-import.ts` |
| Periods for the laptop's logs | `web/src/lib/server/wrapped-data.ts` |
| The page | `web/src/app/wrapped/page.tsx`, `web/src/components/wrapped-view.tsx` |
| The card and the roast | `web/src/lib/server/wrapped-card.tsx`, `app/api/card/wrapped`, `app/api/wrapped/roast` |
| Demo habits for the 12 demo people | `demoChat` in `web/src/lib/receipts/demo.ts` |
| Tests (made-up messages and exports only) | `web/test/wrapped.test.ts` |

## Limits

- The rules are English keyword lists. They miss sarcasm, other languages and anything subtle, and will sometimes count a coding "explain" as student mode. That is fine for a fun page and keeps it free, private and instant.
- Coding sessions are full of long specs and pasted logs, so coders often come out as Brain Dumpers.
- The "typical" shares are guesses, not measured from real people.
- Exports with branches (edited ChatGPT messages) count every version the person sent.
