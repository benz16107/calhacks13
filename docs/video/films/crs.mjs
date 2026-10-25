// CRS: know who you lend to (tracks/crs.md). Format: a fraud case file. APP-1043 is the suspect; the live CRS checks land
// full-bleed and slow with the identity and the 88 circled (one zoom, on the 88); the TechCrunch card is pinned to a board;
// the login's home is typed on a paper exhibit; the case page takes a HELD stamp; the fraudster's argument is stamped
// REFUSED and the 9 of 9 rolls on a counter. Same narration and facts as v1. `marks` positions are fractions of each crop,
// measured on the real frames.
const cap = (f) => `cap:${f}`, repo = (f) => `repo:${f}`;
const CRS = 'showcase/src/assets/track/crs';
const SCRIPTED = 'Scripted agent: same steps every take';

export default {
  title: 'GurtOS for CRS: know who you lend to',
  edition: 'business',
  maxDur: 90,
  music: 'bed-fraud-long.wav',
  style: { bg: 'board' },
  card: { sponsor: 'CRS', track: 'Best Identity/Fraud', editions: ['business'] },
  beats: [
    // 1. APP-1043 on the desk, full-bleed and slow (0.4x from 5.75 s): the applicant's row circled, the simple rule
    // underlined, then the CRS toast lands; the failed identity is circled and the zoom goes to the 88.
    { hold: 0.6, v: { type: 'shot', frame: 'full', src: cap('hy.mp4'), from: 5.75, rate: 0.4, enter: 'cut', note: SCRIPTED,
        moves: [{ cue: 'score', s: 2.2, px: 0.9, py: 0.14, d: 0.8 }],
        lt: { kicker: 'Credit desk · live CRS sandbox', title: 'Checked live with CRS', t: 5.9, dur: 3.4 },
        marks: [
          { cue: 'applicant', kind: 'circle', x: 0.188, y: 0.7306, w: 0.26, h: 0.0185, color: 'amber', label: 'APP-1043 asks $20,000', side: 'right', labelW: 520, until: { cue: 'checked' } },
          { cue: 'simple', kind: 'underline', x: 0.661, y: 0.6, w: 0.038, h: 0.0167, color: 'blocked', label: 'A simple rule: approve $20,000', side: 'above', labelW: 620, until: { cue: 'checked' } },
          { cue: 'identity', kind: 'circle', x: 0.8964, y: 0.1222, w: 0.0714, h: 0.013, color: 'blocked' },
          { cue: 'eighty', kind: 'circle', x: 0.9307, y: 0.1407, w: 0.0073, h: 0.0111, color: 'amber' }] } },
    // 2. The TechCrunch card pinned to the board, with the sticky note that says what an ordinary computer does.
    { hold: 0.6, v: { type: 'caseboard', kicker: 'EVIDENCE BOARD · APP-1043',
        items: [
          { id: 'tc', kind: 'card', label: 'TECHCRUNCH REPORTS · Aug 28, 2025', title: 'TransUnion, July 2025', x: 600, y: 140, w: 840, rot: -1.2, cue: 'techcrunch',
            lines: [{ text: 'Names, dates of birth, Social Security numbers', cue: 'data' }, { text: 'More than 4.4 million people', cue: 'more' }, { text: 'Through a third-party support application', cue: 'transunion' }] },
          { id: 'app', kind: 'card', label: 'APPLICANT · APP-1043', title: 'Pacific Crest Provisions LLC', lines: ['Asks $20,000', 'Checked live with CRS'], x: 1560, y: 190, w: 500, rot: 1.6, cue: 'agent' },
          { id: 'login', kind: 'note', text: 'On an ordinary computer, the agent holds the login', x: 1000, y: 620, w: 640, rot: -2, cue: 'ordinary' }],
        strings: [{ from: 'tc', to: 'login', cue: 'ordinary', off: 0.3, sag: 60 }, { from: 'app', to: 'login', cue: 'checks', sag: 60 }] } },
    // 3. The AP clerk seat, each seat its own Linux user; then the login's home, typed.
    { hold: 0.4, parts: [
        { v: { type: 'shot', frame: 'paper', src: cap('ar04.mp4'), from: 7.0, crop: { x: 260, y: 176, w: 1400, h: 660 }, enter: 'slide-up', rot: 1.2, note: 'Made-up company · test money',
            lt: { kicker: 'Credit desk · AP clerk seat', title: 'Each seat: its own Linux user', t: 0.3, dur: 1.9 },
            marks: [{ cue: 'seat', kind: 'circle', x: 0.8036, y: 0.2864, w: 0.1679, h: 0.0303, color: 'blocked', label: 'Its own Linux user', side: 'left', labelW: 400 }] } },
        { cue: 'crs', v: { type: 'exhibit', size: 44, enter: 'wipe', rot: 0.8, label: 'WHERE THE CRS LOGIN LIVES · GURTOS BUSINESS, FOGLINE SUPPLY (MADE UP)', lines: [
            { text: 'Ordinary computer: in a file the agent reads', cue: 'crs' },
            { text: 'GurtOS: in a vault only the system reads', cue: 'vault', mark: true },
            { text: 'The core makes the call; the agent gets a summary', dim: true, cue: 'hijacked' }] } }] },
    // 4. Every pull has a reason and a limit: the reason line circled, the pull count underlined.
    { hold: 0.3, v: { type: 'shot', frame: 'window', src: repo(`${CRS}/replay-pull-dark.png`), crop: { x: 540, y: 95, w: 1030, h: 270 }, enter: 'wipe',
        marks: [{ cue: 'reason', kind: 'circle', x: 0.1612, y: 0.404, w: 0.1777, h: 0.0667, color: 'amber', label: 'A stated reason', side: 'above', labelW: 420 },
          { cue: 'limit', kind: 'underline', x: 0.3427, y: 0.404, w: 0.0777, h: 0.0667, color: 'amber', label: 'Pull 1 of 7', side: 'below', labelW: 260 }] } },
    // Slot: agent permissions, as the core's refusal of the CRS login in the audit log.
    { insert: 'permissions', hold: 0.4, v: { type: 'shot', frame: 'window', src: repo(`${CRS}/perm-audit.png`), crop: { x: 190, y: 120, w: 800, h: 210 }, enter: 'wipe-down',
        marks: [{ cue: 'manifest', kind: 'circle', x: 0.4575, y: 0.4667, w: 0.1713, h: 0.0857, color: 'blocked', label: 'The OS refused the CRS login', side: 'below', labelW: 700 },
          { cue: 'allow', kind: 'underline', x: 0.64, y: 0.4667, w: 0.3525, h: 0.0857, color: 'amber', label: 'Allow, Deny or revoke', side: 'above', labelW: 520 }] } },
    // 5. Identity first, then the HELD stamp on the case page; then the controller's screen beside the phone as a tilted card.
    { hold: 0.4, parts: [
        { v: { type: 'shot', frame: 'paper', src: cap('crs-case-top.png'), enter: 'drop', rot: -1.4,
            marks: [{ cue: 'identity', kind: 'circle', x: 0.0458, y: 0.3855, w: 0.684, h: 0.0188, color: 'blocked' }],
            stamp: { text: 'HELD', cue: 'hold', color: 'blocked', x: 0.66, y: 0.2, rot: -9, size: 96 } } },
        { cue: 'person', v: { type: 'pair', items: [
            { src: cap('a30-fraud.mp4'), from: 12.7, crop: { x: 860, y: 140, w: 630, h: 390 }, label: 'The controller: Waiting for me', enter: 'whip-r' },
            { src: repo(`${CRS}/iphone-biz-fraud-dark.png`), frame: 'tilt', tiltY: -13, label: 'iOS simulator: the controller\'s phone', cue: 'with', color: 'amber', enter: 'drop' }] } }] },
    // Slot: the flight recorder, on the APP-1043 task.
    { insert: 'flight-recorder', hold: 0.5, v: { type: 'shot', frame: 'window', src: cap('frd.mp4'), from: 20.8, crop: { x: 240, y: 110, w: 1500, h: 840 }, enter: 'whip-r', note: 'Replay of a scripted task · made-up company',
        lt: { kicker: 'Flight recorder · the APP-1043 task', title: 'Replay it step by step', t: 0.3, dur: 3.6 },
        marks: [{ cue: 'step', kind: 'arrow', x: 0.093, y: 0.098, w: 0.06, h: 0.03, dx: 260, dy: 170, color: 'amber' }] } },
    // 6. The fraudster argues, stamped REFUSED; the tally rolls to 9 of 9; the case page held in code.
    { hold: 0.5, parts: [
        { v: { type: 'exhibit', size: 84, enter: 'slide-up', rot: -1, label: 'THE FRAUDSTER ARGUES · SCRIPTED TEST', lines: [{ text: '"The CEO already approved."', cue: 'ceo' }],
            stamp: { text: 'REFUSED', cue: 'approved', off: 0.25, color: 'blocked', x: 0.66, y: 0.78, rot: -7, size: 96 } } },
        { cue: 'in', v: { type: 'scoreboard', size: 260, kicker: 'THE FRAUDSTER ARGUES · SCRIPTED TEST', items: [{ n: '9', of: '9', label: 'attempts to get an approval were refused in code', cue: 'scripted', color: 'done' }],
            source: 'Scripted test, same steps every take · demo-crs.ts', sourceAt: { cue: 'scripted' }, srcTop: 640 } },
        { cue: 'refused', v: { type: 'shot', frame: 'tilt', src: cap('crs-case-top.png'), enter: 'flip', tiltY: 12,
            marks: [{ at: 0.3, kind: 'box', x: 0.0458, y: 0.2203, w: 0.9446, h: 0.1275, color: 'blocked' }] } }] },
    // 7. The unexpected part: a whole operating system for this.
    { hold: 0.7, v: { type: 'end', lines: ['We built a whole operating system for this', 'gurtos.com', 'github.com/benz16107/calhacks13', 'Open source, Apache-2.0'] } },
  ],
};
