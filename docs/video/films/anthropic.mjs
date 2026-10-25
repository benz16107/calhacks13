// Anthropic: Claude used well for solo developers who leave agents running (tracks/anthropic.md). One beat per narration paragraph.
const cap = (f) => `cap:${f}`, repo = (f) => `repo:${f}`;
const SCRIPTED = 'Scripted agent: same steps every take';
const REAL = 'Real Claude through Droid, Oct 24 run';
const TASK = repo('showcase/src/assets/track/factory/task-done.png');
const REPLAY = repo('showcase/src/assets/track/factory/replay-approved-dark.png');
const REVIEW = repo('showcase/src/assets/repo/personal/14-review.png');

export default {
  title: 'GurtOS for Anthropic: a safe home for the agents you leave running',
  edition: 'personal',
  maxDur: 90,
  music: 'bed-hopeful-long.wav',
  card: { sponsor: 'Anthropic', track: 'Claude used well for a specific group of people', editions: ['server', 'personal'] },
  beats: [
    // 1. The community and the lived problem, over the real box screen from the first second. The Censys number is a caption, not spoken.
    { parts: [
        { v: { type: 'clip', src: cap('a01.mp4'), from: 1.0, moves: [{ at: 0.3, s: 1.5, px: 0.3, py: 0.3, d: 1.0 }],
            lt: { kicker: 'Solo developers who leave AI agents running at home. I am one.', title: 'Job applications, price watchers, overnight coding', dur: 5.6 } } },
        { cue: 'each', v: { type: 'clip', src: cap('a01.mp4'), from: 7.2, moves: [{ at: 0.05, s: 1.5, px: 0.3, py: 0.3, d: 0.01 }],
            note: '21,639 OpenClaw instances were reachable from the internet · Censys, Jan 31, 2026',
            lt: { kicker: 'Each ran as me', title: 'Keys in its environment. Its own output was the only record.', t: 0.2, dur: 5.6 } } }] },
    // 2. Claude inside Droid: own user, own copy, 240 of 240 samples held a placeholder.
    { parts: [
        { v: { type: 'stills', src: TASK, note: REAL, moves: [{ cue: 'claude', s: 2.1, px: 0.84, py: 0.58, d: 0.9 }],
            lt: { kicker: 'Claude, inside Droid', title: 'A real task: its own user, no internet' } } },
        { cue: 'copy', v: { type: 'layers', kicker: 'Each task: its own copy-on-write layer', layers: [
            { user: 'box-7q4m2k', task: 'Write the weekly notes', files: 'notes.md', at: 0.1 },
            { user: 'box-k2xd9r', task: 'Rename the photo folders', files: 'photos/', at: 0.4 },
            { user: 'box-r8tn4w', task: 'Find me a road bike', files: 'bikes.md', at: 0.7 }] } },
        { cue: 'two', v: { type: 'stats', cols: 1, size: 150, items: [{ n: '240 of 240', label: 'process samples of a real Claude task held only a placeholder key', at: 0.2 }],
            source: 'Merge gate, Oct 24, real Droid with Claude. The proxy adds the real key outside the task.', srcTop: 520 } }] },
    // 3. The $0.12 fix (plan on the phone, finished task), then the three models and what each costs.
    { parts: [
        { v: { type: 'stills', h: 700, note: 'iOS simulator: the notice the box builds', items: [
            { src: repo('showcase/src/assets/track/factory/plan-phone.png'), device: 'phone', label: "Claude's plan, on my phone", at: 0.1 },
            { src: repo('showcase/src/assets/track/factory/iphone-plan-actions.png'), device: 'bare', hf: 0.65, label: 'Nothing runs until Approve', at: 0.8 }] } },
        { cue: 'cost', off: -0.6, v: { type: 'stills', src: TASK, note: 'Real Claude, Oct 24', moves: [{ at: 0.3, s: 2.0, px: 0.23, py: 0.21, d: 0.8 }],
            lt: { kicker: 'Sonnet 5.5, Oct 24', title: '$0.12 of a $1.00 budget' } } },
        // T-AN-02 (three tasks side by side) is not captured: the numbers are the showcase page's, one run each.
        { cue: 'pick', v: { type: 'stats', cols: 3, size: 110, items: [
            { n: '0.084¢', label: 'Haiku · claude-haiku-5-5', cue: 'haiku' }, { n: '1.31¢', label: 'Sonnet · claude-sonnet-5-5', cue: 'sonnet' }, { n: '3.25¢', label: 'Opus · claude-opus-5-5', cue: 'opus' }],
            source: 'Same task, one run each, Oct 24. Priced from token counts.', sourceAt: { at: 0.4 }, srcTop: 430 } }] },
    // 4. Personal: the folder changes only on Keep.
    { hold: 0.4, v: { type: 'stills', src: REVIEW, note: 'A test task on GurtOS Personal', moves: [{ cue: 'keep', s: 2.0, px: 0.62, py: 0.3, d: 0.8 }],
        lt: { kicker: 'GurtOS Personal', title: 'My folder changes only on Keep', edition: 'personal' } } },
    // Slot: the flight recorder. Live replay (scripted agent), then the real Claude task in Replay, then Keep or Undo.
    { insert: 'flight-recorder', hold: 0.5, parts: [
        { v: { type: 'clip', src: cap('fr.mp4'), from: 20.7, rate: 1.8, note: SCRIPTED, moves: [{ at: 0.1, s: 1.35, px: 0.5, py: 0.45, d: 0.8 }],
            lt: { kicker: 'Flight recorder', title: 'Replay, step by step' } } },
        { cue: 'with', off: -0.8, v: { type: 'stills', src: REPLAY, note: 'Real Claude, Oct 25 run', moves: [{ at: 0.1, s: 1.55, px: 0.6, py: 0.34, d: 0.7 }] } },
        { cue: 'then', v: { type: 'stills', src: REVIEW, moves: [{ at: 0.1, s: 2.0, px: 0.62, py: 0.3, d: 0.7 }], note: 'A test task on Personal' } }] },
    // 5. The Haiku second look, with its admitted gap. T-AN-03 (the Second look line in a task) is not captured.
    { hold: 1.4, v: { type: 'lines', size: 56, kicker: 'Second look: a Haiku check compares a risky step with my goal', lines: [
        { text: '28 of 28 injected steps called off goal', cue: 'haiku' },
        { text: '0 of 22 ordinary steps', cue: 'goal' },
        { text: 'Inconsistent on one case: it passed a README download in other runs', blocked: true, cue: 'inconsistent' }],
        source: "Own test: the 26 steps were written by the check's builder.", sourceAt: { at: 3.0 } } },
    // 6. The published attack test, with its limits on screen for the whole beat.
    { hold: 2.2, v: { type: 'lines', size: 54, kicker: 'The published attack test · real Claude, Sonnet 5.5 and Haiku 5.5', lines: [
        { text: '72 attack runs, 0 where harm happened', cue: 'seventy' },
        { text: '12 attacks, 2 clean controls, 3 saved runs', dim: true, cue: 'runs' },
        { text: 'Most runs: Claude never tried', blocked: true, cue: 'mostly' },
        { text: 'The same person wrote the attacks and the detectors', blocked: true, at: 5.2 },
        { text: 'One run per setting', blocked: true, at: 5.9 }] } },
    // 7. The MCP server and the phone. T-AN-04 (a real Claude Code session) is not captured: a card, then the devices.
    { hold: 1.7, parts: [
        // TODO cap:an-mcp.mp4 (T-AN-04, Claude Code listing, starting, reading and undoing a task through the MCP server)
        { v: { type: 'lines', kicker: 'For Claude Code and Claude Desktop', lines: [
            { text: 'The GurtOS MCP server', cue: 'claude' }, { text: 'Start, read, undo, approve', dim: true, cue: 'box' }] } },
        { cue: 'answer', v: { type: 'stills', h: 700, note: "Apple's simulators. Mac menu drawn by the app.", items: [
            { src: repo('showcase/src/assets/track/anthropic/iphone-request-dark.png'), device: 'phone', label: 'iPhone', cue: 'answer' },
            { src: repo('showcase/src/assets/track/anthropic/watch-8-and-42.png'), device: 'bare', hf: 0.5, label: 'Apple Watch', cue: 'from' },
            { src: repo('showcase/src/assets/track/anthropic/mac-menu-dark.png'), device: 'bare', hf: 0.55, label: 'Mac menu bar', cue: 'phone' }] } }] },
    // 8. One install script, one key, then the end card.
    { hold: 2.8, parts: [
        { v: { type: 'lines', size: 48, kicker: 'On Ubuntu 24.04, plus one model key. Measured in a QEMU VM.', lines: [
            { text: 'curl -fsSL .../tracks/anthropic/install.sh | sudo sh', mono: true, at: 0.2 },
            { text: 'Measured: 1 GB of RAM, one task at a time', dim: true, at: 0.9 }] } },
        { cue: 'open', v: { type: 'end', lines: ['gurtos.com', 'github.com/benz16107/calhacks13', 'Open source, Apache-2.0'] } }] },
  ],
};
