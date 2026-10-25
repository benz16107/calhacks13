// Microsoft: could a company switch this on (tracks/microsoft.md). Opens on the controller's screen and a business email
// compromise stopped, so the real product is on screen in the first seconds. Cuts to fit 90 s with both slots in (the
// script's Slots table): the "pilots stay pilots" paragraph is out, and the voice files are renumbered to match.
const cap = (f) => `cap:${f}`, repo = (f) => `repo:${f}`;
const HY = 'showcase/src/assets/track/hyphenate', MS = 'showcase/src/assets/track/microsoft', BIZ = 'showcase/src/assets/repo/business';
const MADE_UP = 'Made-up company · sandbox data';

export default {
  title: 'GurtOS for Microsoft: could a company switch this on',
  edition: 'business',
  maxDur: 90,
  music: 'bed-calm-long.wav',
  card: { sponsor: 'Microsoft', track: 'Built for the Real World', editions: ['business'] },
  beats: [
    // 1. The customer, and the attack it faces (FBI IC3). The product stopping that attack is on screen from the first word.
    { hold: 0.2, parts: [
        { v: { type: 'clip', src: cap('a30-fraud.mp4'), from: 12.7, note: MADE_UP, moves: [{ at: 0.1, s: 1.5, px: 0.45, py: 0.3, d: 0.8 }],
            lt: { kicker: 'Fogline Supply, a made-up wholesaler', title: 'The customer: its controller' } } },
        { cue: 'fbi', v: { type: 'clip', src: cap('ar04.mp4'), from: 7.2, note: 'Source: FBI IC3, 2025 Internet Crime Report', moves: [{ at: 0.3, s: 1.5, px: 0.42, py: 0.55, d: 0.8 }],
            lt: { kicker: 'Business email compromise, 2025: 24,768 complaints', title: '$3,046,598,558 in reported losses', dur: 6.6 } } }] },
    // 2. Roles and limits; each seat is its own Linux user.
    { parts: [
        { v: { type: 'clip', src: cap('a31.mp4'), from: 1.2, note: MADE_UP, moves: [{ at: 0.2, s: 2.0, px: 0.57, py: 0.28, d: 0.9 }],
            lt: { kicker: 'GurtOS Business · Fogline Supply', title: 'Roles and limits' } } },
        { cue: 'each', v: { type: 'stills', src: repo(`${HY}/analyst-crs-live.png`), moves: [{ at: 0.2, s: 2.2, px: 0.3, py: 0.1, d: 0.8 }],
            lt: { kicker: 'Each agent seat', title: 'Its own Linux user' } } }] },
    // Slot: agent permissions, shown as the core's refusal in Activity.
    { insert: 'permissions', hold: 0.3, v: { type: 'stills', src: repo(`${HY}/perm-blocked.png`), moves: [
        { at: 0.2, s: 1.4, px: 0.63, py: 0.2, d: 0.9 }, { cue: 'phone', s: 2.0, px: 0.68, py: 0.17, d: 0.9 }],
      lt: { kicker: 'Activity · Blocked', title: 'The OS refused it, and logged it' } } },
    // 3. The pilot starts in shadow: the clerk is at five of six, not ready. A seeded box with scripted seats.
    { hold: 0.3, v: { type: 'stills', src: repo(`${BIZ}/shadow-people.png`), note: 'Seeded box, scripted seats', moves: [
        { at: 0.2, s: 1.5, px: 0.57, py: 0.6, d: 0.9 }, { cue: 'counts', s: 1.8, px: 0.57, py: 0.66, d: 0.8 }, { cue: 'five', s: 2.2, px: 0.66, py: 0.5, d: 0.8 }],
      lt: { kicker: 'One-week pilot · Fogline Supply (made up)', title: 'Shadow: it suggests, a person decides' } } },
    // 4. A $40,000 line goes to the controller by a rule; work-account sign-in, tested with a test provider.
    { hold: 0.2, parts: [
        { v: { type: 'clip', src: cap('a30.mp4'), from: 13.5, note: MADE_UP, moves: [
            { at: 0.2, s: 1.45, px: 0.6, py: 0.3, d: 0.9 }, { cue: 'rule', s: 2.0, px: 0.6, py: 0.33, d: 0.8 }],
            lt: { kicker: 'Credit analyst: up to $10,000 alone', title: '$40,000 goes to the controller', dur: 3.0 } } },
        { cue: 'work', v: { type: 'lines', kicker: 'Work-account sign-in', lines: [
            { text: 'OpenID Connect, ready for Entra', cue: 'openid' },
            { text: 'Tested with a standards test provider', dim: true, cue: 'tested' },
            { text: 'Not a real Entra tenant', blocked: true, cue: 'not' }] } }] },
    // 5. The drill: one switch froze ten agents; a bad batch undone. The numbers are the live run's, with its mix of seats.
    { hold: 0.2, parts: [
        { v: { type: 'clip', src: cap('a34.mp4'), from: 11.5, note: MADE_UP, moves: [{ at: 0.3, s: 1.5, px: 0.5, py: 0.3, d: 0.8 }],
            lt: { kicker: 'Kill switch', title: 'Pause all agents' } } },
        { cue: 'ten', v: { type: 'stats', cols: 3, size: 110, items: [
            { n: '10', label: 'agents: 3 Droid seats on Claude, 7 scripted', at: 0.2 },
            { n: '271 ms', label: 'to freeze every agent', cue: 'two' },
            { n: '48 ms', label: 'to undo a bad batch', cue: 'forty' }],
          source: 'Incident drill, a live run on a Business box · docs/drill.md', sourceAt: { cue: 'two' } } }] },
    // Slot: the flight recorder, on a scripted task.
    { insert: 'flight-recorder', hold: 0.3, v: { type: 'clip', src: cap('frd.mp4'), from: 20.8, note: 'Replay of a scripted task · made-up company', moves: [
        { at: 0.2, s: 1.4, px: 0.5, py: 0.5, d: 0.9 }, { cue: 'approvals', s: 1.7, px: 0.55, py: 0.55, d: 0.8 }],
      lt: { kicker: 'Flight recorder', title: 'Replay a task step by step' } } },
    // 6. The $20,000 fake applicant held; 16 of 17 planted errors in the full live run.
    { hold: 0.3, parts: [
        { v: { type: 'clip', src: cap('hy.mp4'), from: 8.1, rate: 0.8, note: 'Quick run: scripted seats, live CRS sandbox', moves: [{ at: 0.6, s: 2.4, px: 0.86, py: 0.15, d: 0.8 }],
            lt: { kicker: 'Credit desk · APP-1043', title: 'A simple rule approves $20,000' } } },
        { cue: 'caught', v: { type: 'stats', cols: 2, size: 130, items: [
            { n: '$20,000', label: 'fake applicant held', at: 0.2 },
            { n: '16 of 17', label: 'planted errors caught', cue: 'sixteen' }],
          source: 'Full live run bd5c61, Oct 24 · real Droid on Claude', sourceAt: { at: 0.6 } } }] },
    // 7. Responsible design: a privacy test, the six principles, a plain letter; then the end card.
    { hold: 2.7, parts: [
        { v: { type: 'lines', kicker: 'tracks/credit-desk/fairness.test.ts · 4 of 4 tests pass', lines: [
            { text: 'Seats never see protected details', cue: 'seats' }] } },
        { cue: 'each', v: { type: 'lines', size: 54, kicker: "Microsoft's Responsible AI Standard: six principles, each mapped to a control", lines: [
            { text: 'Fairness', at: 0.6 }, { text: 'Reliability and safety', at: 1.0 }, { text: 'Privacy and security', at: 1.4 },
            { text: 'Inclusiveness', at: 1.8 }, { text: 'Transparency', at: 2.2 }, { text: 'Accountability', at: 2.6 }] } },
        { cue: 'and', after: 'principles', v: { type: 'lines', kicker: 'A decline gets a plain letter', lines: [
            { text: 'We need to verify some information', at: 0.3 },
            { text: 'Not a claim of legal compliance', dim: true, at: 1.2 }] } },
        { cue: 'open', v: { type: 'end', lines: ['gurtos.com', 'github.com/benz16107/calhacks13', 'Open source, Apache-2.0'] } }] },
  ],
};
