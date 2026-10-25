// Elastic: a record nobody can rewrite (tracks/elastic.md). Format: questions typed, real answers fill in. A question
// comes first (typed in a terminal, or the real chat's own question), a short pause, then the answer drops in with a
// downward wipe. Kibana shots are the real Oct 24 screenshots cropped (no project name, no account menu) with the machine
// id blurred, as studio/assets/capture/el-*.png. The `receipts` slot is not merged, so it is left out. No camera moves.
const cap = (f) => `cap:${f}`;
const DEMO = "Demo run, the agent's own answer · Oct 24";

export default {
  title: 'GurtOS for Elastic: a record nobody can rewrite',
  edition: 'server',
  maxDur: 90,
  music: 'bed-data-long.wav',
  style: { bg: 'grid' },
  card: { sponsor: 'Elastic', track: 'Agent Builder on Serverless', editions: ['server', 'business'] },
  beats: [
    // 1. The question, over the real action log (the product is on screen from the first word).
    { hold: 0.4, v: { type: 'shot', frame: 'full', src: cap('a08.mp4'), from: 4.6, crop: { x: 150, y: 46, w: 1620, h: 911 }, enter: 'cut',
        lt: { kicker: 'GurtOS Activity: the real log', title: 'What did the agents do this week?', t: 0.3, dur: 6.6 } } },
    // 2. The log, typed as a terminal: what goes in, then the chain: each entry holds the one before; an edit breaks it.
    { hold: 1.5, v: { type: 'terminal', title: 'one action log', bg: 'night', enter: 'cut', size: 36,
        lines: [
          { text: 'What goes into the log?', cmd: true, at: 0.2 },
          { text: 'step', kind: 'out', cue: 'step' },
          { text: 'cost', kind: 'out', cue: 'cost' },
          { text: 'approval', kind: 'out', cue: 'approval' },
          { text: 'block', kind: 'out', cue: 'block' },
          { text: 'Each entry holds the SHA-256 of the one before', cmd: true, cue: 'each' },
          { text: 'entry 1 · prev: SHA-256 of the entry above', kind: 'out', cue: 'previous' },
          { text: 'entry 2 · prev: SHA-256 of entry 1', kind: 'out', cue: 'hash' },
          { text: 'entry 3 · prev: SHA-256 of entry 2', kind: 'out', cue: 'so' },
          { text: 'entry 3 edited: every link after it fails', kind: 'bad', cue: 'breaks' }],
        alarms: [{ cue: 'breaks' }] } },
    // 3. Elastic's copy (the real dashboard drops in), then the create-only key: overwrite, update and delete get 403.
    // TODO cap:elastic-403.mp4 (T-EL-02, the terminal): not recorded, a terminal of the same three answers stands in.
    { hold: 0.8, parts: [
        { v: { type: 'shot', frame: 'window', src: cap('el-dash.png'), enter: 'wipe-down',
            marks: [{ cue: 'elastic', kind: 'box', x: 0.022, y: 0.006, w: 0.2, h: 0.026, color: 'accent', label: 'The copy, on Elastic Serverless', side: 'right', labelW: 700 }] } },
        { cue: 'with', v: { type: 'terminal', title: 'box', bg: 'night', enter: 'wipe-down', size: 40,
            lines: [
              { text: 'What can the box key do?', cmd: true, at: 0.1 },
              { text: 'Create: allowed', kind: 'ok', cue: 'creates' },
              { text: 'Overwrite: 403', kind: 'bad', cue: 'overwrite' },
              { text: 'Update: 403', kind: 'bad', cue: 'update' },
              { text: 'Delete: 403', kind: 'bad', cue: 'delete' }],
            stamp: { text: '403', cue: 'four', color: 'blocked', x: 0.8, y: 0.62, rot: -7, size: 110 } } }] },
    // 4. The planted edit: the box's own chain looks clean (left); Elastic's copy names entries 466 to 474 (right, real shot).
    // The entry numbers are underlined on their words and enlarged in an inset; then the count.
    { hold: 1.7, parts: [
        { v: { type: 'pair', note: 'Demo run · Oct 24', items: [
            { src: cap('el-log-top.png'), label: "The box's own chain: looks clean" },
            { src: cap('el-tamper.png'), label: "Elastic's copy: the agent's own answer", cue: 'elastic', color: 'amber',
              marks: [
                { cue: 'sixtysix', kind: 'underline', x: 0.125, y: 0.388, w: 0.04, h: 0.046, color: 'amber' },
                { cue: 'seventyfour', kind: 'underline', x: 0.474, y: 0.388, w: 0.044, h: 0.046, color: 'amber' }] }],
          pip: { src: cap('el-tamper-numbers.png'), cue: 'sixtysix', w: 1100, corner: 'br', label: 'Edited entry numbers', color: 'amber' } } },
        { at: 10.3, v: { type: 'scoreboard', bg: 'grid', kicker: "Elastic's copy · demo run", size: 190, items: [
            { n: '9', label: 'entries edited, 466 to 474', color: 'blocked', at: 0.1 },
            { n: '0', label: "missing from Elastic's copy", color: 'done', at: 0.4 }] } }] },
    // 5. The question the agent was asked (the real chat), a pause, then its answer drops in and the blocked site is underlined.
    { hold: 0.8, parts: [
        { v: { type: 'shot', frame: 'window', src: cap('el-routine-q.png'), enter: 'slide-up', note: DEMO,
            marks: [{ cue: 'why', kind: 'underline', x: 0.07, y: 0.165, w: 0.215, h: 0.055, color: 'accent' }] } },
        { cue: 'box', v: { type: 'shot', frame: 'window', src: cap('el-routine-a.png'), enter: 'wipe-down', note: DEMO,
            marks: [
              { cue: 'blocked', kind: 'underline', x: 0.511, y: 0.036, w: 0.287, h: 0.076, color: 'blocked' },
              { cue: 'never', kind: 'underline', x: 0.529, y: 0.14, w: 0.162, h: 0.076, color: 'blocked', label: 'Never allowed', side: 'right', labelW: 360 }] } }] },
    // 6. A request becomes one approval (the Business screen, live); who keeps what, as two screens; the limit footnote stays up.
    // TODO cap:elastic-alert.mp4 (T-EL-05, a box-requests row, then the phone): not recorded, A30's routed approval stands in.
    { hold: 2.5, parts: [
        { v: { type: 'shot', frame: 'window', src: cap('a30.mp4'), from: 12.2, enter: 'whip-l', note: 'Caught, not prevented: an entry edited seconds before Elastic has it is not caught',
            lt: { kicker: 'The same approval path, on GurtOS Business', title: 'A request waits for the person who may answer', t: 0.3, dur: 3.8 },
            marks: [{ cue: 'approval', kind: 'box', x: 0.612, y: 0.472, w: 0.151, h: 0.042, color: 'accent', label: 'One approval', side: 'below', labelW: 380 }] } },
        { cue: 'os', v: { type: 'pair', note: 'Caught, not prevented: an entry edited seconds before Elastic has it is not caught', items: [
            { src: cap('el-log-blocked.png'), label: 'The OS: the log, and the power to act' },
            { src: cap('el-dash.png'), label: 'Elastic: the copy', cue: 'elastic', color: 'amber' }] } },
        { cue: 'gurt', v: { type: 'end', lines: ['gurtos.com', 'github.com/benz16107/calhacks13', 'Open source, Apache-2.0'] } }] },
  ],
};
