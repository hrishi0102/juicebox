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

## 17. The PR list is always shared with the company
Replaces the opt-in part of decision 15. Every shared receipt includes its pull requests (title, link, status, survival, AI cost), and the title is inside the signed evidence. Reason: the company needs to check what work its AI spend paid for; PRs are already visible to it on GitHub, so this adds accountability without exposing prompts.

## 18. Clean first screen, details on demand
Each page leads with one sentence, one headline and the PR list; secondary analysis sits in collapsible sections with a one-line hint. Reason: a first-time visitor should understand in seconds that this shows "what the AI money bought", without reading tables of metrics first.

## 19. The product is "What did you get done this week?"
The front door is a fun, general-purpose weekly list, not a cost dashboard. The work receipt for the company is the same list, signed. Reason: people want to say what they got done (and post it); a cost table with survival percentages did not land ("no one really cares about % still alive"). PRs are not the only measure: what you asked and what the AI explained count too.

## 20. Seven categories in plain words
Built, Fixed, Figured out, Researched, Wrote, Planned, Wasted. The older labels stay inside for scoring. Reason: anyone understands them in a second, they work for non-coding work, and "Wasted" keeps the list honest.

## 21. Two AI calls: one per session, one per week
The per-session call reads the private digest (prompts and the AI's last answers); the weekly call reads only the resulting titles. Reason: prompts go into exactly one kind of call, the weekly call can merge related sessions into one item, and a failed weekly call still leaves good per-session lines.

## 22. The AI runs only on demand
Reading logs never calls the AI. "Write my week" does, once, for the sessions that need it. Reason: nothing should run in the background or spend money without a click, and each call costs about $0.001.

## 23. Default model 0gm-1.0-35b-a3b-sia, thinking off, with fallbacks
`glm-5.3` and `0gm-1.0-35b-a3b` are tried when its provider is down; all in private (TEE-only) mode. Reason: the single provider behind `0gm-1.0-35b-a3b` was down on Nov 6; the sia build answers in about 2 seconds with the same TEE guarantees.

## 24. The share card is a download, and cost is hidden by default
No public links. Reason: posting is the person's choice, and a fun card with dollar amounts invites the leaderboard comparisons this product replaces.

## 25. Receipt v2 signs the list
Categories, spend per category, things done, merged PRs and a Merkle root over the items replace labels, survival and kept work. Single items can be hidden with proofs while counts stay signed. Reason: the company should see what the money got done, and the person should be able to keep one line private without breaking the totals.

## 26. A key made on the laptop instead of a wallet
Reason: most people do not have, or want, a crypto wallet to share a work summary. The key never leaves `~/.receipts`; a wallet is still possible.

## 27. Arkiv records are read-only and owned by the signer
One transaction creates the entity read-only and hands it to the signer's address; the company wallet only pays gas. Reason: the record is the employee's evidence; neither the company nor we should be able to edit or take it.

## 28. One login: GitHub. Company = GitHub org, team = GitHub team
On the laptop the existing GitHub token is enough; the hosted company view uses a GitHub OAuth App with read-only org access. Reason: every engineering team already lives in GitHub, so there is no second account system to build or trust.

## 29. Sign in with 0G to pay from your own credits
Optional, on localhost:3000. The browser makes the AI calls with the person's 0G session; the local server builds the messages and keeps the results. Reason: a shared app key does not scale to many people, and 0G's iAI credits belong to the person.

## 30. Private lists on Swarm, signed totals on Arkiv
When Swarm is set up, a shared week's list, PRs and AI records are encrypted on the laptop and stored on Swarm; the public Arkiv record keeps the signed totals, the Swarm reference, and the pointer and key sealed to the company's key. Reason: Arkiv is public, and work titles can name customers or unreleased features. The company still gets the details, everyone can still check the numbers, and no server of ours holds anything. We encrypt ourselves rather than use Swarm's encrypted references, which carry their key and could not go on public Arkiv.

## 31. Public cards on Swarm, listed on Arkiv
"Get a Swarm link" stores the card on Swarm and writes a small read-only card entity owned by its maker; `/wall` reads them. Reason: posts get a permanent link that does not depend on us, and anyone can see what people chose to share, with a SHA-256 to check the bytes.

## 32. The public Swarm testnet gateway for storage, for now
It stamps uploads with its own batch, so it costs nothing and needs no node. Reason: no stamps were offered at the event, and the user is not spending money without being asked. Trade-off: the gateway is for testing and does not promise how long data lives; switching to our own node and batch is two environment variables.

## 33. Say exactly what 0G protects
The model runs in a TEE and every answer's TEE signature is checked, but our requests are not end-to-end sealed (`X-0G-E2EE: none`), so 0G's router could read them in transit. The app, README and docs say this plainly instead of "only the enclave can read it". Reason: overclaiming privacy is worse than a clear, smaller claim; sealing requests to the enclave is the next step if 0G's router supports it for our model.

## 34. Efficiency from timestamps, not from the AI
Idea to code, code to commit, commit to PR, PR to merge, brainstorm time, PR funnel and waste reasons all come from log and GitHub timestamps. The AI only makes judgment calls (is this a plan, are these the same piece of work). Reason: hard numbers are reproducible and can be signed; it costs no 0G credits; and an AI guessing durations would be neither.

## 35. A plan or open question is waste only after a day without follow-up
Reason: work in progress is not waste. A day without any session in the same folder or repo is a clear, explainable rule; dropped plans are charged their session's cost, open questions are only counted.

## 36. Receipt v3 signs the efficiency numbers; v2 keeps verifying
Reason: the company should be able to trust the timeline and waste numbers as much as the totals, and receipts already shared must not break. The company page keeps one receipt per person per week (verified, newest version, from Arkiv, opened from Swarm), so re-shared weeks are not counted twice.

## 37. Count each log line once across copies of a conversation
Reason: continued conversations are stored as growing copies; counting per file inflated spend several times over. Files with fewer message lines are read first so the original owns the shared history.
