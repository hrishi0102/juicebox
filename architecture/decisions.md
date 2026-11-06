# Key decisions

Newest at the bottom. Add a line when a decision changes, instead of rewriting history.

## 1. Local-first, no Receipts server
The app runs on the user's laptop and reads their logs there. Raw logs and prompts never leave the machine except into the private judge. Reason: the receipt is the employee's evidence; a hosted service would own their data and be one more party to trust (and it is the CROPS "works without you" test).

## 2. Labels: five from the brief plus "Open"
Shipped, Learned, Looped, Abandoned, Overkill, plus Open for work still in flight or that we cannot link. Reason: calling an open PR or a session in a deleted worktree "Abandoned" would be an accusation without evidence. Open is never counted as waste.

## 3. Bill at the larger of two cost numbers
`max(our token pricing, Claude Code's own tracker)`. Reason: our pricing is reproducible from the logs; Claude Code also sees side calls that are not in the transcript. Under-reporting is worse than a small over-count.

## 4. Survival by blame at 30 days
Count lines still attributed to a change's own commits 30 days after merge. Reason: "merged" alone rewards churn; blame-based survival is what "still alive" means, and it works through the GitHub API without cloning.

## 5. Session difficulty from the session's own work
Not from the size of the PR it touched. Reason: on real logs, cheap sessions that only opened a 2,000-line PR were rated "very hard", which broke every comparison.

## 6. Compare only inside a difficulty bucket, never rank people
Reason: the whole point is to replace token leaderboards. The team view shows totals and what people chose to share.

## 7. Private judge on 0G in "private" trust mode
TEE-only model, sealed, signature checked by the router and again by us. Reason: a useful judge must read prompts, and we refuse to send prompts to an ordinary AI API. Without 0G there is no AI judge, only rules.

## 8. EIP-712 with no chainId and two Merkle roots
Reason: receipts are chain-independent and wallets reject mismatched chain ids. Merkle roots let an owner reveal one task (or prove what the judge saw) without revealing everything.

## 9. Arkiv for shared receipts, one writer wallet, authorship by signature
Reason: a public, queryable, expiring store that neither the employer nor we control. Each user needing tGLM from a faucet with email and captcha is too much friction, so one writer pays gas and every reader re-checks the signature.

## 10. Partner tracks: 0G, Arkiv, EF CROPS
ETHGlobal allows three. Chainlink CRE pays $1,500 and needs a login to simulate; every Arc prize requires building in Arc Studio. The CRE job is still built as an optional module.

## 11. Security for a local app at a venue
Bind to 127.0.0.1, answer only localhost Host headers, reject cross-site POSTs. Reason: the server holds session titles and can sign and publish; shared Wi-Fi and malicious pages are real threats.

## 12. Keep paid AI verdicts across rescans
Only re-judge sessions whose activity or GitHub outcome changed. Reason: judge calls cost money and time, and a rescan should not erase them.

## 13. Weekly task cost = share spent that week
Reason: a task worked on across two weeks otherwise showed its full cost in both, and the list did not add up to the receipt's spend.

## 14. One reader per AI tool, one shared engine
Each tool (Claude Code, Codex, later others) gets a small reader that outputs the common `Session` shape with a `tool` field. Reason: matching, judging, scoring and receipts do not depend on the tool, so adding a tool is a contained change, and the org view can compare tools on the same numbers.

## 15. Org-first framing on the "middle path"
The company requires signed weekly totals from everyone (including spend per AI tool); PR lists stay opt-in; prompts are never collected. Reason: companies need real numbers across people and tools to act on AI spend, but collecting prompts or ranking people recreates the surveillance dashboards this product replaces.

## 16. Per-tool spend inside the signed receipt
`tools` and `toolSpendCents` are part of the EIP-712 message, not the unsigned summary. Reason: the org's Claude vs Codex split must be as tamper-proof as the totals.
