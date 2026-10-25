// Hyphenate: Autonomous Systems for Finance (tracks/hyphenate.md). Opens on its moment, APP-1043, caught live.
// Cuts to fit 90 s with both slots in (the script's Slots table): the data and ledger paragraph is out, and the Equifax
// paragraph is its one sourced sentence (re-voiced). Shares the credit desk recordings with CRS and Microsoft.
const cap = (f) => `cap:${f}`, repo = (f) => `repo:${f}`;
const SHOW = 'track/hyphenate';
const QUICK = 'Quick run: scripted seats, live CRS sandbox';
const MADE_UP = 'Made-up company · sandbox data';

export default {
  title: 'GurtOS for Hyphenate: the credit desk',
  edition: 'business',
  maxDur: 90,
  music: 'bed-calm-long.wav',
  card: { sponsor: 'Hyphenate', track: 'Autonomous Systems for Finance', editions: ['business'] },
  beats: [
    // 1. The moment: APP-1043. The simple rule approves $20,000; the analyst checks it live; the controller confirms.
    { hold: 0.4, parts: [
        // Slowed to 0.4x so the CRS results land on "Our analyst agent checked it live with CRS".
        { v: { type: 'clip', src: cap('hy.mp4'), from: 5.75, rate: 0.4, note: QUICK, moves: [{ at: 0.4, s: 1.5, px: 0.5, py: 0.62, d: 1.0 }],
            lt: { kicker: 'Fogline Supply, a made-up wholesaler · Credit desk', title: 'APP-1043: a simple rule approves $20,000' } } },
        { cue: 'our', v: { type: 'clip', src: cap('hy.mp4'), from: 7.6, rate: 0.8, note: QUICK, moves: [
            { cue: 'identity', s: 2.2, px: 0.31, py: 0.62, d: 0.8 },
            { cue: 'fraud', s: 2.4, px: 0.86, py: 0.15, d: 0.8 }] } },
        // The replay of the same task: the nine inquiries, in the log.
        { cue: 'nine', v: { type: 'clip', src: cap('frd.mp4'), from: 18.25, rate: 0.4, moves: [{ at: 0.2, s: 2.0, px: 0.6, py: 0.3, d: 0.7 }],
            lt: { kicker: 'Replay of the analyst task', title: '9 inquiries, Aug 19 to Sep 12' } } },
        { cue: 'put', v: { type: 'clip', src: cap('a30-fraud.mp4'), from: 12.7, moves: [{ at: 0.1, s: 2.0, px: 0.33, py: 0.3, d: 0.7 }],
            lt: { kicker: 'The controller', title: 'Fraud flag', t: 0.05 } } },
        { cue: 'controller', v: { type: 'stills', src: repo(`showcase/src/assets/${SHOW}/replay-approved-dark.png`), moves: [{ at: 0.2, s: 1.7, px: 0.33, py: 0.5, d: 0.8 }],
            lt: { kicker: 'Replay of the analyst task', title: 'Approved by Rosa Delgado' } } }] },
    // 2. Principle 14: a sourced attack on a financial company (FTC, July 2019).
    { hold: 0.5, v: { type: 'lines', kicker: 'On an ordinary computer, a finance agent runs as you and holds your keys', lines: [
        { text: 'Equifax, 2017', cue: 'equifax' },
        { text: 'Administrative credentials in a plain-text file', cue: 'admin', off: 0.1 },
        { text: '145.5 million Social Security numbers', dim: true, cue: 'plain' }],
      source: 'FTC press release, July 22, 2019 · ftc.gov', sourceAt: { cue: 'credentials' } } },
    // 3. The company, its three seats and the controller; each seat is its own Linux user.
    { post: 0.35, parts: [
        { v: { type: 'clip', src: cap('a31.mp4'), from: 1.2, note: MADE_UP, moves: [{ at: 0.3, s: 1.15, px: 0.55, py: 0.45, d: 1.2 }],
            lt: { kicker: 'GurtOS Business · Fogline Supply', title: 'An operating system for AI employees' } } },
        { cue: 'three', v: { type: 'clip', src: cap('hy.mp4'), from: 11, moves: [{ at: 0.1, s: 1.5, px: 0.5, py: 0.66, d: 0.8 }],
            lt: { kicker: 'Credit desk', title: 'Three agent seats' } } },
        { cue: 'human', v: { type: 'clip', src: cap('a31.mp4'), from: 1.2, moves: [{ at: 0.1, s: 2.3, px: 0.57, py: 0.2, d: 0.8 }],
            lt: { kicker: 'People', title: 'A human controller', t: 0.05 } } },
        { cue: 'each', v: { type: 'stills', src: repo(`showcase/src/assets/${SHOW}/analyst-crs-live.png`), moves: [{ at: 0.2, s: 2.2, px: 0.3, py: 0.1, d: 0.8 }],
            lt: { kicker: 'The credit analyst seat', title: 'Its own Linux user: box-…' } } }] },
    // 4. Separation of duties: the clerk's limits, the $40,000 that goes to the controller, nobody approves their own request.
    { hold: 0.4, post: 0.35, parts: [
        { v: { type: 'clip', src: cap('a31.mp4'), from: 1.2, note: MADE_UP, moves: [{ at: 0.2, s: 2.2, px: 0.57, py: 0.565, d: 0.9 }],
            lt: { kicker: 'Settings · Agent seats', title: 'Each seat has its own limits' } } },
        { cue: 'analyst', v: { type: 'clip', src: cap('a30.mp4'), from: 13.5, note: MADE_UP, moves: [
            { at: 0.2, s: 1.45, px: 0.6, py: 0.3, d: 0.9 }, { cue: 'rule', s: 2.0, px: 0.6, py: 0.33, d: 0.8 }],
            lt: { kicker: 'Credit analyst: up to $10,000 alone', title: '$40,000 goes to the controller' } } },
        { cue: 'nobody', v: { type: 'clip', src: cap('a32.mp4'), from: 13.2, note: MADE_UP, moves: [{ cue: 'own', s: 1.7, px: 0.62, py: 0.31, d: 0.8 }],
            lt: { kicker: 'The controller asked for it herself', title: 'She cannot approve it' } } }] },
    // Slot: agent permissions, shown only as the core's refusal in Activity.
    { insert: 'permissions', hold: 0.3, v: { type: 'stills', src: repo(`showcase/src/assets/${SHOW}/perm-blocked.png`), moves: [
        { at: 0.2, s: 1.4, px: 0.63, py: 0.2, d: 0.9 }, { cue: 'phone', s: 2.0, px: 0.68, py: 0.17, d: 0.9 }],
      lt: { kicker: 'Activity · Blocked', title: 'The OS refused it, and logged it' } } },
    // 5. Every decision keeps its rules, its data and its approver; ready for an auditor.
    { hold: 0.3, parts: [
        { v: { type: 'stills', src: repo(`showcase/src/assets/${SHOW}/analyst-decision.png`), moves: [
            { at: 0.1, s: 1.5, px: 0.5, py: 0.4, d: 0.8 }, { cue: 'rules', s: 1.9, px: 0.4, py: 0.44, d: 0.6 },
            { cue: 'data', s: 1.9, px: 0.45, py: 0.62, d: 0.6 }, { cue: 'approver', s: 1.9, px: 0.45, py: 0.52, d: 0.6 }],
            lt: { kicker: "The analyst's log · APP-1043", title: 'Rules, data, approver' } } },
        { cue: 'ready', v: { type: 'clip', src: cap('a33.mp4'), from: 12.4, note: MADE_UP, moves: [{ at: 0.2, s: 2.0, px: 0.78, py: 0.12, d: 0.8 }],
            lt: { kicker: 'Audit · Owen Clarke, auditor', title: 'Read-only, with Export CSV' } } }] },
    // Slot: the flight recorder, on the analyst's APP-1043 task.
    { insert: 'flight-recorder', hold: 0.3, v: { type: 'clip', src: cap('frd.mp4'), from: 20.8, note: MADE_UP, moves: [
        { at: 0.2, s: 1.4, px: 0.5, py: 0.5, d: 0.9 }, { cue: 'approvals', s: 1.7, px: 0.55, py: 0.55, d: 0.8 }],
      lt: { kicker: "Flight recorder · the analyst's APP-1043 task", title: 'Replay it step by step' } } },
    // 6. The score against the answer key, then Bring your own, then the end card.
    { hold: 1.65, parts: [
        { v: { type: 'lines', kicker: 'Scored against the answer key', lines: [
            { text: 'A full live run', at: 0.3 }, { text: 'Droid on Claude', dim: true, cue: 'droid' }] } },
        { cue: 'caught', v: { type: 'stats', cols: 3, size: 110, items: [
            { n: '16 of 17', label: 'planted errors caught', cue: 'sixteen' },
            { n: '1', label: 'false alarm', cue: 'one' },
            { n: '6 of 6', label: 'credit decisions right', cue: 'six', after: 'alarm' }],
          source: 'Full live run bd5c61, Oct 24 · real Droid on Claude · 12 min, about $5.24', sourceAt: { at: 0.6 } } },
        { cue: 'right', off: 0.3, v: { type: 'stills', src: repo(`showcase/src/assets/${SHOW}/desk-bring-your-own.png`),
            lt: { kicker: 'Credit desk', title: 'Bring your own', t: 0.05 } } },
        { cue: 'gurt', v: { type: 'end', lines: ['gurtos.com', 'github.com/benz16107/calhacks13', 'Open source, Apache-2.0'] } }] },
  ],
};
