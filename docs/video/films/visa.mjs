// Visa: shopping you approve (tracks/visa.md). One beat per narration paragraph. Every payment is TEST money and says so.
const cap = (f) => `cap:${f}`, repo = (f) => `repo:${f}`;
const REVIEW = repo('showcase/src/assets/repo/personal/14-review.png');
const SHOPPER = repo('showcase/src/assets/shots/app-shopper.png');
const SHOP = 'showcase/src/assets/repo/shopper/';
const DASH = repo(SHOP + 'store-dashboard.png');

export default {
  title: 'GurtOS for Visa: shopping you approve',
  edition: 'personal',
  maxDur: 90,
  music: 'bed-hopeful-long.wav',
  card: { sponsor: 'Visa', track: 'Reimagining Shopping', editions: ['personal', 'server'] },
  beats: [
    // 1. The problem, over the real Shopper app from the first second.
    { hold: 0.2, parts: [
        { v: { type: 'stills', src: SHOPPER, moves: [{ at: 0.3, s: 1.3, px: 0.5, py: 0.3, d: 1.0 }],
            lt: { kicker: 'Shopping agents today', title: 'They need your card or password' } } },
        { cue: 'stores', v: { type: 'stills', src: SHOPPER, moves: [{ at: 0.02, s: 1.3, px: 0.5, py: 0.3, d: 0.01 }, { cue: 'see', s: 1.8, px: 0.5, py: 0.55, d: 0.9 }],
            lt: { kicker: "Stores can't tell them from bots", title: "You can't see what they do", t: 0.1 } } }] },
    // 2. Personal runs the shopper; the card stays in the vault.
    { parts: [
        { v: { type: 'stills', src: REVIEW, moves: [{ cue: 'shopping', s: 2.0, px: 0.3, py: 0.3, d: 0.8 }],
            lt: { kicker: 'GurtOS Personal', title: 'Your shopping agent runs here', edition: 'personal' } } },
        { cue: 'card', v: { type: 'stills', src: SHOPPER, moves: [{ at: 0.2, s: 1.55, px: 0.5, py: 0.3, d: 0.8 }] } }] },
    // Slot: agent permissions, with the Shopper's own refusal (the owner set $5.00 a day). Nothing here claims a prompt screen.
    { insert: 'permissions', hold: 0.5, v: { type: 'stills', src: repo('showcase/src/assets/track/visa/permissions-daily-limit.png'),
        note: 'Test money, scripted agent, nothing paid', moves: [{ cue: 'manifest', s: 1.45, px: 0.34, py: 0.3, d: 0.8 }],
        lt: { kicker: 'Agent permissions', title: 'The owner set Shopper to $5.00 a day' } } },
    // 3. A standing instruction, then the live price from the store through Apify.
    { hold: 0.8, parts: [
        { v: { type: 'clip', src: cap('vi.mp4'), from: 5.6, rate: 1.8, note: 'Test money, test store', moves: [{ at: 0.25, s: 2.0, px: 0.86, py: 0.18, d: 0.7 }],
            lt: { kicker: 'Shopper · GurtOS Test Store', title: 'A watch, approved once' } } },
        { cue: 'reads', v: { type: 'lines', kicker: 'The live price comes from the store', lines: [
            { text: 'Read from the store, through Apify', at: 0.3 }, { text: 'Not from the model', dim: true, cue: 'not' }] } },
        { cue: 'fifteen', v: { type: 'stats', cols: 1, size: 150, items: [{ n: '$15.36 CAD', label: 'Chemex filters, Best Buy Canada', at: 0.1 }],
            source: 'Live run, Oct 23', srcTop: 520, sourceAt: { at: 0.3 } } }] },
    // 4. The phone asks once; Face ID; a test payment.
    { hold: 0.8, parts: [
        { v: { type: 'clip', src: cap('vi.mp4'), from: 18.3, moves: [{ at: 0.2, s: 2.0, px: 0.86, py: 0.2, d: 0.7 }],
            lt: { kicker: 'GurtOS Test Store', title: 'Under the limit: it asks' } } },
        { cue: 'approve', v: { type: 'stills', src: repo(SHOP + 'face-id-purchase.png'), note: 'Face ID: a virtual authenticator stands in',
            moves: [{ cue: 'approve', s: 2.0, px: 0.3, py: 0.88, d: 0.7 }, { cue: 'test', s: 2.4, px: 0.14, py: 0.07, d: 0.7 }] } }] },
    // 5. Trusted Agent Protocol: signed, checked; unsigned, changed and replayed orders fail.
    { hold: 1.3, parts: [
        { v: { type: 'lines', kicker: 'GurtOS Test Store · test payments', lines: [
            { text: 'The box signs the order', cue: 'signs' }, { text: "With Visa's Trusted Agent Protocol", cue: 'visa' },
            { text: 'The store checks it before it charges', dim: true, cue: 'store' }] } },
        { cue: 'unsigned', off: 0.3, v: { type: 'stills', src: repo(SHOP + 'store-refusals.png'), note: 'Refused requests at our test store',
            moves: [{ at: 0.3, s: 1.3, px: 0.4, py: 0.25, d: 0.7 }, { cue: 'changed', s: 1.3, px: 0.4, py: 0.5, d: 0.7 }] } },
        { cue: 'replay', v: { type: 'lines', size: 52, kicker: 'Merge gate, Oct 25 · offline, simulated payments', lines: [
            { text: 'ok  a captured signature cannot be used twice', mono: true, at: 0.2 }] } }] },
    // 6. The merchant's view.
    { hold: 0.5, v: { type: 'stills', src: DASH, moves: [{ at: 0.2, s: 1.35, px: 0.5, py: 0.4, d: 0.8 }, { cue: 'bots', s: 2.4, px: 0.33, py: 0.4, d: 0.8 }],
        lt: { kicker: 'GurtOS Test Store, test payments', title: "The merchant's view" } } },
    // 7. Undo is a refund; a stolen session cannot buy. T-VI-04 (the Stripe test dashboard) is not captured: a card with the live run's fact.
    // TODO cap:vi-undo.mp4 (T-VI-04, Undo and the refund line, test mode only)
    { hold: 0.4, parts: [
        { v: { type: 'lines', kicker: 'Undo is a refund · Stripe test mode · test money', lines: [
            { text: 'Undo the purchase task', cue: 'undo' }, { text: 'The order is refunded', cue: 'refunded' }],
          source: 'Live run, Oct 23', sourceAt: { at: 0.3 } } },
        { cue: 'stolen', off: 0.2, v: { type: 'stills', src: cap('visa-stolen-row.png'), note: 'Test money, nothing paid' } }] },
    // 8. Equifax, then the end card.
    { hold: 2.3, parts: [
        { v: { type: 'stats', cols: 2, size: 120, items: [
            { n: '209,000', label: 'payment card numbers taken from Equifax, 2017', cue: 'two' }, { n: '0', label: 'cards the agent holds', cue: 'agent' }],
          source: 'FTC, July 2019', sourceAt: { cue: 'equifax' }, srcTop: 470 } },
        { cue: 'gurt', off: 0.1, v: { type: 'end', lines: ['Every payment shown was test money', 'gurtos.com', 'github.com/benz16107/calhacks13', 'Open source, Apache-2.0'] } }] },
  ],
};
