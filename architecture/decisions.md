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

## 38. AI Wrapped counts with rules, not with the AI
Overthinking, therapy, hellos, rage and the rest come from keyword rules and timestamps on the person's own messages. Reason: it has to read every message, which we would not send anywhere for a fun page, and rules are free, instant and the same every time. The private AI only writes the optional one-line roast, from numbers.

## 39. ChatGPT and Claude.ai exports are read in the browser
Reason: they hold years of private chats. The page only needs counts, so the file is parsed in the tab and never uploaded, and the card is drawn from numbers.

## 40. A message's time runs to the next one, capped at 15 minutes
Reason: logs have no "reading" or "thinking" events, and the gap until the next message is the best signal of time spent on it. The cap stops a message sent before lunch from counting for an hour, like the active-time rule.

## 41. The company product comes first; Wrapped and cards are a side product
The main product is the company's: each employee sends a signed weekly receipt from their laptop, and the company sees everyone's. AI Wrapped, week cards and the wall are a separate side product for anyone. This narrows decision 19: "What did you get done this week?" is still the employee's question, but the front door now leads with the company and its employees. Reason: monitoring what AI spend gets done across a company was the original idea and is what the product is for; the fun pages are for people who want them.

## 42. One part of the app per role, each with its own header, identity and fallbacks
Front door and public pages, My week (the employee), Company (leads and managers), For fun. Each has its own routes, layout, tabs and identity, and its fallbacks are explained only where they belong (a company with no wallet shows up in Company, Setup, not on an employee's page). Reason: with one header and one home page for everyone, people could not tell whose data they were looking at, which sign-in did what, or which flow they were in.

## 43. GitHub is the one identity; each side proves it where it is
Employees use the GitHub login their laptop already has (it is needed for pull requests anyway) and join their company by picking one of their GitHub teams, checked against GitHub. Leads sign in with GitHub on the company side; on the laptop its GitHub login counts too. Lists open for members of the org (and in the demo), not for anyone who happens to open the app on localhost. Reason: one account system that every engineering team already has, and the right to read lists follows org membership rather than the address the app was opened at.

## 44. One way to pay for the private AI: Sign in with 0G
Every private AI call in the web app (Write my week, one session, the private review, Roast me) is made from the browser with the person's own 0G session, and the page shows their credits going down. The app's own key (`ZG_API_KEY`) is only used by the command line. Replaces decision 29, which made it optional next to the app key. Reason: two ways to pay side by side confused people; 0G's bonus rewards users spending their own daily credits; and a company should not hand an AI key to every laptop. Trade-off: on a hosted copy (0G only allows localhost:3000), the AI does not run; the demo's weeks are already written by 0G.

## 45. A receipt is not a card
The receipt is evidence for the company: signed, nobody can edit it, sent only to the company, and single lines can be kept private while still counting in the signed totals. The card is a picture for socials: not signed, every line editable, cost hidden by default, never sent to a company, and it lives on the side product. Reason: both started from the same week and sat next to each other as two "share" buttons; separating them by audience makes it clear what each one is for.

## 46. The demo is a place you choose, not a fallback
The demo company is entered from `/demo` by picking a role (the lead, an engineer, someone with a link, just for fun), with a banner until you leave. Without logs, the employee side asks you to read them instead of showing the demo person's week. A hosted copy opens on the demo, since it has no logs. Reason: silently showing made-up data as "my week" was the most confusing fallback, and a role picker shows each flow on its own.

## 47. A public gist proves the signing key belongs to the GitHub login
Built on Nov 7 (a public gist on the employee's own GitHub account, signed by their laptop key, shown as "proven" on the company side), then removed the same day; see 49.

## 48. Employees send everything, nothing is picked or edited
The send page shows the receipt and has two steps: sign it, send it. There is no way to leave a line out. Replaces the keep-private switch of decision 45. Reason: the company should get the whole week as the AI wrote it; if the employee chooses what goes in, the receipt stops being evidence and can be gamed. The weekly steps are now write, sign, send.

## 49. No GitHub key proof
Reverses 47. Reason: one more setup step that people did not understand, for a check no prize asks for. The company page shows the GitHub login inside the signed receipt next to the signing address, as before.


## 50. For fun is one page: AI Wrapped
The side product is now only `/wrapped`: My AI Wrapped, then share it (Share, Post on X, Download the card, Copy the text). Week cards (`/card`), the wall (`/wall`) and the card entities on Arkiv are gone, and the old addresses redirect to `/wrapped`. Narrows 41 and drops the card half of 45. Reason: two things made from the same week (a card for socials, a receipt for the company) kept confusing people, and receipts belong only to the company side. Trade-off: Swarm now holds one kind of file (sealed weeks) instead of two; the 12 card entities already on Rabdi expire on their own.

## 51. Every claim about 0G, Arkiv or Swarm links to where it can be checked
Wherever the app says something happened on 0G, Arkiv or Swarm, a "Check it yourself" box links outside the app's own word: the record, its transaction and its owner on the Arkiv explorer; `/proof/swarm/<ref>`, which fetches the ciphertext from the Swarm gateway right then (the gateway's own link downloads a file instead of showing it) and, for members of the company, checks it against the SHA-256 sealed in the Arkiv record; `/proof/0g/<provider>`, which reads 0G's TEE verdicts for the provider live from the router; plus 0G ChainScan and pc.0g.ai. Reason: in a demo, "it is on Arkiv" means little until you open the explorer and see it there.

## 52. The 0G balance is shown in 0G
The router answers the balance in neuron (10^18 neuron = 1 0G). The app shows what you can spend now (total minus pending charges) in 0G, calls out credits and pending charges, and after each call says what it cost. Before, it printed the raw number as credits. Reason: an 18-digit number looked broken and did not match what pc.0g.ai shows.

## 53. A sidebar for the company and the employee
The company (Overview, Teams, People, Pull requests, Setup) and the employee (This week, Sessions, Setup) list their pages in a sidebar instead of tabs in the header; on phones it becomes a row of links. The header keeps only the part's name and who you are. Replaces the tabs of 42. Reason: cleaner, and each part reads as its own app.

## 54. Chainlink CRE instead of the Ethereum Foundation track
The third partner track is Chainlink's Best Workflow with CRE, not EF's Best CROPS App. The monthly CRE job was brought up to date: it reads receipts v2 and v3 from Arkiv with the access key, checks every EIP-712 signature inside the workflow (synchronous recovery with `@noble/curves`, which closes the gap the old job left), counts one receipt per person per week, re-checks merged PRs on GitHub, and writes the median result to `TeamScoreboard` on Ethereum Sepolia, where the company's Team page reads it. Reason: the job already existed for a real reason in the product (a check on the receipts that relies on neither the employee nor the company's computer), and it fit in the time left; the CROPS section stays in the README as a description of the privacy model. Trade-off: until the CRE CLI simulation runs with `--broadcast`, the contract has no score, and the card does not show.
