// Anthropic: Claude used well for solo developers who leave agents running (tracks/anthropic.md). One beat per narration paragraph.
// Format: a first-person story of one developer at home. Long holds, no wipes, no camera move except one zoom on the
// Claude line of the finished task. The box at rest at night opens it; words land on the voice; the limits stay up.
// The kit has no kinetic type, so "type on the wallpaper" is built from mark labels with an invisible stroke (`say`).
const cap = (f) => `cap:${f}`, repo = (f) => `repo:${f}`;
const SCRIPTED = 'Scripted agent: same steps every take';
const REAL = 'Real Claude through Droid, Oct 24 run';
const TASK = repo('showcase/src/assets/track/factory/task-done.png');
const REPLAY = repo('showcase/src/assets/track/factory/replay-approved-dark.png');
const REVIEW = repo('showcase/src/assets/repo/personal/14-review.png');

// A line of big type that lands on its word: a mark label (x, y are fractions of the 1920 x 1080 picture; the text
// starts about 44 px right of x) whose stroke is invisible.
const say = (cue, text, x, y, o = {}) => ({ [o.at != null ? 'at' : 'cue']: o.at ?? cue, off: o.off ?? -0.3, kind: 'underline', x, y, w: 0.001, h: 0.001, weight: 0,
  color: o.color ?? 'ink', label: text, side: 'right', labelW: o.w ?? 1000, size: o.size ?? 58 });

