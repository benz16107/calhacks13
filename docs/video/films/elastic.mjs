// Elastic: a record nobody can rewrite (tracks/elastic.md). Kibana shots are the real Oct 24 screenshots from
// tracks/elastic/screenshots, cropped (no project name, no account menu) with the machine id blurred, as new files in
// studio/assets/capture/el-*.png. The `receipts` slot is not merged, so it is left out.
const cap = (f) => `cap:${f}`, repo = (f) => `repo:${f}`;
const DEMO = "Demo run, the agent's own answer · Oct 24";

export default {
  title: 'GurtOS for Elastic: a record nobody can rewrite',
  edition: 'server',
  maxDur: 90,
  music: 'bed-calm-long.wav',
  card: { sponsor: 'Elastic', track: 'Agent Builder on Serverless', editions: ['server', 'business'] },
  beats: [
    // 1. The problem, over the real box at rest (the product is on screen from the first word); G-EL-1's words ride in the lower third.
    { hold: 0.4, v: { type: 'clip', src: cap('a01.mp4'), from: 1.0, lt: { kicker: 'An ordinary computer cannot say what they did', title: 'Logs are scattered, and root can edit them', dur: 6.4 } } },
    // 2. One log on the OS (A08, live), then the hash chain: each entry holds the one before; an edit breaks it.
    { hold: 1.5, parts: [
        { v: { type: 'clip', src: cap('a08.mp4'), from: 4.6, lt: { kicker: 'GurtOS · one action log', title: 'Every step, cost, approval and block', edition: 'server' } } },
        { cue: 'each', v: { type: 'lines', size: 54, kicker: 'Each entry holds the SHA-256 of the one before', lines: [
            { text: 'entry 1 · prev: SHA-256 of the entry above', mono: true, cue: 'each' },
            { text: 'entry 2 · prev: SHA-256 of entry 1', mono: true, cue: 'previous' },
            { text: 'entry 3 · prev: SHA-256 of entry 2', mono: true, cue: 'hash' },
            { text: 'entry 3 edited: every link after it fails', mono: true, blocked: true, cue: 'breaks' }] } }] },
    // 3. Elastic keeps a copy with a create-only key; overwrite, update and delete get 403.
    // TODO cap:elastic-403.mp4 (T-EL-02, the terminal) and cap:elastic-box-actions.mp4 (T-EL-01, Kibana Discover): not recorded, a real dashboard and a text card stand in.
    { hold: 0.8, parts: [
        { v: { type: 'stills', src: cap('el-dash.png'), note: 'Kibana on Elastic Serverless: the copy of the log' } },
        { cue: 'overwrite', v: { type: 'lines', size: 76, kicker: 'The box key only creates documents', lines: [
            { text: 'Overwrite: 403', mono: true, blocked: true, cue: 'overwrite' },
            { text: 'Update: 403', mono: true, blocked: true, cue: 'update' },
            { text: 'Delete: 403', mono: true, blocked: true, cue: 'delete' }] } }] },
    // 4. The planted edit: the box's own chain looked clean; Elastic's copy named entries 466 to 474 (Agent Builder chat, real shot).
    { hold: 1.0, parts: [
        { v: { type: 'lines', size: 60, kicker: 'Demo: an edit planted as root would', lines: [
            { text: 'A planted edit, every later hash rewritten', cue: 'planted' },
            { text: "The box's own chain looks clean", cue: 'left' }] } },
        { cue: 'elastic', v: { type: 'stills', src: cap('el-tamper.png'), note: DEMO } }] },
    // 5. The agent investigates: the job routine failed because the box blocked a site it was never allowed to reach.
    { hold: 0.8, parts: [
        { v: { type: 'stills', src: cap('el-routine-q.png'), note: DEMO } },
        { cue: 'box', v: { type: 'stills', src: cap('el-routine-a.png'), note: DEMO } }] },
    // 6. A request becomes one approval (the Business screen, live); who keeps what; the limit footnote stays on screen.
    // TODO cap:elastic-alert.mp4 (T-EL-05, a box-requests row, then the phone): not recorded, A30's routed approval stands in.
    { hold: 2.5, parts: [
        { v: { type: 'clip', src: cap('a30.mp4'), from: 12.2, note: 'Caught, not prevented: an entry edited seconds before Elastic has it is not caught',
            moves: [{ cue: 'turns', s: 1.4, px: 0.6, py: 0.3, d: 0.8 }],
            lt: { kicker: 'The same approval path, on GurtOS Business', title: 'A request waits for the person who may answer' } } },
        { cue: 'os', v: { type: 'lines', kicker: 'Who keeps what', lines: [
            { text: 'The OS: the log, and the power to act', cue: 'os' },
            { text: 'Elastic: the copy', cue: 'elastic' }],
          source: 'Alert rules are Kibana alerting rules (ES|QL, every minute)', sourceAt: { at: 0.4 } } },
        { cue: 'gurt', v: { type: 'end', lines: ['gurtos.com', 'github.com/benz16107/calhacks13', 'Open source, Apache-2.0'] } }] },
  ],
};
