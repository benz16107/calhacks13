// SpacetimeDB: the live nervous system (tracks/spacetime.md). Format: a live multiplayer film, many screens at once, each
// named by a hand-drawn callout. Live recordings: a02-desktop and a02-phone (moment 3, the same take on two screens), a30
// (Rosa's request), a33 (Audit). Real screenshots: the Live board and its Agents and Computers tabs. No slots are listed.
// TODO cap:st-claims.mp4 (T-ST-01, the claim check running), cap:st-visibility.mp4 (T-ST-02, three clients),
// cap:st-late-answer.mp4 (T-ST-03, the refused stranger): not recorded; the counts are a text card from docs/story.md.
// No camera move anywhere in this video. Positions in `marks` are fractions of each crop.
const cap = (f) => `cap:${f}`, repo = (f) => `repo:${f}`;
const SCRIPTED = 'Scripted agent: same steps every take';

export default {
  title: 'GurtOS for SpacetimeDB: the live nervous system',
  edition: 'business',
  maxDur: 90,
  music: 'bed-multiplayer-long.wav',
  style: { bg: 'grid' },
  card: { sponsor: 'SpacetimeDB', track: 'The core real-time backend', editions: ['server', 'personal', 'business'] },
  beats: [
    // 1. The problem, over the real Live board (the product is on screen from the first word); its words ride in the
    // footnote while the callouts name the box, the board and the line that says it updates instantly.
    { hold: 0.4, v: { type: 'shot', frame: 'full', src: cap('st-live.png'), crop: { x: 0, y: 0, w: 2000, h: 1125 }, enter: 'cut', note: 'Usually: a database, a websocket server, a cache, sign-in glue',
        marks: [{ cue: 'database', kind: 'circle', x: 0.055, y: 0.0089, w: 0.091, h: 0.0258, color: 'accent', label: 'The box', side: 'below', labelW: 220 },
          { cue: 'cache', kind: 'circle', x: 0.161, y: 0.2987, w: 0.059, h: 0.0356, color: 'amber', label: 'The Live board', side: 'right', labelW: 380 },
          { cue: 'ordinary', kind: 'underline', x: 0.1395, y: 0.1333, w: 0.2855, h: 0.016, color: 'done' }] } },
    // 2. One self-hosted SpacetimeDB on each box; every screen sees the same request at the same moment (the same take
    // on the box screen and the owner's phone). The phone's tap and the box's "Already approved" toast land together.
    { hold: 0.6, v: { type: 'shot', frame: 'full', src: cap('a02-desktop.mp4'), from: 4, crop: { x: 0, y: 0, w: 1440, h: 810 }, enter: 'whip-l',
        lt: { kicker: 'GurtOS · one SpacetimeDB on each box', title: 'The same request, on every screen', edition: 'server', t: 0.2, dur: 3.6 },
        pip: { src: cap('a02-phone.mp4'), from: 10.9, cue: 'every', w: 300, corner: 'bl', enter: 'slide-up', label: 'A paired phone', color: 'amber' },
        marks: [{ cue: 'request', kind: 'box', x: 0.697, y: 0.0543, w: 0.282, h: 0.2123, color: 'accent', label: 'The box screen', side: 'left', labelW: 340 },
          { at: 9.5, kind: 'circle', x: 0.71, y: 0.2025, w: 0.267, h: 0.042, color: 'done' }] } },
    // 3. Atomic claim: 3 agents, 15 claims, 12 jobs, 12 distinct, none twice.
    { hold: 0.8, parts: [
        { v: { type: 'shot', frame: 'window', src: cap('st-agents.png'), enter: 'whip-l', note: SCRIPTED,
            marks: [{ cue: 'transaction', kind: 'underline', x: 0.142, y: 0.34, w: 0.46, h: 0.03, color: 'accent' }] } },
        { cue: 'three', v: { type: 'scoreboard', bg: 'night', kicker: 'THE CLAIM, ONE AT A TIME', size: 150, srcTop: 580, items: [
            { n: '3', label: 'agents', at: 0.1, color: 'accent' },
            { n: '15', label: 'claims', cue: 'fifteen', color: 'accent' },
            { n: '12', label: 'jobs', cue: 'twelve', color: 'amber' },
            { n: '12', label: 'different jobs, none twice', cue: 'different', color: 'done' }],
          source: `${SCRIPTED} · docs/story.md`, sourceAt: { at: 0.4 } } }] },
    // 4. Row-level visibility: Rosa's request is routed to her (A30, live); Priya and a stranger get nothing.
    { hold: 1.0, parts: [
        { v: { type: 'shot', frame: 'window', src: cap('a30.mp4'), from: 12.0, crop: { x: 340, y: 0, w: 1580, h: 920 }, enter: 'whip-r',
            lt: { kicker: 'GurtOS Business', title: 'A request routed to Rosa', t: 0.2, dur: 2.6 },
            marks: [{ cue: 'rosa', kind: 'circle', x: 0.826, y: 0.005, w: 0.13, h: 0.024, color: 'accent', label: 'Rosa, Controller', side: 'below', labelW: 320 },
              { cue: 'routed', kind: 'box', x: 0.337, y: 0.168, w: 0.354, h: 0.036, color: 'amber' }] } },
        { cue: 'priya', off: -0.2, v: { type: 'ledger', bg: 'night', kicker: 'The same box, the same moment', rows: [
            { when: 'Rosa', what: 'Phone: her request', status: 'Sees it', at: 0.1 },
            { when: 'Priya', what: 'Phone: nothing', status: 'Nothing', statusKind: 'blocked', cue: 'priya' },
            { when: 'Stranger', what: 'Anywhere: nothing', status: 'Nothing', statusKind: 'blocked', cue: 'stranger' }] } }] },
    // 5. First answer wins (the box screen's real toast, circled); recorded under the vouched name; a stranger is refused.
    { hold: 0.6, parts: [
        { v: { type: 'shot', frame: 'window', src: cap('a02-desktop.mp4'), from: 11.9, crop: { x: 760, y: 20, w: 680, h: 380 }, enter: 'whip-r', note: 'Scripted task · test money',
            lt: { kicker: 'GurtOS · SpacetimeDB reducer', title: 'The first answer wins', t: 0.2, dur: 2.4 },
            marks: [{ cue: 'late', kind: 'circle', x: 0.385, y: 0.379, w: 0.565, h: 0.09, color: 'done', until: { at: 3.6 } }] } },
        { cue: 'answer', after: 'refused', v: { type: 'shot', frame: 'full', src: cap('a33.mp4'), from: 6.0, enter: 'whip-l',
            lt: { kicker: 'GurtOS Business · Audit', title: 'Recorded under the name the box vouched for', t: 0.2, dur: 3.4 },
            marks: [{ cue: 'name', kind: 'circle', x: 0.8646, y: 0.0037, w: 0.1, h: 0.024, color: 'accent', label: 'Owen Clarke, Auditor', side: 'below', labelW: 440 }] } },
        { cue: 'stranger', v: { type: 'ledger', bg: 'night', kicker: 'Answering as someone else', rows: [
            { when: 'Answer as', what: "A stranger's identity", at: 0.2 }],
          stamp: { text: 'REFUSED', cue: 'refused', after: 'identity', color: 'blocked', box: 'frame', x: 0.5, y: 0.5, rot: -7, size: 120 } } }] },
    // 6. Timer, live meters, the Maincloud fleet view off by default.
    { hold: 0.6, parts: [
        { v: { type: 'exhibit', bg: 'night', label: 'IN THE DATABASE', size: 60, lines: [{ text: 'A timer can bring a second person in', mark: true, at: 0.4 }] } },
        { cue: 'live', off: -0.2, v: { type: 'shot', frame: 'window', src: cap('st-agents.png'), enter: 'slide-up', note: 'Meters match the lists',
            marks: [{ cue: 'meters', kind: 'box', x: 0.0164, y: 0.071, w: 0.157, h: 0.16, color: 'accent' },
              { cue: 'list', kind: 'underline', x: 0.343, y: 0.64, w: 0.07, h: 0.04, color: 'amber' }] } },
        { cue: 'maincloud', off: -0.2, v: { type: 'shot', frame: 'tilt', src: cap('st-computers.png'), enter: 'flip', tiltY: -9, note: 'Off by default: counts only',
            marks: [{ cue: 'off', kind: 'circle', x: 0.938, y: 0.586, w: 0.04, h: 0.07, color: 'amber', label: 'Off', side: 'left', labelW: 120 },
              { cue: 'counts', kind: 'underline', x: 0.027, y: 0.61, w: 0.577, h: 0.03, color: 'done' }] } }] },
    // 7. Open source; end card.
    { hold: 3.0, v: { type: 'end', lines: ['gurtos.com', 'github.com/benz16107/gurtos', 'Open source, Apache-2.0'] } },
  ],
};
