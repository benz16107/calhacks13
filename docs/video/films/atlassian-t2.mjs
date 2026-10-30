// Atlassian Track 2: undo only the wrong part (tracks/atlassian-t2.md). Format: a night incident review. BOX-29 is the case
// file: its screenshots are underlined and spotlit, the Jira issue, the Confluence page, the Service Management request
// and the log are pinned to a board and joined by string (the audit trail), and the rollback ends on a match cut and a
// ROLLED BACK stamp. Real Jira, Confluence, JSM and Rovo screenshots (tracks/jira/screenshots). Same narration and facts
// as v1. `marks` positions are fractions of each crop, measured on the real images.
const cap = (f) => `cap:${f}`, repo = (f) => `repo:${f}`;
const J = 'tracks/jira/screenshots/';
const SCRIPTED = 'Scripted agent: same steps every take';
const RED = '#d9503a'; // marks on the light Jira pages need a darker red than the palette's salmon

export default {
  title: 'GurtOS for Atlassian: undo only the wrong part',
  edition: 'business',
  maxDur: 90,
  music: 'bed-noir-long.wav',
  style: { bg: 'night' },
  card: { sponsor: 'Atlassian', track: 'Agentic Workforce Challenge, Track 2: security for agents acting for a user', editions: ['business'] },
  beats: [
    // 1. BOX-29 as the box wrote it: the three config writes and the paste-site fetch underlined as the voice names them,
    // the refusal spotlit and the one zoom on its line (20:47:22 UTC).
    { pre: 0.2, post: 0.2, v: { type: 'shot', frame: 'paper', src: cap('t2-issue-ask.png'), box: { cx: 960, cy: 440, w: 1560, h: 760 }, enter: 'fade', rot: -0.8,
        caption: 'BOX-29 in Jira · ' + SCRIPTED,
        moves: [{ cue: 'site', s: 1.8, px: 0.45, py: 0.95, d: 0.8 }],
        marks: [
          { cue: 'changed', kind: 'underline', x: 0.084, y: 0.0904, w: 0.4058, h: 0.0308, color: RED },
          { cue: 'three', kind: 'underline', x: 0.084, y: 0.125, w: 0.3957, h: 0.0308, color: RED },
          { cue: 'configs', kind: 'underline', x: 0.084, y: 0.1596, w: 0.3826, h: 0.0308, color: RED },
          { cue: 'paste', kind: 'underline', x: 0.084, y: 0.196, w: 0.6406, h: 0.0308, color: RED },
          { cue: 'site', kind: 'spot', x: 0.0406, y: 0.9423, w: 0.858, h: 0.0385, until: { cue: 'undo' } }] } },
    // 2. "Runs as you" and the rest struck through in type; then a task's own Linux user, with its own copy of the files circled.
    { pre: 0.2, post: 0.2, parts: [
        { v: { type: 'lines', strike: true, hills: false, kicker: 'On an ordinary computer', lines: [
            { text: 'The agent runs as you', cue: 'agent' }, { text: 'With your keys', cue: 'with' }, { text: 'On shared files', cue: 'shared' }] } },
        { cue: 'gurt', off: -0.2, v: { type: 'shot', frame: 'window', src: cap('a06.mp4'), from: 4, crop: { x: 260, y: 176, w: 1400, h: 660 }, enter: 'whip-l', note: SCRIPTED,
            lt: { kicker: 'Same core in Server and Business', title: 'Each task: its own Linux user', t: 0.3, dur: 2.4 },
            marks: [{ cue: 'linux', kind: 'circle', x: 0.8036, y: 0.5242, w: 0.1679, h: 0.0303, color: 'blocked' },
              { cue: 'copy', kind: 'box', x: 0.6964, y: 0.3, w: 0.2821, h: 0.0545, color: 'amber' }] } }] },
    // 3. The issue written from the box's log; the paste upload refused, stamped BLOCKED.
    { pre: 0.2, post: 0.2, parts: [
        { v: { type: 'shot', frame: 'paper', src: cap('t2-wait-top.png'), enter: 'slide-up', rot: 1, box: { cx: 960, cy: 440, w: 1560, h: 760 }, caption: "BOX-29, written from the box's own log",
            marks: [{ cue: 'issue', kind: 'underline', x: 0.0145, y: 0.0143, w: 0.2072, h: 0.0257, color: RED },
              { cue: 'log', kind: 'box', x: 0.014, y: 0.479, w: 0.972, h: 0.507, color: RED }] } },
        { cue: 'network', off: -0.2, v: { type: 'shot', frame: 'paper', src: cap('t2-issue-allowed.png'), enter: 'drop', rot: -1.2, box: { cx: 960, cy: 440, w: 1560, h: 760 }, caption: SCRIPTED,
            marks: [{ cue: 'rules', kind: 'underline', x: 0.0754, y: 0.9, w: 0.823, h: 0.05, color: RED }],
            stamp: { text: 'BLOCKED', cue: 'refused', off: 0.1, color: 'blocked', x: 0.72, y: 0.42, rot: -8, size: 100 } } }] },
    // Slot: the flight recorder replays a scripted task step by step.
    { insert: 'flight-recorder', pre: 0.2, post: 0.2, v: { type: 'shot', frame: 'window', src: cap('fr.mp4'), from: 11.5, rate: 1.6, enter: 'wipe', note: 'Flight recorder replay · ' + SCRIPTED } },
    // 4. The board: the Jira issue, the Confluence page, the JSM request and the log, joined by string as each is named;
    // ends on the role check (the people picker) in the merge gate.
    { pre: 0.2, post: 0.2, parts: [
        { v: { type: 'caseboard', kicker: 'BOX-29 · THE AUDIT TRAIL',
            items: [
              { id: 'box', kind: 'photo', src: cap('t2-wait-top.png'), crop: { x: 0, y: 0, w: 690, h: 340 }, caption: 'BOX-29 in Jira', x: 500, y: 110, w: 640, rot: -1.5, at: 0.3 },
              { id: 'conf', kind: 'photo', src: cap('t2-incident-top.png'), crop: { x: 140, y: 20, w: 540, h: 200 }, caption: 'The Confluence incident page', x: 1380, y: 120, w: 640, rot: 1.4, cue: 'confluence' },
              { id: 'jsm', kind: 'photo', src: repo(J + 'jsm-approval.png'), crop: { x: 0, y: 30, w: 1140, h: 330 }, caption: 'The Jira Service Management request', x: 1380, y: 520, w: 700, rot: -1, cue: 'push' },
              { id: 'log', kind: 'photo', src: cap('t2-audit-approved.png'), caption: 'The log names who approved', x: 500, y: 520, w: 640, rot: 1.2, cue: 'and' }],
            strings: [{ from: 'box', to: 'conf', cue: 'confluence', off: 0.3, sag: 50 }, { from: 'box', to: 'jsm', cue: 'push', off: 0.3, sag: 90 }, { from: 'box', to: 'log', cue: 'log', off: 0.3, sag: 40 }] } },
        { cue: 'in', after: 'approved', v: { type: 'shot', frame: 'full', src: cap('a31.mp4'), from: 4.2, enter: 'wipe', note: 'Merge gate, with Jira stand-ins',
            lt: { kicker: 'GurtOS Business', title: "The company's role must allow it too", t: 0.3, dur: 2.8 },
            marks: [{ cue: 'role', kind: 'spot', x: 0.8448, y: 0.0352, w: 0.1198, h: 0.1778 }] } }] },
    // Slot: permissions, shown as the real refusals only.
    { insert: 'permissions', pre: 0.2, post: 0.2, parts: [
        { v: { type: 'shot', frame: 'window', src: cap('t2-perm-blocked.png'), crop: { x: 270, y: 25, w: 1300, h: 170 }, enter: 'wipe-down', caption: 'Credit desk, same core: refused by the OS',
            marks: [{ cue: 'enforces', kind: 'box', x: 0.4538, y: 0.03, w: 0.5385, h: 0.15, color: 'blocked' }] } },
        { cue: 'like', off: -0.1, v: { type: 'shot', frame: 'window', src: repo('showcase/src/assets/track/crs/perm-audit.png'), crop: { x: 190, y: 120, w: 800, h: 210 }, enter: 'wipe', caption: 'Credit desk, same core: in the audit log',
            marks: [{ cue: 'allow', kind: 'underline', x: 0.64, y: 0.4667, w: 0.3525, h: 0.0857, color: 'amber', label: 'Allow, Deny or revoke', side: 'above', labelW: 520 },
              { at: 0.3, kind: 'circle', x: 0.4575, y: 0.4667, w: 0.1713, h: 0.0857, color: 'blocked' }] } }] },
    // 5. Roll back: the confirm, the night on a timeline with only the refusal dated, one layer out, then a match cut from the
    // diff to the undone state under a ROLLED BACK stamp.
    { pre: 0.2, post: 0.2, parts: [
        { v: { type: 'shot', frame: 'window', src: repo(J + 'rollback-confirm.png'), enter: 'fade',
            marks: [{ cue: 'task', kind: 'circle', x: 0.8036, y: 0.632, w: 0.1345, h: 0.143, color: RED }] } },
        { cue: 'forge', off: -0.1, v: { type: 'timeline', bg: 'night', from: '20:47:22 UTC', to: '', dots: [0, 0.06, 0.75, 1], step: 0.4, count: 4,
            label: 'moments, one dated', at: 0.3, source: "The box's audit log for BOX-29", color: 'blocked' } },
        { cue: 'then', off: -0.1, v: { type: 'layers', kicker: 'Roll back takes out one task layer', layers: [
            { user: 'Another task', task: 'Its own fix', files: 'its files', at: 0.05 },
            { user: 'This task', task: 'The retry rule', files: '3 configs', at: 0.2 }],
          undo: 1, undoAt: { cue: 'layer' } } },
        { cue: 'three', v: { type: 'shot', frame: 'paper', src: cap('t2-diff-rolled.png'), enter: 'cut', rot: -1, box: { cx: 960, cy: 470, w: 1100, h: 800 },
            marks: [{ cue: 'configs', kind: 'underline', x: 0.017, y: 0.105, w: 0.9, h: 0.04, color: RED }] } },
        { cue: 'every', v: { type: 'shot', frame: 'paper', src: cap('t2-undone.png'), enter: 'cut', rot: -1, box: { cx: 960, cy: 470, w: 1100, h: 800 }, caption: 'Undoes file changes, not messages already sent',
            stamp: { text: 'ROLLED BACK', cue: 'keeps', off: 0.1, color: 'done', box: 'frame', x: 0.5, y: 0.72, rot: -6, size: 96 } } }] },
    // 6. Rovo asks before it rolls back (a tilted card); one issue search rolls several issues back.
    { pre: 0.2, post: 0.2, parts: [
        { v: { type: 'shot', frame: 'tilt', src: cap('t2-rovo-confirm.png'), tiltY: -12, enter: 'flip',
            marks: [{ cue: 'asks', kind: 'box', x: 0.424, y: 0.905, w: 0.311, h: 0.0533, color: RED }] } },
        { cue: 'any', off: -0.2, v: { type: 'shot', frame: 'window', src: repo(J + 'bulk-report.png'), enter: 'wipe-down',
            marks: [{ cue: 'several', kind: 'circle', x: 0.321, y: 0.305, w: 0.164, h: 0.039, color: 'done' }] } }] },
    // 7. The dashboard gadget keeps score; two parts, both open source; the end card.
    { hold: 3, pre: 0.2, post: 0.2, parts: [
        { v: { type: 'shot', frame: 'tilt', src: repo(J + 'gadget.png'), tiltY: 12, enter: 'drop',
            marks: [{ cue: 'score', kind: 'underline', x: 0.036, y: 0.084, w: 0.91, h: 0.024, color: RED }] } },
        { cue: 'os', v: { type: 'lines', kicker: 'Two parts, both open source', lines: [
            { text: 'The OS: isolation, log, undo', cue: 'os' }, { text: 'The Forge app: panel, Rovo, bulk action, gadget', cue: 'forge' }] } },
        { cue: 'open', v: { type: 'end', lines: ['gurtos.com', 'github.com/benz16107/gurtos', 'Open source, Apache-2.0'] } }] },
  ],
};
