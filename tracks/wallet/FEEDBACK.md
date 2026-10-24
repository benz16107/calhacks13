# Builder feedback: Coinbase x402

Kept while building the box's agent wallet, Oct 23 2026, with `@x402/core`, `@x402/fetch`, `@x402/svm` and
`@x402/express` 2.28.0 on Node 22 and 24, paying USDC on Solana devnet. Payments settled through the x402.org
facilitator first, then through the CDP facilitator with `@coinbase/cdp-sdk` 1.60.0 once we had a CDP key.
Newest first within each section. Times are rough.

## What worked well

- **The CDP facilitator was a one-line swap.** `createCdpFacilitatorClient` from `@coinbase/cdp-sdk/x402`
  replaced the x402.org client, and an Ed25519 Secret API Key worked on the first call. Its `/supported`
  lists the v2 exact scheme on Solana devnet with its own fee payer, so nothing else in our code changed.

- **First payment in about 15 minutes.** The seller middleware is ten lines and the buyer is four. The first
  devnet payment settled on the first try, in about 1.5 s from the 402 to the 200.
- **The wallet needs no SOL.** On Solana the facilitator is the fee payer (`extra.feePayer`), so an agent
  wallet needs only USDC. That removed our hardest faucet: the devnet SOL airdrop answered 429 all evening.
  The buyer quickstart should say this plainly for Solana.
- **Spend controls exist.** The client refuses unknown assets and caps one payment at $1 by default. We found
  that by reading `client/index.mjs`. It deserves a line in the quickstart, since it is the first thing a
  team building agent payments looks for.
- **Policies are the right hook.** `registerPolicy` let us pay only the devnet USDC offer at exactly the price
  the agent quoted and the owner approved.

## Friction

1. **The CDP SDK's x402 entry needs the EVM package, even for Solana.** `@coinbase/cdp-sdk/x402` lists
   `@x402/evm` as an optional peer dependency but imports it on load. A Solana-only seller fails at import
   with `ERR_MODULE_NOT_FOUND: Cannot find package '@x402/evm'`. Installing `@x402/evm` 2.28.0 fixed it.
   Asks: import it only when an EVM scheme is used, or list it as a real dependency. About 5 minutes.
2. **`@x402/core` prints to stdout on every payment with CDP.** `HTTPFacilitatorClient` logs
   `[x402] extension responses: {}` on each verify and settle, because CDP returns an extension header. There
   is no option to turn it off, so it lands in our merge gate's output. A debug flag or a logger option
   would fix it.

