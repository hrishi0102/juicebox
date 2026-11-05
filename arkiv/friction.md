# Friction log

What slowed us down while building on Arkiv, in the order we hit it. Written so the Arkiv team can fix things, not to complain.

1. **Old tutorials no longer work.** SDK 1.0 (Oct 30, 2026) is a breaking rewrite: no more `payload` and `annotations` fields, no `expiresIn`, no `updateEntity`. Most examples found by search (and by AI assistants) still show the 0.x API. A short "migrating from 0.x" page at the top of the docs would save everyone time.
2. **The query syntax changed silently.** `type = "receipt" && team = "x"` now fails with `-32001 unexpected character`. The new form is `type = str('receipt') AND team = str('x')`. The error message could say "values need a type, for example str('x')".
3. **`llms.txt` is partly out of date.** It still lists `ne`, `not`, cursors and `atBlock`, which 1.0.1 does not export. Since many builders now read docs through AI tools, this file matters a lot.
4. **Faucet sign-in is heavy for a hackathon.** Getting tGLM needs a wallet connection, a sign-in signature, an email registration and a CAPTCHA per claim, with a 24 hour cooldown. Because every wallet that writes needs gas, an app cannot let each user write their own entity without sending every user through that flow. We worked around it with one writer wallet and EIP-712 signatures inside the payload, so authorship does not depend on who paid the gas. A sponsored-write option (a paymaster, or "writer pays for another signer") would make user-owned entities practical.
5. **Bigints need wrapping.** Numeric attributes default to `i32`; a `u64` value must be wrapped (`u64(123n)`). Easy once known, but the type error is long. A one-line example in the schema docs would help.
6. **Public RPC warning.** Without an access key the SDK prints a rate-limit warning on every client. Fine, but getting a key needs the same Hub sign-in as the faucet.
7. **No "owned by signer" concept.** `$owner` is whoever paid for the write. For apps where a relayer writes on behalf of users, it would be great to have an optional, verified "author" field (for example an EIP-712 signature checked by the node) so readers do not each need to re-verify payload signatures.

What worked well: typed schemas with `defineSchema` are clear, the query builder is pleasant, reads from the public endpoint just work, expiry is simple, and the Rabdi testnet was up and fast whenever we tried it.
