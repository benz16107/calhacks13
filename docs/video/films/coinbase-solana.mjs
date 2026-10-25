// Coinbase and Solana: an agent wallet you can trust (tracks/coinbase-solana.md). One video for two tracks.
// No wallet-run recordings exist yet (T-CB-01 to T-CB-06), so the pictures are real product screenshots (the Agent wallet
// page, the Shopper app's x402 rows, the iPhone request from Apple's simulator, the Solana Explorer transaction) and text
// cards for numbers. The `receipts` slot is not merged, so it is left out. Every payment is devnet test money.
const cap = (f) => `cap:${f}`, repo = (f) => `repo:${f}`;
const MADE_UP = 'Made-up company · sandbox data';

export default {
  title: 'GurtOS for Coinbase and Solana: an agent wallet you can trust',
  edition: 'server',
  maxDur: 90,
  music: 'bed-calm-long.wav',
  card: { sponsor: 'Coinbase and Solana', track: 'x402 Payment Agents · Best use of Solana', editions: ['server', 'business'], size: 92 },
  beats: [
    // 1. Principle 14: Bybit (FBI). The box's own wallet page is on screen from the first word; the lower third carries the attack.
    { hold: 0.4, v: { type: 'stills', src: repo('showcase/src/assets/shots/app-wallet.png'), moves: [{ at: 0.3, s: 2.2, px: 0.36, py: 0.24, d: 0.9 }],
        note: 'TEST MONEY · devnet USDC',
        lt: { kicker: 'FBI: North Korean actors, Bybit, Feb 21, 2025', title: 'About $1.5 billion stolen', dur: 7.5 } } },
    // 2. The wallet belongs to the OS: key in a root-only file, budget checked, signed, logged.
    { hold: 0.3, parts: [
        { v: { type: 'clip', src: cap('a06.mp4'), from: 4, moves: [{ at: 0.3, s: 2.1, px: 0.745, py: 0.56, d: 0.9 }],
            lt: { kicker: 'GurtOS Server · a finished task', title: 'Its own user, no key' } } },
        { cue: 'box', v: { type: 'stills', src: cap('cb-shopper-rows.png'), note: 'TEST MONEY · devnet USDC',
            lt: { kicker: 'x402, from the box wallet', title: 'Budget checked, signed, logged', t: 0.2 } } }] },
    // 3. A real agent buys; the over-budget report waits for Face ID.
    { hold: 0.4, parts: [
        { v: { type: 'lines', kicker: 'Droid with Claude · TEST MONEY · devnet USDC', lines: [
            { text: 'Told: buy one joke and one report', cue: 'buy' },
            { text: 'The joke: $0.01, paid', cue: 'paid' },
            { text: 'Report: over budget', cue: 'three' }] } },
        { cue: 'so', v: { type: 'stills', h: 760, items: [
            { src: repo('native/screenshots/iphone-wallet-faceid.png'), device: 'phone', label: 'iOS simulator · TEST MONEY' }] } },
        { cue: 'these', v: { type: 'lines', kicker: 'Every payment in this video', size: 96, lines: [
            { text: 'TEST MONEY', at: 0.2 }, { text: 'Devnet USDC, not real funds', dim: true, at: 0.7 }] } }] },
    // 4. The box earns: a 402 route, the Bazaar, a metered search.
    { hold: 0.5, v: { type: 'lines', size: 52, kicker: 'The box earns · devnet USDC · TEST MONEY', lines: [
        { text: 'GET /t/wallet/sell/audit: 402, $0.01', mono: true, cue: 'earns' },
        { text: 'Listed in the x402 Bazaar by pay-to address', mono: true, cue: 'listed' },
        { text: 'Metered search: capped $0.02, charged $0.002', mono: true, cue: 'metered' }] } },
    // 5. Reuse in one command; builder feedback.
    { hold: 0.4, parts: [
        { v: { type: 'lines', size: 52, kicker: 'Reuse · Apache-2.0', lines: [
            { text: 'One curl line runs tracks/wallet/install.sh', mono: true, cue: 'one' },
            { text: 'Wallet for Claude Code or any MCP agent', cue: 'installs' },
            { text: 'The same budget and approval prompt', dim: true, cue: 'with' }] } },
        { cue: 'we', v: { type: 'stats', cols: 1, size: 150, items: [{ n: '28', label: 'points of builder feedback, with times', at: 0.2 }],
            source: 'tracks/wallet/FEEDBACK.md', sourceAt: { at: 0.6 }, srcTop: 560 } }] },
    // 6. Solana: anyone can check the payments, the task named in each, and a fingerprint of the log.
    { hold: 1.0, parts: [
        { v: { type: 'stills', src: repo('showcase/src/assets/track/solana/explorer-urd99.png'), moves: [{ at: 0.4, s: 1.7, px: 0.5, py: 0.22, d: 0.9 }],
            lt: { kicker: 'Solana Explorer · devnet · TEST MONEY', title: 'One agent payment, finalized', t: 0.1 } } },
        { cue: 'one', v: { type: 'stats', cols: 2, size: 130, items: [
            { n: '109', label: 'finalized devnet transactions naming the wallet, Oct 24', at: 0.2 },
            { n: '0', label: 'failed', cue: 'none' }],
          source: 'Solana Explorer, wallet address page, devnet', sourceAt: { at: 0.6 } } },
        { cue: 'each', v: { type: 'lines', kicker: 'The memo on a payment names its task', lines: [
            { text: 'gurtos task=tmde0x6ca46', mono: true, at: 0.3 }] } },
        { cue: 'facilitator', v: { type: 'stills', src: repo('showcase/src/assets/track/solana/explorer-urd99.png'), moves: [{ at: 0.2, s: 2.0, px: 0.5, py: 0.32, d: 0.8 }],
            lt: { kicker: 'Fee payer', title: 'The facilitator paid it', t: 0.1 } } },
        { cue: 'eleven', v: { type: 'lines', size: 52, kicker: 'The memo on a log fingerprint', lines: [
            { text: 'gurtos-audit v1 seq=595 sha256=...', mono: true, at: 0.3 },
            { text: 'A fingerprint shows a later edit, not an earlier one', dim: true, cue: 'carry' }] } }] },
    // 7. Business routing, then the end card. The picture is a credit request, not a wallet payment.
    { hold: 1.5, parts: [
        { v: { type: 'clip', src: cap('a30.mp4'), from: 13.5, note: MADE_UP, moves: [
            { at: 0.2, s: 1.45, px: 0.6, py: 0.3, d: 0.9 }, { cue: 'rules', s: 2.0, px: 0.6, py: 0.33, d: 0.8 }],
            lt: { kicker: 'GurtOS Business · a credit request, not a wallet payment', title: 'Over $10,000 goes to the Controller' } } },
        { cue: 'gurt', v: { type: 'end', lines: ['gurtos.com', 'github.com/benz16107/calhacks13', 'Open source, Apache-2.0'] } }] },
  ],
};
