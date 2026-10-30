// Coinbase and Solana: an agent wallet you can trust (tracks/coinbase-solana.md). One video for two tracks. Format: a
// payment ledger that builds row by row. The box's real wallet page opens it, ledgers carry the paid, waiting and earned
// rows, the Face ID request is a pair of tilted cards under a TEST MONEY stamp, the Solana transaction is a tilted card
// with its fee payer circled. No wallet-run recordings exist yet (T-CB-01 to T-CB-06), so the pictures are real
// screenshots and recordings (the Agent wallet page, the Shopper app's x402 rows, the iPhone and watch requests from
// Apple's simulators, the Solana Explorer transaction). The `receipts` slot is not merged, so it is left out. Every
// payment is devnet test money.
const cap = (f) => `cap:${f}`, repo = (f) => `repo:${f}`;
const MADE_UP = 'Made-up company · sandbox data';
const EXPLORER = repo('showcase/src/assets/track/solana/explorer-urd99.png');

export default {
  title: 'GurtOS for Coinbase and Solana: an agent wallet you can trust',
  edition: 'server',
  maxDur: 90,
  music: 'bed-ledger-long.wav',
  style: { bg: 'grid' },
  card: { sponsor: 'Coinbase and Solana', track: 'x402 Payment Agents · Best use of Solana', editions: ['server', 'business'], size: 92 },
  beats: [
    // 1. Principle 14: Bybit (FBI). The box's own wallet page is on screen from the first word, steady and full-bleed;
    // the wallet's balance line is lit when the voice says "money". The kit has no typed ledger row over a recording,
    // so the Bybit figure rides in the lower third.
    { hold: 0.4, v: { type: 'shot', frame: 'full', src: repo('showcase/src/assets/shots/app-wallet.png'), crop: { x: 150, y: 30, w: 1000, h: 563 }, enter: 'cut', note: 'TEST MONEY · devnet USDC',
        lt: { kicker: 'FBI: North Korean actors, Bybit, Feb 21, 2025', title: 'About $1.5 billion stolen', t: 0.2, dur: 7.2 },
        marks: [{ cue: 'money', kind: 'spot', x: 0.074, y: 0.19, w: 0.438, h: 0.032, color: 'accent', until: { cue: 'key', off: 0.6 } }] } },
    // 2. The wallet belongs to the OS: its own user, no key; then the box's x402 rows, budget checked, signed, logged.
    { hold: 0.3, parts: [
        { v: { type: 'shot', frame: 'window', src: cap('a06.mp4'), from: 4, crop: { x: 250, y: 165, w: 1420, h: 690 }, enter: 'slide-up',
            lt: { kicker: 'GurtOS Server · a finished task', title: 'Its own user, no key', t: 0.2, dur: 2.8 },
            marks: [{ cue: 'wallet', kind: 'box', x: 0.695, y: 0.503, w: 0.28, h: 0.062, color: 'accent' }] } },
        { cue: 'box', v: { type: 'shot', frame: 'window', src: cap('cb-shopper-rows.png'), enter: 'slide-up', note: 'TEST MONEY · devnet USDC',
            lt: { kicker: 'x402, from the box wallet', title: 'Budget checked, signed, logged', t: 0.2, dur: 3.2 },
            marks: [{ cue: 'signs', kind: 'circle', x: 0.806, y: 0.658, w: 0.185, h: 0.15, color: 'done' },
              { cue: 'budget', kind: 'circle', x: 0.806, y: 0.835, w: 0.185, h: 0.14, color: 'amber' }] } }] },
    // 3. A real agent buys: the joke is paid, the three-cent report waits. The report's $0.03 is on the watch and the phone.
    { hold: 0.4, parts: [
        { v: { type: 'ledger', kicker: 'Droid with Claude · told: buy one joke and one report · TEST MONEY · devnet USDC', rows: [
            { when: 'Droid', what: 'One joke', amount: '$0.01', status: 'Paid', cue: 'joke' },
            { when: 'Droid', what: 'The weekly price report', amount: '$0.03', status: 'Waiting for Face ID', statusKind: 'waiting', cue: 'three' }],
          total: 'Spent: $0.01', totalAt: { cue: 'paid', off: 0.4 } } },
        { cue: 'waited', off: -0.1, v: { type: 'pair', bg: 'grid', stamps: [{ text: 'TEST MONEY', cue: 'test', color: 'amber', box: 'frame', x: 0.5, y: 0.56, rot: -8, size: 100 }], items: [
            { src: repo('showcase/src/assets/track/coinbase/watch-wallet.png'), frame: 'tilt', tiltY: 13, enter: 'whip-l', label: 'Apple Watch · $0.03', color: 'accent' },
            { src: repo('native/screenshots/iphone-wallet-faceid.png'), frame: 'tilt', tiltY: -13, label: 'iPhone: Face ID', color: 'amber', cue: 'face' }] } }] },
    // 4. The box earns: rows with a 402 price, the Bazaar listing, a metered search.
    { hold: 0.5, v: { type: 'ledger', kicker: 'The box earns · devnet USDC · TEST MONEY', rows: [
        { when: 'Earned', what: 'GET /t/wallet/sell/audit: 402', amount: '$0.01', status: 'Paid route', cue: 'earns' },
        { when: 'Listed', what: 'x402 Bazaar, by pay-to address', status: 'Listed', cue: 'listed' },
        { when: 'Metered', what: 'Search, capped at $0.02', amount: '$0.002', status: 'Charged', cue: 'metered' }] } },
    // 5. Reuse in one command, typed in a terminal; the builder-feedback counter rolls.
    { hold: 0.4, parts: [
        { v: { type: 'terminal', title: 'tracks/wallet · one command', enter: 'slide-up', lines: [
            { text: 'curl -fsSL …/tracks/wallet/install.sh | sh', cmd: true, cue: 'one' },
            { text: '# Wallet for Claude Code or any MCP agent', cue: 'installs' },
            { text: '# The same budget and approval prompt', cue: 'with' }] } },
        { cue: 'we', v: { type: 'scoreboard', kicker: 'BUILDER FEEDBACK', size: 190, srcTop: 560, items: [
            { n: '28', label: 'points of builder feedback, with times', cue: 'twenty', color: 'accent' }],
          source: 'tracks/wallet/FEEDBACK.md', sourceAt: { cue: 'points' } } }] },
    // 6. Solana: the transaction as a tilted card, the 109 and 0 counters, the memo, the fee payer circled, the log fingerprint.
    { hold: 1.0, parts: [
        { v: { type: 'shot', frame: 'tilt', src: EXPLORER, enter: 'flip', tiltY: -10, box: { cx: 960, cy: 510, w: 1000, h: 960 },
            lt: { kicker: 'Solana Explorer · devnet · TEST MONEY', title: 'One agent payment, finalized', t: 0.2, dur: 3.4 },
            marks: [{ cue: 'checkable', kind: 'circle', x: 0.241, y: 0.213, w: 0.19, h: 0.025, color: 'done' }] } },
        { cue: 'one', off: -0.1, v: { type: 'scoreboard', kicker: 'SOLANA EXPLORER · wallet address page, devnet · TEST MONEY', size: 150, items: [
            { n: '109', label: 'finalized devnet transactions naming the wallet, Oct 24', cue: 'one', color: 'done' },
            { n: '0', label: 'failed', cue: 'none', color: 'done' }],
          source: 'Solana Explorer, wallet address page, devnet', sourceAt: { at: 1.2 } } },
        { cue: 'each', off: -0.3, v: { type: 'exhibit', bg: 'desk', label: 'MEMO · on a payment', enter: 'slide-up', size: 56, lines: [
            { text: 'gurtos task=tmde0x6ca46', mark: true, at: 0.2 }], source: 'Each memo names its task', sourceAt: { at: 0.3 } } },
        { cue: 'facilitator', off: -0.6, v: { type: 'shot', frame: 'tilt', src: EXPLORER, enter: 'whip-l', tiltY: 10, box: { cx: 960, cy: 510, w: 1000, h: 960 },
            marks: [{ cue: 'facilitator', off: -0.3, kind: 'box', x: 0.23, y: 0.314, w: 0.4, h: 0.028, color: 'amber', label: 'Fee payer: the facilitator', side: 'above', labelW: 520 }] } },
        { cue: 'eleven', off: -0.2, v: { type: 'exhibit', bg: 'desk', label: 'MEMO · on a log fingerprint', enter: 'drop', rot: 1, size: 52, lines: [
            { text: 'gurtos-audit v1 seq=595 sha256=...', mark: true, at: 0.3 },
            { text: 'A fingerprint shows a later edit, not an earlier one', dim: true, cue: 'carry' }] } }] },
    // 7. Business routing, then the end card. The picture is a credit request, not a wallet payment.
    { hold: 1.5, parts: [
        { v: { type: 'shot', frame: 'window', src: cap('a30.mp4'), from: 13.5, crop: { x: 340, y: 96, w: 1240, h: 820 }, enter: 'wipe-down', note: MADE_UP,
            lt: { kicker: 'GurtOS Business · a credit request, not a wallet payment', title: 'Over $10,000 goes to the Controller', t: 0.2, dur: 4.2 },
            marks: [{ cue: 'goes', kind: 'box', x: 0.43, y: 0.228, w: 0.478, h: 0.122, color: 'accent', label: 'The person the rules name', side: 'below', labelW: 560 }] } },
        { cue: 'gurt', v: { type: 'end', lines: ['gurtos.com', 'github.com/benz16107/gurtos', 'Open source, Apache-2.0'] } }] },
  ],
};
