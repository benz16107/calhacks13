// Hyphenate: Autonomous Systems for Finance (tracks/hyphenate.md). Format: a case file. APP-1043 is the suspect; the
// credit desk's own screens are the evidence, circled and stamped instead of zoomed. Same narration and facts as v1.
// Shares the credit desk recordings with CRS and Microsoft. Positions in `marks` are fractions of each crop.
const cap = (f) => `cap:${f}`, repo = (f) => `repo:${f}`;
const SHOW = 'track/hyphenate';
const QUICK = 'Quick run: scripted seats, live CRS sandbox';
const MADE_UP = 'Made-up company · sandbox data';

export default {
  title: 'GurtOS for Hyphenate: the credit desk',
  edition: 'business',
  maxDur: 90,
  music: 'bed-noir-long.wav',
  style: { bg: 'board' },
  card: { sponsor: 'Hyphenate', track: 'Autonomous Systems for Finance', editions: ['business'] },
  beats: [
    // 1. The case: APP-1043 on the desk, live. The applicant is circled, the simple rule underlined, then the CRS
    // findings circled on the analyst's card and the alert; the nine checks land on a timeline; FRAUD HOLD, CONFIRMED.
    { hold: 0.3, parts: [
        { v: { type: 'shot', frame: 'full', src: cap('hy.mp4'), from: 6.4, rate: 0.25, crop: { x: 330, y: 300, w: 1280, h: 720 }, enter: 'cut', note: QUICK,
            lt: { kicker: 'Fogline Supply, a made-up wholesaler', title: 'Case APP-1043', t: 0.2, dur: 5.6 },
            marks: [
              { cue: 'applicant', kind: 'box', x: 0.012, y: 0.672, w: 0.3, h: 0.042, color: 'amber', label: 'The applicant: score 640', side: 'right', labelW: 560 },
              { cue: 'simple', kind: 'underline', x: 0.335, y: 0.672, w: 0.06, h: 0.04, color: 'blocked', label: 'A simple rule: approve $20,000', side: 'below', labelW: 640 }] } },
        { cue: 'our', v: { type: 'shot', frame: 'full', src: cap('hy.mp4'), from: 8.2, rate: 0.8, crop: { x: 320, y: 40, w: 1600, h: 900 }, enter: 'whip-l', note: QUICK,
            marks: [
              { cue: 'live', kind: 'box', x: 0.025, y: 0.625, w: 0.235, h: 0.066, color: 'accent', label: 'Checked live with CRS', side: 'below', labelW: 460 },
              { cue: 'identity', kind: 'circle', x: 0.735, y: 0.098, w: 0.23, h: 0.024, color: 'blocked', label: 'Identity fails', side: 'left', labelW: 330 },
              { cue: 'fraud', kind: 'circle', x: 0.866, y: 0.121, w: 0.084, h: 0.022, color: 'blocked', label: 'Fraud score 88', side: 'left', labelW: 330 }] } },
        { cue: 'nine', v: { type: 'timeline', bg: 'board', from: 'Aug 19', to: 'Sep 12', dots: [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1], step: 0.14,
            label: 'credit checks in three weeks', at: 0.15, count: 9, source: 'CRS sandbox, live: TransUnion, Equifax and Experian inquiries' } },
        { cue: 'put', v: { type: 'shot', frame: 'tilt', src: cap('a30-fraud.mp4'), from: 12.7, crop: { x: 340, y: 90, w: 1240, h: 830 }, enter: 'whip-l',
            box: { cx: 960, cy: 468, w: 1300, h: 820 }, stamp: { text: 'FRAUD HOLD', cue: 'hold', x: 0.66, y: 0.42 } } },
        { cue: 'controller', v: { type: 'shot', frame: 'paper', src: repo(`showcase/src/assets/${SHOW}/replay-approved-dark.png`), crop: { x: 40, y: 40, w: 1200, h: 675 }, enter: 'drop', rot: -1.4,
            box: { cx: 960, cy: 440, w: 1300, h: 731 },
            marks: [{ at: 0.1, kind: 'underline', x: 0.427, y: 0.237, w: 0.19, h: 0.035, color: 'done' }],
            stamp: { text: 'CONFIRMED', cue: 'confirmed', color: 'done', x: 0.7, y: 0.62, rot: 6 } } }] },
    // 2. Exhibit A: the FTC on Equifax.
    { hold: 0.4, v: { type: 'exhibit', label: 'EXHIBIT A · FTC press release, July 22, 2019', lines: [
        { text: 'Equifax, 2017', cue: 'equifax' },
        { text: 'Admin credentials in a plain-text file', cue: 'admin', mark: true },
        { text: '145.5 million Social Security numbers', dim: true, cue: 'plain' }],
      source: 'ftc.gov', sourceAt: { cue: 'file' } } },
    // 3. The desk, on the board: the real Settings recording, a card per seat, strings to the controller, then the
    // analyst's own Linux user on its task.
    { post: 0.35, hold: 0.15, v: { type: 'caseboard', kicker: 'THE DESK · Fogline Supply (made-up)', note: MADE_UP,
        items: [
          { id: 'set', kind: 'photo', src: cap('a31-settings.png'), crop: { x: 740, y: 90, w: 740, h: 600 }, x: 470, y: 150, w: 640, rot: -1.5, at: 0.05, caption: 'Settings · People and agent seats' },
          { id: 'an', kind: 'card', label: 'AGENT SEAT', title: 'Credit analyst', lines: ['Up to $10,000 alone', 'Above that, it proposes'], x: 1010, y: 140, w: 320, rot: 1.5, cue: 'three' },
          { id: 'co', kind: 'card', label: 'AGENT SEAT', title: 'Collections clerk', lines: ["Can't change limits or terms"], x: 1360, y: 120, w: 320, rot: -2, cue: 'agent' },
          { id: 'ap', kind: 'card', label: 'AGENT SEAT', title: 'AP clerk', lines: ['Checks supplier bills'], x: 1710, y: 150, w: 300, rot: 2, cue: 'seats' },
          { id: 'ro', kind: 'card', label: 'HUMAN · CONTROLLER', title: 'Rosa Delgado', lines: ['Clears fraud flags', 'Approves up to $50,000'], x: 1360, y: 430, w: 360, rot: -1, cue: 'human' },
          { id: 'usr', kind: 'photo', src: repo(`showcase/src/assets/${SHOW}/analyst-crs-live.png`), crop: { x: 60, y: 70, w: 640, h: 140 }, x: 650, y: 735, w: 760, rot: 1, cue: 'each',
            marks: [{ cue: 'linux', kind: 'box', x: 0.672, y: 0.114, w: 0.25, h: 0.15, color: 'blocked' }] }],
        strings: [{ from: 'an', to: 'ro', cue: 'beside' }, { from: 'co', to: 'ro', cue: 'beside', off: 0.2 }, { from: 'ap', to: 'ro', cue: 'beside', off: 0.4 }, { from: 'an', to: 'usr', cue: 'linux', sag: 40 }],
        stamps: [{ text: 'NO PASSWORDS', cue: 'passwords', box: 'frame', x: 0.79, y: 0.74, rot: -6, size: 64 }] } },
    // 4. Separation of duties: each seat's limits (tilted), then a split: the $40,000 request routed with its rule, and
    // the controller's own request waiting for someone else.
    { hold: 0.35, post: 0.35, parts: [
        { v: { type: 'shot', frame: 'tilt', src: cap('a31.mp4'), from: 1.2, crop: { x: 680, y: 520, w: 800, h: 380 }, enter: 'flip', note: MADE_UP, tiltY: 12,
            marks: [{ at: 0.15, kind: 'box', x: 0.03, y: 0.06, w: 0.92, h: 0.36, color: 'amber', label: 'Its own limits', side: 'below', labelW: 400 }] } },
        { cue: 'analyst', v: { type: 'pair', note: MADE_UP, items: [
            { src: cap('a30.mp4'), from: 13.5, crop: { x: 820, y: 120, w: 700, h: 600 }, label: 'The analyst asks for $40,000',
              marks: [{ cue: 'forty', kind: 'circle', x: 0.075, y: 0.12, w: 0.17, h: 0.05, color: 'amber' },
                { cue: 'rule', kind: 'box', x: 0.078, y: 0.27, w: 0.845, h: 0.17, color: 'accent', label: 'To the controller, with the rule', side: 'below', labelW: 520 }] },
            { src: cap('a32.mp4'), from: 13.2, crop: { x: 340, y: 590, w: 460, h: 330 }, label: "Rosa's own request", cue: 'nobody', color: 'amber',
              marks: [{ cue: 'own', kind: 'box', x: 0.052, y: 0.62, w: 0.81, h: 0.26, color: 'blocked' }] }],
          stamps: [{ text: 'NOT HER OWN', cue: 'request', box: 'frame', x: 0.77, y: 0.22, rot: -7, size: 60 }] } }] },
    // Slot: agent permissions: the core's refusal in Activity.
    { insert: 'permissions', hold: 0.3, v: { type: 'shot', frame: 'window', src: repo(`showcase/src/assets/${SHOW}/perm-blocked.png`), crop: { x: 20, y: 40, w: 1560, h: 780 }, enter: 'wipe-down',
        lt: { kicker: 'Activity · Blocked', title: 'The OS refused it, and logged it', t: 0.2 },
        marks: [{ cue: 'enforces', kind: 'box', x: 0.158, y: 0.105, w: 0.837, h: 0.04, color: 'blocked' },
          { cue: 'permissions', kind: 'underline', x: 0.168, y: 0.846, w: 0.59, h: 0.023, color: 'amber', label: 'Allow, Deny or revoke in Settings', side: 'above', labelW: 600 }] } },
    // 5. The record: the analyst's decision with its rules, data and approver circled; the auditor's view slides in.
    { hold: 0.3, v: { type: 'shot', frame: 'paper', src: repo(`showcase/src/assets/${SHOW}/analyst-decision.png`), crop: { x: 80, y: 140, w: 1000, h: 560 }, enter: 'drop', rot: 1.2,
        box: { cx: 900, cy: 450, w: 1380, h: 773 },
        lt: { kicker: "The analyst's log · APP-1043", title: 'One append-only log', t: 0.2, dur: 4.2 },
        marks: [{ cue: 'rules', kind: 'underline', x: 0.8, y: 0.16, w: 0.098, h: 0.036, color: 'amber', label: 'Rules', side: 'below', labelW: 200 },
          { cue: 'data', kind: 'circle', x: 0.166, y: 0.493, w: 0.14, h: 0.036, color: 'amber', label: 'Data', side: 'right', labelW: 160 },
          { cue: 'approver', kind: 'circle', x: 0.254, y: 0.577, w: 0.22, h: 0.036, color: 'amber', label: 'Approver', side: 'right', labelW: 220 }],
        pip: { src: cap('a33.mp4'), from: 12.4, crop: { x: 210, y: 80, w: 1500, h: 850 }, cue: 'ready', w: 640, corner: 'br', label: 'Owen Clarke, auditor: read-only', color: 'accent' } } },
    // Slot: the flight recorder, on the analyst's APP-1043 task.
    { insert: 'flight-recorder', hold: 0.3, v: { type: 'shot', frame: 'window', src: cap('frd.mp4'), from: 20.8, crop: { x: 240, y: 110, w: 1500, h: 840 }, enter: 'whip-r', note: MADE_UP,
        lt: { kicker: "Flight recorder · the analyst's APP-1043 task", title: 'Replay it, step by step', t: 0.3, dur: 3.6 },
        marks: [{ cue: 'step', kind: 'arrow', x: 0.093, y: 0.098, w: 0.06, h: 0.03, dx: 260, dy: 170, color: 'amber' }] } },
    // 6. The verdict: the live run's score on rolling tiles; Bring your own; the end card.
    { hold: 1.65, parts: [
        { v: { type: 'scoreboard', kicker: 'THE VERDICT · full live run bd5c61, Oct 24 · real Droid on Claude', at: 0, items: [
            { n: '16', of: '17', label: 'planted errors caught', cue: 'sixteen', color: 'done' },
            { n: '1', label: 'false alarm', cue: 'one', color: 'amber' },
            { n: '6', of: '6', label: 'credit decisions right', cue: 'six', after: 'alarm', color: 'done' }],
          source: '12 min, about $5.24 · scored against the answer key', sourceAt: { cue: 'sixteen' } } },
        { cue: 'bring', v: { type: 'shot', frame: 'paper', src: repo(`showcase/src/assets/${SHOW}/desk-bring-your-own.png`), enter: 'drop', rot: -1.2,
            box: { cx: 960, cy: 450, w: 1100, h: 760 } } },
        { cue: 'gurt', v: { type: 'end', lines: ['gurtos.com', 'github.com/benz16107/gurtos', 'Open source, Apache-2.0'] } }] },
  ],
};
