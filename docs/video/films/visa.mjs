// Visa: shopping you approve (tracks/visa.md). Format: a shopping journey, shelf then approval then checkout then refund.
// The real Shopper window opens it, a tilted Face ID card with the watch inset is the approval, the store's refusals are
// circled at checkout, the merchant's two tiles split the screen, a ledger stamps the refund, two counters close it.
// Every payment is TEST money and says so. The progress rail is approximated: the kit has none, so each station names
// itself in the kicker of its first lower third ("1 of 4 · SHELF"). Positions in `marks` are fractions of each crop.
const cap = (f) => `cap:${f}`, repo = (f) => `repo:${f}`;
const SHOP = 'showcase/src/assets/repo/shopper/';

export default {
  title: 'GurtOS for Visa: shopping you approve',
  edition: 'personal',
  maxDur: 90,
  music: 'bed-shopping-long.wav',
  style: { bg: 'hills' },
  card: { sponsor: 'Visa', track: 'Reimagining Shopping', editions: ['personal', 'server'] },
  beats: [
    // 1. The problem, over the real Shopper window from the first frame (full-bleed, steady, no camera move).
    { hold: 0.2, v: { type: 'shot', frame: 'full', src: cap('vi.mp4'), from: 1.0, enter: 'cut',
        lt: { kicker: 'Shopping agents today', title: 'They need your card or password', t: 0.2, dur: 1.9 } } },
    // 2. Personal runs the shopper; the card stays in the vault. The status line that says so is underlined as it is spoken.
    { v: { type: 'shot', frame: 'window', src: repo('showcase/src/assets/shots/app-shopper.png'), enter: 'wipe',
        lt: { kicker: 'GurtOS Personal', title: 'Your shopping agent runs here', edition: 'personal', t: 0.2, dur: 2.6 },
        marks: [{ cue: 'vault', kind: 'underline', x: 0.185, y: 0.286, w: 0.485, h: 0.02, color: 'accent', label: 'The card stays in the vault', side: 'below', labelW: 640 }] } },
    // Slot: agent permissions, with the Shopper's own refusal (the owner set $5.00 a day). Nothing here claims a prompt screen.
    { insert: 'permissions', hold: 0.5, v: { type: 'shot', frame: 'window', src: repo('showcase/src/assets/track/visa/permissions-daily-limit.png'), enter: 'whip-l',
        note: 'Test money, scripted agent, nothing paid',
        lt: { kicker: 'Agent permissions', title: 'The owner set Shopper to $5.00 a day', t: 0.2, dur: 3.6 },
        marks: [{ cue: 'manifest', kind: 'box', x: 0.687, y: 0.268, w: 0.285, h: 0.33, color: 'accent', label: 'What it was allowed', side: 'below', labelW: 420 }] } },
    // 3. THE SHELF: a standing instruction in the real Shopper field, then the live price as a counter.
    { hold: 0.8, parts: [
        { v: { type: 'shot', frame: 'window', src: cap('vi.mp4'), from: 13.0, rate: 0.55, crop: { x: 320, y: 96, w: 1280, h: 820 }, enter: 'wipe',
            lt: { kicker: '1 of 4 · SHELF · GurtOS Test Store', title: 'A watch, approved once', t: 0.2, dur: 3.0 },
            marks: [{ cue: 'once', kind: 'underline', x: 0.185, y: 0.922, w: 0.629, h: 0.036, color: 'amber', label: 'Said once, in words', side: 'above', labelW: 480 }] } },
        { cue: 'chemex', off: -0.1, v: { type: 'scoreboard', bg: 'desk', kicker: 'THE SHELF · live price from the store, through Apify, not from the model', size: 190, srcTop: 560, items: [
            { n: '$15.36\u00a0CAD', label: 'Chemex filters, Best Buy Canada', cue: 'chemex', color: 'done' }],
          source: 'Live run, Oct 23 · test money, test store', sourceAt: { cue: 'fifteen' } } }] },
    // 4. APPROVAL: the phone asks once; Face ID on a tilted card, the watch as an inset, a TEST PAYMENT stamp.
    { hold: 0.8, parts: [
        { v: { type: 'shot', frame: 'full', src: cap('vi.mp4'), from: 17.2, enter: 'whip-r',
            lt: { kicker: '2 of 4 · APPROVAL · test payment', title: 'Under the limit, it asks', t: 0.2, dur: 2.0 },
            marks: [{ cue: 'limit', kind: 'box', x: 0.772, y: 0.042, w: 0.219, h: 0.218, color: 'amber', label: 'It asks once', side: 'left', labelW: 330 }] } },
        { cue: 'approve', off: -0.2, v: { type: 'shot', frame: 'tilt', src: repo(SHOP + 'face-id-purchase.png'), crop: { x: 0, y: 0, w: 840, h: 768 }, enter: 'flip', tiltY: -12,
            box: { cx: 620, cy: 430, w: 840, h: 700 }, caption: 'Face ID: a virtual authenticator stands in',
            stamp: { text: 'TEST PAYMENT', cue: 'test', color: 'amber', x: 0.98, y: 0.52, rot: -9, size: 70 },
            pip: { src: repo('showcase/src/assets/track/visa/watch-shopper.png'), cue: 'face', w: 480, corner: 'br', enter: 'slide-up', label: 'Apple Watch: approve on your iPhone', color: 'accent' } } }] },
    // 5. CHECKOUT: Trusted Agent Protocol, the store's refusals circled, then the replay gate.
    { hold: 1.3, parts: [
        { v: { type: 'shot', frame: 'window', src: repo(SHOP + 'store-refusals.png'), enter: 'wipe', note: 'Refused requests at our test store',
            lt: { kicker: '3 of 4 · CHECKOUT · test payments', title: "Signed with Visa's Trusted Agent Protocol", t: 0.2, dur: 3.4 },
            marks: [{ cue: 'unsigned', kind: 'circle', x: 0.031, y: 0.208, w: 0.168, h: 0.034, color: 'blocked' },
              { cue: 'changed', kind: 'circle', x: 0.031, y: 0.477, w: 0.164, h: 0.034, color: 'blocked' }] } },
        { cue: 'replay', off: -0.2, v: { type: 'exhibit', bg: 'desk', label: 'MERGE GATE · Oct 25 · offline, simulated payments', size: 56, lines: [
            { text: 'ok  A captured signature cannot be used twice', mark: true, at: 0.4 }] } }] },
    // 6. The merchant's view, split: trusted agent orders on the left, the bots turned away on the right.
    { hold: 0.5, v: { type: 'pair', bg: 'desk', note: 'GurtOS Test Store · test payments', items: [
        { src: repo(SHOP + 'store-dashboard.png'), crop: { x: 340, y: 590, w: 475, h: 410 }, label: 'Trusted agent orders', color: 'accent' },
        { src: repo(SHOP + 'store-dashboard.png'), crop: { x: 810, y: 590, w: 475, h: 410 }, label: 'Bots turned away', color: 'amber', cue: 'turns', off: -0.2 }] } },
    // 7. REFUND: undo as a ledger with the REFUNDED stamp, then the stolen session's refusal. T-VI-04 (the Stripe test
    // dashboard) is not captured: the ledger carries the live run's fact.
    // TODO cap:vi-undo.mp4 (T-VI-04, Undo and the refund line, test mode only)
    { hold: 0.4, parts: [
        { v: { type: 'ledger', bg: 'desk', kicker: '4 of 4 · REFUND · Stripe test mode · test money', rows: [
            { when: 'Oct 23', what: 'Chemex filters, Best Buy Canada', amount: '$15.36 CAD', status: 'Test payment', at: 0.1 },
            { what: 'Undo the purchase task', cue: 'undo' },
            { what: 'The order', status: 'Refunded', cue: 'refunded' }],
          source: 'Live run, Oct 23', sourceAt: { at: 1.2 },
          stamp: { text: 'REFUNDED', cue: 'refunded', color: 'done', box: 'frame', x: 0.7, y: 0.62, rot: -7, size: 90 } } },
        { cue: 'stolen', off: -0.2, v: { type: 'shot', frame: 'paper', src: cap('visa-stolen-row.png'), enter: 'drop', rot: -1, box: { cx: 960, cy: 420, w: 1760, h: 520 }, caption: 'A stolen session · test money, nothing paid',
            marks: [{ cue: 'without', kind: 'underline', x: 0.103, y: 0.29, w: 0.135, h: 0.1, color: 'amber' },
              { cue: 'refuses', kind: 'circle', x: 0.804, y: 0.27, w: 0.058, h: 0.13, color: 'blocked' }] } }] },
    // 8. Equifax against zero, then the end card.
    { hold: 2.3, parts: [
        { v: { type: 'scoreboard', bg: 'desk', kicker: 'Principle 14 · a sourced attack', size: 150, srcTop: 560, items: [
            { n: '209,000', label: 'payment card numbers taken from Equifax, 2017', cue: 'two', color: 'blocked' },
            { n: '0', label: 'cards the agent holds', cue: 'agent', color: 'done' }],
          source: 'FTC, July 2019', sourceAt: { cue: 'equifax' } } },
        { cue: 'gurt', off: 0.1, v: { type: 'end', lines: ['Every payment shown was test money', 'gurtos.com', 'github.com/benz16107/gurtos', 'Open source, Apache-2.0'] } }] },
  ],
};
