// CRS: know who you lend to (tracks/crs.md). The same APP-1043 catch as Hyphenate, told as identity and fraud done right.
// Opens on the live CRS checks. Everything fits under 90 s with both slots in, so no paragraph is cut.
const cap = (f) => `cap:${f}`, repo = (f) => `repo:${f}`;
const HY = 'showcase/src/assets/track/hyphenate', CRS = 'showcase/src/assets/track/crs';
const SCRIPTED = 'Scripted agent: same steps every take';
const MADE_UP = 'Made-up company · sandbox data';

export default {
  title: 'GurtOS for CRS: know who you lend to',
  edition: 'business',
  maxDur: 90,
  music: 'bed-tense-long.wav',
  card: { sponsor: 'CRS', track: 'Best Identity/Fraud', editions: ['business'] },
  beats: [
    // 1. The moment: APP-1043, checked live with CRS. The recording is slowed to 0.4x so the CRS results land on "Checked live with CRS".
    { hold: 0.6, parts: [
        { v: { type: 'clip', src: cap('hy.mp4'), from: 5.75, rate: 0.4, note: SCRIPTED, moves: [{ at: 0.4, s: 1.5, px: 0.5, py: 0.62, d: 1.0 }],
            lt: { kicker: 'Credit desk · live CRS sandbox', title: 'APP-1043: a simple rule approves $20,000' } } },
        { cue: 'checked', v: { type: 'clip', src: cap('hy.mp4'), from: 7.0, rate: 0.8, note: SCRIPTED, moves: [
            { cue: 'identity', s: 2.2, px: 0.31, py: 0.62, d: 0.8 },
            { cue: 'fraud', s: 2.4, px: 0.86, py: 0.15, d: 0.8 }] } }] },
    // 2. Principle 14: a sourced attack on a credit bureau (TechCrunch, Aug 28, 2025). TransUnion says no credit information was accessed, so the card says only what was reported.
    { hold: 0.6, v: { type: 'lines', size: 54, kicker: 'TechCrunch reports · TransUnion, July 2025', lines: [
        { text: 'Names, dates of birth, Social Security numbers', cue: 'data' },
        { text: 'More than 4.4 million people', cue: 'more' },
        { text: 'Through a third-party support application', dim: true, cue: 'transunion' },
        { text: 'On an ordinary computer, the agent holds the login', cue: 'ordinary' }],
      source: 'TechCrunch, Aug 28, 2025', sourceAt: { cue: 'people' } } },
    // 3. Each seat is its own Linux user; the CRS login stays in the vault.
    { hold: 0.4, parts: [
        { v: { type: 'clip', src: cap('ar04.mp4'), from: 7.0, note: 'Made-up company · test money', moves: [{ at: 0.2, s: 2.3, px: 0.76, py: 0.45, d: 0.9 }],
            lt: { kicker: 'Credit desk · AP clerk seat', title: 'Its own Linux user: box-…' } } },
        { cue: 'crs', v: { type: 'lines', kicker: 'Where the CRS login lives · GurtOS Business, Fogline Supply (made up)', lines: [
            { text: 'Ordinary computer: in a file the agent reads', blocked: true, cue: 'crs' },
            { text: 'GurtOS: in a vault only the system reads', cue: 'vault' },
            { text: 'The core makes the call; the agent gets a summary', dim: true, cue: 'hijacked' }] } }] },
    // 4. Every pull has a reason and a limit.
    { hold: 0.3, v: { type: 'stills', src: repo(`${CRS}/replay-pull-dark.png`), moves: [
        { at: 0.2, s: 1.6, px: 0.66, py: 0.3, d: 0.8 }],
      lt: { kicker: 'Replay of the analyst task', title: 'Reason: credit-application · pull 1 of 7' } } },
    // Slot: agent permissions, shown as the core's refusal of the CRS login in the audit log.
    { insert: 'permissions', hold: 0.4, v: { type: 'stills', src: repo(`${CRS}/perm-audit.png`), moves: [
        { at: 0.2, s: 1.8, px: 0.38, py: 0.22, d: 0.9 }],
      lt: { kicker: 'Audit · read-only', title: 'The OS refused the CRS login' } } },
    // 5. Identity first; a fraud hold waits for a person, with the evidence on one page.
    { hold: 0.4, parts: [
        { v: { type: 'stills', h: 700, items: [{ src: cap('crs-case-top.png'), device: 'bare', label: 'The fraud case page for the controller' }], moves: [
            { cue: 'identity', s: 1.6, px: 0.5, py: 0.42, d: 0.8 }] } },
        { cue: 'fraud', v: { type: 'clip', src: cap('a30-fraud.mp4'), from: 12.7, moves: [{ at: 0.1, s: 2.0, px: 0.6, py: 0.3, d: 0.8 }],
            lt: { kicker: 'The controller', title: 'Fraud flag', t: 0.05 } } },
        { cue: 'with', v: { type: 'stills', h: 740, items: [{ src: repo(`${CRS}/iphone-biz-fraud-dark.png`), device: 'phone', label: 'iOS simulator' }] } }] },
    // Slot: the flight recorder, on the APP-1043 task.
    { insert: 'flight-recorder', hold: 0.5, v: { type: 'clip', src: cap('frd.mp4'), from: 20.8, note: 'Replay of a scripted task · made-up company', moves: [
        { at: 0.2, s: 1.4, px: 0.5, py: 0.5, d: 0.9 }, { cue: 'approvals', s: 1.7, px: 0.55, py: 0.55, d: 0.8 }],
      lt: { kicker: "Flight recorder · the APP-1043 task", title: 'Replay it step by step' } } },
    // 6. The fraudster argues: nine of nine attempts refused, in a scripted test.
    { hold: 0.5, parts: [
        { v: { type: 'lines', kicker: 'The fraudster argues', lines: [{ text: '"The CEO already approved."', cue: 'ceo' }] } },
        { cue: 'in', v: { type: 'stats', cols: 1, size: 150, items: [{ n: '9 of 9', label: 'attempts to get an approval were refused in code', cue: 'nine' }],
            source: 'Scripted test, same steps every take · demo-crs.ts', sourceAt: { at: 0.4 }, srcTop: 560 } },
        { cue: 'refused', v: { type: 'stills', h: 740, items: [{ src: cap('crs-case-top.png'), device: 'bare', label: 'Held in code: FRD-1, FRD-2' }] } }] },
    // 7. The unexpected part: a whole operating system for this.
    { hold: 0.7, v: { type: 'end', lines: ['We built a whole operating system for this', 'gurtos.com', 'github.com/benz16107/calhacks13', 'Open source, Apache-2.0'] } },
  ],
};
