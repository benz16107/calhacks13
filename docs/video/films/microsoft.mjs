// Microsoft: could a company switch this on (tracks/microsoft.md). Format: an enterprise pilot briefing. Each beat is a
// readiness check on a plain grid ground, moved forward by left-to-right wipes: the controller's screen, the figures
// on counters, the shadow count that stops at 5 of 6 under NOT READY, a sign-in stamped TEST PROVIDER, the drill in
// milliseconds, six principles lit one by one. One zoom, on the 5 of 6. Same narration and facts as v1 (cuts as before:
// the "pilots stay pilots" paragraph is out). `marks` positions are fractions of each crop, measured on real frames.
const cap = (f) => `cap:${f}`, repo = (f) => `repo:${f}`;
const HY = 'showcase/src/assets/track/hyphenate', BIZ = 'showcase/src/assets/repo/business';
const MADE_UP = 'Made-up company · sandbox data';

export default {
  title: 'GurtOS for Microsoft: could a company switch this on',
  edition: 'business',
  maxDur: 90,
  music: 'bed-enterprise-long.wav',
  style: { bg: 'grid' },
  card: { sponsor: 'Microsoft', track: 'Built for the Real World', editions: ['business'] },
  beats: [
    // 1. The customer: the controller's real screen, the Fraud flag circled on "controller"; then the FBI figures roll
    // on counters with the same attack, refused in code, as an inset.
    { hold: 0.2, parts: [
        { v: { type: 'shot', frame: 'full', src: cap('a30-fraud.mp4'), from: 12.7, enter: 'cut', note: MADE_UP,
            lt: { kicker: 'Fogline Supply, a made-up wholesaler', title: 'The customer: its controller', t: 0.3, dur: 2.4 },
            marks: [{ cue: 'controller', kind: 'circle', x: 0.333, y: 0.2231, w: 0.0406, h: 0.0167, color: 'blocked' }] } },
        { cue: 'fbi', v: { type: 'scoreboard', size: 78, kicker: 'BUSINESS EMAIL COMPROMISE, 2025 · FBI IC3', items: [
            { n: '$3,046,598,558', label: 'in reported losses', cue: 'three', color: 'blocked' },
            { n: '24,768', label: 'complaints', cue: 'compromise', color: 'amber' }],
          source: 'FBI IC3, 2025 Internet Crime Report', sourceAt: { cue: 'logged' }, srcTop: 520,
          pip: { src: cap('ar04.mp4'), from: 7.2, crop: { x: 260, y: 176, w: 1400, h: 660 }, w: 680, corner: 'br', label: 'Made-up company · test money', color: 'amber', at: 0.1, enter: 'wipe' } } }] },
    // 2. Roles and limits on the real People screen; each seat's own-user line arrives as an inset.
    { v: { type: 'shot', frame: 'full', src: cap('a31.mp4'), from: 1.2, enter: 'wipe', note: MADE_UP,
        lt: { kicker: 'GurtOS Business · Fogline Supply', title: 'Roles and limits', t: 0.3, dur: 2.3 },
        marks: [{ cue: 'roles', kind: 'circle', x: 0.479, y: 0.159, w: 0.0625, h: 0.0167, color: 'blocked' },
          { cue: 'limits', kind: 'circle', x: 0.6469, y: 0.1667, w: 0.0854, h: 0.0167, color: 'amber' }],
        pip: { src: repo(`${HY}/analyst-crs-live.png`), crop: { x: 60, y: 70, w: 640, h: 140 }, w: 760, corner: 'br', label: 'Each agent seat: its own Linux user', color: 'accent', cue: 'each', enter: 'slide-up' } } },
    // Slot: agent permissions, as the core's refusal in Activity.
    { insert: 'permissions', hold: 0.3, v: { type: 'shot', frame: 'window', src: repo(`${HY}/perm-blocked.png`), crop: { x: 20, y: 40, w: 1560, h: 780 }, enter: 'wipe',
        lt: { kicker: 'Activity · Blocked', title: 'The OS refused it, and logged it', t: 0.2, dur: 2.6 },
        marks: [{ cue: 'enforces', kind: 'box', x: 0.158, y: 0.105, w: 0.837, h: 0.04, color: 'blocked' },
          { cue: 'allow', kind: 'underline', x: 0.168, y: 0.846, w: 0.59, h: 0.023, color: 'amber', label: 'Allow, Deny or revoke in Settings', side: 'above', labelW: 600 }] } },
    // 3. A seat in shadow: the clerk's agreement bar fills to 5 of 6 and stops short, under NOT READY. The one zoom.
    { hold: 0.3, v: { type: 'shot', frame: 'full', src: repo(`${BIZ}/shadow-people.png`), enter: 'wipe', note: 'Seeded box, scripted seats',
        moves: [{ cue: 'five', s: 2.4, px: 0.69, py: 0.475, d: 0.8 }],
        lt: { kicker: 'One-week pilot · Fogline Supply (made up)', title: 'Shadow: it suggests, a person decides', t: 0.3, dur: 3.4 },
        marks: [{ cue: 'shadow', kind: 'circle', x: 0.5156, y: 0.4583, w: 0.0302, h: 0.0167, color: 'blocked' },
          { cue: 'clerk', kind: 'underline', x: 0.4026, y: 0.4907, w: 0.2839, h: 0.001, color: 'amber', weight: 14 }],
        stamp: { text: 'NOT READY', cue: 'ready', color: 'blocked', box: 'frame', x: 0.7, y: 0.62, rot: -7, size: 100 } } },
    // 4. A $40,000 line goes to the controller by a rule; then work-account sign-in, stamped TEST PROVIDER.
    { hold: 0.2, parts: [
        { v: { type: 'shot', frame: 'window', src: cap('a30.mp4'), from: 13.5, crop: { x: 820, y: 120, w: 700, h: 600 }, enter: 'wipe', note: MADE_UP,
            marks: [{ cue: 'forty', kind: 'circle', x: 0.075, y: 0.12, w: 0.17, h: 0.05, color: 'amber' },
              { cue: 'rule', kind: 'box', x: 0.078, y: 0.27, w: 0.845, h: 0.17, color: 'accent', label: 'To the controller, with the rule', side: 'below', labelW: 520 }] } },
        { cue: 'work', v: { type: 'exhibit', enter: 'wipe', rot: 0.6, label: 'WORK-ACCOUNT SIGN-IN', lines: [
            { text: 'OpenID Connect, ready for Entra', cue: 'openid', mark: true },
            { text: 'Tested with a standards test provider', cue: 'tested' },
            { text: 'Not a real Entra tenant', dim: true, cue: 'not' }],
          stamp: { text: 'TEST PROVIDER', cue: 'provider', color: 'amber', x: 0.7, y: 0.9, rot: -6, size: 78 } } }] },
    // 5. The drill: the kill switch lit by a spotlight as the voice says "switch"; then the three numbers on counters.
    { hold: 0.2, parts: [
        { v: { type: 'shot', frame: 'full', src: cap('a34.mp4'), from: 11.5, enter: 'wipe', note: MADE_UP,
            lt: { kicker: 'Kill switch', title: 'Pause all agents', t: 0.2, dur: 1.9 },
            marks: [{ cue: 'switch', kind: 'spot', x: 0.3958, y: 0.2639, w: 0.1875, h: 0.0398, until: { cue: 'ten' } }] } },
        { cue: 'ten', v: { type: 'scoreboard', size: 110, kicker: 'THE INCIDENT DRILL · live run on a Business box', items: [
            { n: '10', label: 'agents: 3 Droid seats on Claude, 7 scripted', cue: 'ten', color: 'accent' },
            { n: '271 ms', label: 'to freeze every agent', cue: 'two', color: 'done' },
            { n: '48 ms', label: 'to undo a bad batch', cue: 'forty', color: 'done' }],
          source: 'Incident drill, a live run on a Business box · docs/drill.md', sourceAt: { cue: 'two' }, srcTop: 600 } }] },
    // Slot: the flight recorder, on a scripted task.
    { insert: 'flight-recorder', hold: 0.3, v: { type: 'shot', frame: 'window', src: cap('frd.mp4'), from: 20.8, crop: { x: 240, y: 110, w: 1500, h: 840 }, enter: 'whip-r', note: 'Replay of a scripted task · made-up company',
        lt: { kicker: 'Flight recorder', title: 'Replay a task step by step', t: 0.3, dur: 3.2 },
        marks: [{ cue: 'step', kind: 'arrow', x: 0.093, y: 0.098, w: 0.06, h: 0.03, dx: 260, dy: 170, color: 'amber' }] } },
    // 6. The $20,000 fake applicant held and 16 of 17 planted errors, on counters beside the recording.
    { hold: 0.3, v: { type: 'scoreboard', size: 110, kicker: 'THE DESK · APP-1043', items: [
        { n: '$20,000', label: 'fake applicant held', cue: 'twenty', color: 'done' },
        { n: '16', of: '17', label: 'planted errors caught', cue: 'sixteen', color: 'done' }],
      source: 'Full live run bd5c61, Oct 24 · real Droid on Claude', sourceAt: { cue: 'caught' }, srcTop: 838,
      pip: { src: cap('hy.mp4'), from: 8.1, rate: 0.8, crop: { x: 320, y: 40, w: 1600, h: 900 }, w: 560, corner: 'bl', label: 'Quick run: scripted seats, live CRS sandbox', color: 'accent', enter: 'wipe' } } },
    // 7. Responsible design: the privacy test, six principles lit one by one, a plain letter; then the end card.
    { hold: 2.7, parts: [
        { v: { type: 'terminal', size: 52, title: 'tracks/credit-desk/fairness.test.ts', lines: [
            { text: '4 of 4 tests pass', kind: 'ok', cue: 'shows' },
            { text: 'Seats never see protected details', kind: 'out', cue: 'seats' }] } },
        { cue: 'each', v: { type: 'ledger', kicker: "MICROSOFT'S RESPONSIBLE AI STANDARD · six principles, each mapped to a control", rows: [
            { when: '1', what: 'Fairness', status: 'Mapped', at: 0.4 }, { when: '2', what: 'Reliability and safety', status: 'Mapped', at: 0.9 },
            { when: '3', what: 'Privacy and security', status: 'Mapped', at: 1.4 }, { when: '4', what: 'Inclusiveness', status: 'Mapped', at: 1.9 },
            { when: '5', what: 'Transparency', status: 'Mapped', at: 2.4 }, { when: '6', what: 'Accountability', status: 'Mapped', at: 2.9 }] } },
        { cue: 'and', after: 'principles', v: { type: 'exhibit', enter: 'wipe', rot: -0.6, label: 'A DECLINE GETS A PLAIN LETTER', lines: [
            { text: 'We need to verify some information', at: 0.4 },
            { text: 'Not a claim of legal compliance', dim: true, at: 1.8 }] } },
        { cue: 'open', v: { type: 'end', lines: ['gurtos.com', 'github.com/benz16107/calhacks13', 'Open source, Apache-2.0'] } }] },
  ],
};
