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

## Not Coinbase, for context

- Circle's devnet USDC faucet (faucet.circle.com) worked from a headless browser: 20 USDC per address every
  2 hours, with invisible reCAPTCHA.
- The Solana devnet SOL airdrop (`requestAirdrop`) answered "airdrop limit reached" (429) from our IP. Thanks
  to the facilitator paying fees, we never needed SOL.