export default {
  title: 'GurtOS for Anthropic: a safe home for the agents you leave running',
  edition: 'personal',
  maxDur: 90,
  music: 'bed-home-long.wav',
  style: { bg: 'hills' },
  card: { sponsor: 'Anthropic', track: 'Claude used well for a specific group of people', editions: ['server', 'personal'] },
  beats: [
    // 1. The community and the lived problem, over the real box screen from the first second. The Censys number is a caption, not spoken.
    // Two cuts of the same quiet shot: the picture does not change, the type does.
    { parts: [
        { v: { type: 'shot', frame: 'full', src: cap('a01.mp4'), from: 1.0, enter: 'cut', marks: [
            { at: 0.0, kind: 'underline', x: 0.69, y: 0.07, w: 0.001, h: 0.001, weight: 0, color: 'accent', label: 'Solo developers who leave AI agents running at home. I am one.', side: 'right', labelW: 540, size: 34 },
            say('i', 'I leave agents running', 0.133, 0.43, { off: -0.1 }),
            say('job', 'Job-application bot', 0.133, 0.515),
            say('price', 'Price watchers', 0.133, 0.6),
            say('overnight', 'Overnight coding', 0.133, 0.685)] } },
        { cue: 'each', off: -0.25, v: { type: 'shot', frame: 'full', src: cap('a01.mp4'), from: 7.15, enter: 'cut',
            note: '21,639 OpenClaw instances were reachable from the internet · Censys, Jan 31, 2026',
            marks: [
              say('each', 'Each ran as me', 0.133, 0.43),
              say('keys', 'Keys in its environment', 0.133, 0.515),
              say('own', 'Its own output was the only record', 0.133, 0.6, { off: -0.5, size: 54 })] } }] },
    // 2. Claude inside Droid: own user, own copy, 240 of 240 samples held a placeholder. One zoom, on the Claude line.
    { parts: [
        { v: { type: 'shot', frame: 'window', src: TASK, enter: 'fade', caption: REAL, box: { cx: 960, cy: 430, w: 1480, h: 790 },
            lt: { kicker: 'Claude, inside Droid', title: 'A real task: its own user, no internet', t: 0.3, dur: 2.5 },
            moves: [{ cue: 'claude', s: 1.8, px: 0.85, py: 0.52, d: 0.9 }],
            marks: [
              { cue: 'claude', off: 0.5, kind: 'box', x: 0.6906, y: 0.642, w: 0.2494, h: 0.093, color: 'amber', weight: 4 },
              { cue: 'linux', kind: 'box', x: 0.6906, y: 0.455, w: 0.2494, h: 0.038, color: 'accent', weight: 4 },
              { cue: 'copy', kind: 'box', x: 0.69, y: 0.312, w: 0.249, h: 0.024, color: 'done', weight: 4 }] } },
        { cue: 'two', off: -0.2, v: { type: 'scoreboard', bg: 'night', kicker: 'A real Claude task · merge gate, Oct 24', size: 250, srcTop: 720, items: [
            { n: '240', of: '240', label: 'process samples of a real Claude task held only a placeholder key', cue: 'two', color: 'done' }],
          source: 'Merge gate, Oct 24, real Droid with Claude. The proxy adds the real key outside the task.', sourceAt: { at: 2.0 } } }] },
    // 3. The $0.12 fix (plan on the phone, finished task), then the three models and what each costs.
    { parts: [
        { v: { type: 'pair', items: [
            { src: repo('showcase/src/assets/track/factory/plan-phone.png'), frame: 'tilt', tiltY: 12, tiltX: 3, enter: 'fade', label: "Claude's plan, on my phone" },
            { src: repo('showcase/src/assets/track/factory/iphone-plan-actions.png'), frame: 'tilt', tiltY: -12, tiltX: 3, enter: 'slide-up', label: 'iOS simulator: nothing runs until Approve', at: 1.0, color: 'amber' }] } },
        { cue: 'cost', off: -0.6, v: { type: 'shot', frame: 'paper', src: TASK, crop: { x: 140, y: 118, w: 980, h: 100 }, box: { cx: 960, cy: 440, w: 1400, h: 200 }, enter: 'drop', rot: -1.2, caption: 'Real Claude, Oct 24',
            marks: [{ cue: 'twelve', kind: 'circle', x: 0.2755, y: 0.6, w: 0.163, h: 0.22, color: 'amber', label: 'A plan, a coder and a reviewer: twelve cents', side: 'below', labelW: 900 }] } },
        // T-AN-02 (three tasks side by side) is not captured: the numbers are the showcase page's, one run each.
        { cue: 'pick', off: -0.2, v: { type: 'ledger', bg: 'night', kicker: 'THE SAME TASK, THREE MODELS · one run each, Oct 24', rows: [
            { when: 'Haiku', what: 'claude-haiku-5-5', amount: '0.084¢', cue: 'haiku' },
            { when: 'Sonnet', what: 'claude-sonnet-5-5', amount: '1.31¢', cue: 'sonnet' },
            { when: 'Opus', what: 'claude-opus-5-5', amount: '3.25¢', cue: 'opus' }],
          source: 'Same task, one run each, Oct 24. Priced from token counts.', sourceAt: { at: 1.1 } } }] },
    // 4. Personal: the folder changes only on Keep. Keep is circled.
    { hold: 0.4, v: { type: 'shot', frame: 'full', src: REVIEW, enter: 'fade', note: 'A test task on GurtOS Personal',
        lt: { kicker: 'GurtOS Personal', title: 'My folder changes only on Keep', edition: 'personal', t: 0.3, dur: 3.0 },
        marks: [{ cue: 'keep', off: -0.2, kind: 'circle', x: 0.6984, y: 0.2537, w: 0.061, h: 0.0315, color: 'amber' }] } },
    // Slot: the flight recorder. Live replay (scripted agent), then the real Claude task in Replay, then Keep or Undo.
    { insert: 'flight-recorder', hold: 0.5, parts: [
        { v: { type: 'shot', frame: 'full', src: cap('fr.mp4'), from: 20.7, rate: 1.8, enter: 'cut', note: SCRIPTED,
            lt: { kicker: 'Flight recorder', title: 'Replay, step by step', t: 0.3, dur: 2.0 } } },
        { cue: 'with', off: -0.8, v: { type: 'shot', frame: 'paper', src: REPLAY, enter: 'drop', rot: 1.2, note: 'Real Claude, Oct 25 run',
            box: { cx: 960, cy: 440, w: 1300, h: 812 },
            marks: [
              { cue: 'files', kind: 'box', x: 0.361, y: 0.384, w: 0.619, h: 0.079, color: 'done', weight: 5 },
              { cue: 'approvals', kind: 'box', x: 0.074, y: 0.523, w: 0.267, h: 0.038, color: 'amber', weight: 5 }] } },
        { cue: 'then', off: -0.2, v: { type: 'shot', frame: 'window', src: REVIEW, enter: 'fade', note: 'A test task on Personal',
            marks: [
              { cue: 'keep', kind: 'circle', x: 0.6984, y: 0.2537, w: 0.061, h: 0.0315, color: 'amber' },
              { cue: 'undo', kind: 'circle', x: 0.641, y: 0.2537, w: 0.0536, h: 0.0315, color: 'blocked' }] } }] },
    // 5. The Haiku second look, with its admitted gap. T-AN-03 (the Second look line in a task) is not captured.
    { hold: 1.4, v: { type: 'exhibit', bg: 'hills', enter: 'fade', rot: -0.6, label: 'SECOND LOOK · a Haiku check compares a risky step with my goal', lines: [
        { text: '28 of 28 injected steps called off goal', cue: 'risky' },
        { text: '0 of 22 ordinary steps', cue: 'compares' },
        { text: 'Inconsistent on one case', cue: 'inconsistent', mark: true },
        { text: 'It passed a README download in other runs', dim: true, at: 5.3, mark: true }],
      source: "Own test: the 26 steps were written by the check's builder.", sourceAt: { at: 3.0 } } },
    // 6. The published attack test, with its limits marked in amber and on screen for the whole beat.
    { hold: 2.2, v: { type: 'exhibit', bg: 'hills', enter: 'fade', rot: 0.6, size: 44, label: 'THE PUBLISHED ATTACK TEST · real Claude, Sonnet 5.5 and Haiku 5.5', lines: [
        { text: '72 attack runs, 0 where harm happened', cue: 'published' },
        { text: '12 attacks, 2 clean controls, 3 saved runs', dim: true, cue: 'runs' },
        { text: 'Most runs: Claude never tried', cue: 'mostly', mark: true },
        { text: 'The same person wrote the attacks', at: 4.6, mark: true },
        { text: 'and the detectors', at: 5.6, mark: true },
        { text: 'One run per setting', at: 6.3, mark: true }] } },
    // 7. The MCP server and the phone. T-AN-04 (a real Claude Code session) is not captured: a card, then the devices.
    { hold: 1.7, parts: [
        // TODO cap:an-mcp.mp4 (T-AN-04, Claude Code listing, starting, reading and undoing a task through the MCP server)
        { v: { type: 'lines', kicker: 'For Claude Code and Claude Desktop', lines: [
            { text: 'The GurtOS MCP server', cue: 'claude' }, { text: 'Start, read, undo, approve', dim: true, cue: 'box' }] } },
        { cue: 'answer', v: { type: 'caseboard', bg: 'hills', note: "Apple's simulators. Mac menu drawn by the app.",
            items: [
              { kind: 'photo', src: repo('showcase/src/assets/track/anthropic/iphone-request-dark.png'), frame: 'tilt', tiltY: 14, tiltX: 4, x: 400, y: 110, w: 300, rot: 0, enter: 'slide-up', caption: 'iPhone', cue: 'answer' },
              { kind: 'photo', src: repo('showcase/src/assets/track/anthropic/watch-8-and-42.png'), frame: 'tilt', tiltY: 0, tiltX: 4, x: 940, y: 300, w: 620, rot: 0, enter: 'slide-up', caption: 'Apple Watch', cue: 'from' },
              { kind: 'photo', src: repo('showcase/src/assets/track/anthropic/mac-menu-dark.png'), frame: 'tilt', tiltY: -14, tiltX: 4, x: 1530, y: 300, w: 520, rot: 0, enter: 'slide-up', caption: 'Mac menu bar', cue: 'phone' }] } }] },
    // 8. One install script, one key, then the end card.
    { hold: 3.3, parts: [
        { v: { type: 'terminal', title: 'Ubuntu 24.04, plus one model key. Measured in a QEMU VM.', enter: 'fade', size: 38, lines: [
            { text: 'curl -fsSL .../tracks/anthropic/install.sh | sudo sh', cmd: true, cue: 'one', off: -0.3 },
            { text: 'Measured: 1 GB of RAM, one task at a time', kind: 'ok', at: 1.9 }] } },
        { cue: 'source', off: 0.45, v: { type: 'end', lines: ['gurtos.com', 'github.com/benz16107/gurtos', 'Open source, Apache-2.0'] } }] },
  ],
};
