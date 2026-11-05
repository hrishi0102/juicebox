We're at ETHGlobal Mumbai (5 to 7 Nov 2026). You own one hackathon idea: research it, decide how to build it and which sponsor prizes to go for, show me a short plan, then build once I say go.

Prizes: https://ethglobal.com/events/mumbai/prizes (each sponsor's page lists its must-haves). Rules: https://ethglobal.com/rules (fresh code only; ignore Continuity tracks).

**The idea: Receipts.** It shows what each person's AI coding spend actually bought, instead of ranking people by how many tokens they burn ("tokenmaxxing").

Why: companies hand out big AI budgets, and usage leaderboards get gamed (Amazon shut one down). Tokens are a small part of what a pull request costs, so the pitch is "see what the spend bought and fix the waste", not "spend less".

How it works:
1. Cost: read token usage from Claude Code's local logs (`~/.claude/projects/*/*.jsonl`) or its OpenTelemetry metrics.
2. Outcome: from GitHub, what merged, what got reverted, and what survived 30 days.
3. Match: link sessions to pull requests by branch, time and files.
4. Judge: a private AI labels each session (Shipped, Learned, Looped, Abandoned or Overkill) and rates its difficulty.
5. Score: Kept Work per Dollar, compared only across similar tasks.

The employee owns a signed weekly receipt, like "$2,140 bought 14 shipped tasks, 91% still alive". It's their evidence at review time. Managers see only team totals and the receipts people choose to share, never prompts.

What I already know:
- My own logs (last 30 days): 340 sessions and 20.6B tokens, 97% of them cache reads. Almost every log records the branch and folder, so matching is doable.
- Closest rivals: Faros (sells to companies), Claude's own dashboard (ranks by usage), and Git AI (now part of OpenAI).
- First thing to try: parse real logs and match a few sessions to merged pull requests.

Sponsors that look natural (you decide): 0G Private Computer for the private judge (the real reason to use crypto here), Chainlink CRE for the monthly scoring job, and Arc for USDC team budgets. Arkiv or the Ethereum Foundation CROPS track may also fit.

Talk to me in plain, simple English, with no em dashes. Testnets only. Ask before spending money or signing up for anything. Never commit real transcripts to the repo.