3. **A payee without a USDC account fails with an opaque error.** The exact SVM client does not create the
   payee's associated token account. Paying a fresh address gets back HTTP 402 with an empty `{}` body. The
   reason sits only in a base64 `PAYMENT-REQUIRED` header: `invalid_exact_svm_transaction_simulation_failed`.
   It took a manual decode and a guess to learn the payee had no token account. Asks: name the cause in the
   error ("payTo has no token account for this mint"), and say in the seller quickstart that a new `payTo`
   needs a USDC account first. (Circle's faucet creates one, which is how we made ours.) About 20 minutes.
4. **`decodePaymentResponseHeader` on a missing header** throws `SyntaxError: Unexpected token` from
   `JSON.parse` of garbage bytes. A message like "no PAYMENT-RESPONSE header" would have saved a detour.
5. **Two Solana versions in one install.** `@x402/svm` 2.28.0 depends on `@solana/program-client-core` ^6.1,
   which brings `@solana/*` 6.10, while its `@solana-program/token`, `token-2022` and `compute-budget` want
   `@solana/kit` ^5 as a peer. So one install holds 5.5.1 and 6.10.0 side by side. We found by trial that the
   app must pin `@solana/kit` 5.5.1; 6.x installs but splits the tree. The README could name the kit version
   each release is tested with. About 30 minutes, mostly because the split pushed packages out of our npm
   workspace's root `node_modules`, which our test runner then wiped.
6. **Two CDP facilitator helpers, one stale.** `@coinbase/x402` 2.1.0 (Dec 2025) still shows up in docs. It
   pulls in `@coinbase/cdp-sdk`, viem and a second Solana tree, about 82 MB, and installed next to `@x402/svm`
   it caused the split in item 5, so we removed it. The current path, `createCdpFacilitatorClient` in
   `@coinbase/cdp-sdk/x402` 1.60.0, installed cleanly once we pinned `@solana/kit` 5.5.1 (25 packages, as
   viem was already there). The docs do not say which of the two is current. A small auth-only package, or a
   `cdpKey` option on `HTTPFacilitatorClient`, would make the choice obvious and the install light.
7. **The CDP facilitator cannot be explored without keys.** `GET /platform/v2/x402/supported` answers 401
   with no credentials, so we could not check its Solana devnet support before making an account. The x402.org
   facilitator answers the same request openly, so we built on it first and switched once we had a key.
8. **No idempotency key for payments.** An agent box resumes work after a power cut. If it dies after the
   facilitator settles but before it records the receipt, the resumed call pays again. The SVM client puts a
   random nonce in its memo; accepting a caller's idempotency key there would make a retry detectable on chain.
   We added our own durable "already started" mark per call that refuses to pay twice. About 20 minutes.
9. **"Pay exactly this much" needs custom code.** `wrapFetchWithPayment` pays whatever the server asks, up to
   the spend cap. Agents need "pay the price that was approved, or nothing". A policy does it, but when a
   policy throws, the message arrives wrapped as `Failed to create payment payload: ...`. A built-in
   `expectedAmount` option would be simpler and harder to get wrong.
10. **Two homes for the code.** Docs pages link to both `github.com/coinbase/x402` and
   `github.com/x402-foundation/x402`, and the npm packages still say Coinbase. It took a moment to trust that
   they are the same project.

## Round 2: Bazaar, upto, Server Wallets, policies, faucets, Onramp (Oct 24)

Kept while adding selling, Bazaar discovery, metered payments, CDP Server Wallets with the policy engine,
Solana memos and Onramp, with `@coinbase/cdp-sdk` 1.60.0 and `@x402/*` 2.28.0.

### What worked well

- **The CDP faucet is a hidden gem.** `cdp.solana.requestFaucet({ address, token: 'sol' | 'usdc' })` works with
  only an API key and any address. It fixed both our faucet problems: the devnet SOL airdrop (always 429 for
  us) and Circle's browser-only USDC faucet. The x402 and Solana guides should point to it first.
- **`upto` on Solana devnet works end to end.** A 2 cent cap settled for $0.002, through the CDP facilitator,
  on the first try once the seller code was right.
- **Bazaar search needs no key.** `searchX402Resources` answered with no auth, which is right for agents.
- **Policy rules validate locally.** The SDK's `CreatePolicyBodySchema` let us check our rule JSON with no
  account and no API call.

### Friction

11. **Policies need a scope the default key doesn't have.** `createPolicy` failed with "Missing required scope:
    policies#manage". The portal's default Secret API Key lacks it, and the x402 and Server Wallet quickstarts
    don't mention it. About 10 minutes. The quickstart could say "tick policies#manage" or the error could link
    to the key's settings.
12. **The scope is also the weak point.** For "even a compromised server can't pay outside policy" to hold, the
    server's key must not be able to change policies. The docs don't say this. We set the policy with one key
    and run the box on a key without the scope. A note in the policy docs would help every agent builder.
13. **Server Wallets need a second secret, made only in the portal.** `createAccount` fails with "Wallet Secret
    not configured". There is no API or CLI to make one, so an agent can't finish setup alone.
14. **`splAddress` is ambiguous.** The docs say it compares "SPL token transfer recipient addresses" without
    saying owner wallet or token account; x402 pays the token account. We listed both. Also unclear: whether
    `in` must hold for every transfer in a transaction or any one. About 10 minutes.
15. **A `signSolTransaction` policy leaves other operations open.** `sendSolTransaction` and `signSolMessage` are
    not covered unless named. We added reject rules for them. Easy to miss in a security feature.
16. **`policies.simulate` needs an existing account,** so policy JSON can't be dry-run before the wallet
    secret exists.
17. **No fetch-style seller adapter.** `@x402/express` and `@x402/hono` exist, but a plain WHATWG
    `Request`/`Response` handler (what Bun, Deno, Workers and our box use) means rebuilding the flow from
    `processHTTPRequest`, `processSettlement` and the cancellation dispatcher. About 20 minutes.
18. **Partial settlement for `upto` is only in the types.** `processSettlement(..., { amount })` and settling
    zero through `cancellationDispatcher.cancel` are not in the guides. A metered example would fix it.
19. **The `upto` receipt hides the memo.** The PAYMENT-RESPONSE gives the settlement transaction, but the
    client's memo is on the channel-open transaction, which the receipt doesn't name. We found it with
    `getSignaturesForAddress`. About 10 minutes. An `openTransaction` field would help.
20. **Self-payment is refused with only a code.** Testing a box buying from itself returned
    `self_send_not_allowed`. Reasonable, but no doc mentions it, and it shapes how you test a seller.
21. **Bazaar gives almost no feedback.** The only signal after a settled sale is `bazaar: processing` in the
    extension response. Nothing says when or why a resource was listed or rejected (for example a private URL).
    A listing status endpoint would help.
22. **Bazaar search with a network filter looks broken.** `network: solana-devnet` plus a query returned
    nothing, the same filter with no query returned items. Devnet listings are just rare; an empty-state hint
    would avoid the confusion.
23. **Bazaar entries carry no decimals or USD price,** so a buyer can price only assets it already knows.
24. **Onramp's sandbox is a string prefix.** Test mode is a `partnerUserRef` starting with `sandbox-`, found in
    a field description. Onramp has no devnet delivery, so a wallet demo can't receive test USDC through it.
    And a project with no Onramp app gets a 404 whose text is a database error ("failed to find app ...
    mongo: no documents in result") instead of "create an Onramp app in the Portal".
25. **The JWT key format error is vague.** A wrongly encoded Ed25519 secret gives "Invalid keyData". Naming the
    expected format (base64 of the 64-byte seed plus public key) would save time.
26. **Free-text Bazaar search doesn't find a fresh listing, merchant lookup does.** Right after the first settled
    payment, `listX402DiscoveryMerchant({ payTo })` returned both our resources, while `searchX402Resources`
    for their exact descriptions returned other services and no hit. We can't tell if search indexes later or
    ranks new listings low. A "listed, indexed for search at ..." status would remove the doubt. The merchant
    lookup is the thing a seller should be told to use to check their listing.
27. **Listing happens on the first paid call, and nothing says so.** The only trace was
    `bazaar: processing` in the settle response. It took one successful call through a public URL, from a
    second wallet. A "how to get listed" checklist (public HTTPS URL, extension declared, one settled payment,
    where to verify) would have saved us the guessing.

## Not Coinbase, for context

- Circle's devnet USDC faucet (faucet.circle.com) worked from a headless browser: 20 USDC per address every
  2 hours, with invisible reCAPTCHA.
- The Solana devnet SOL airdrop (`requestAirdrop`) answered "airdrop limit reached" (429) from our IP. Thanks
  to the facilitator paying fees, payments never need SOL; the daily log fingerprint does, and Coinbase's CDP
  faucet supplies it.
- `@solana-program/memo` is not a dependency of anything we use, so the memo instruction is built by hand with
  `@solana/kit`. Easy, but a kit-only memo example would help.
- npm in a sparse clone of a workspace repo installs the whole workspace's packages unless run with
  `--workspaces=false`. About 10 minutes, for the one-command installer.
