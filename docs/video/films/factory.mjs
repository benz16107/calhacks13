// Factory: Droid, made safe (tracks/factory.md). One beat per narration paragraph. Real Droid with Claude: the Oct 24 run's screenshots.
const cap = (f) => `cap:${f}`, repo = (f) => `repo:${f}`;
const SCRIPTED = 'Scripted agent: same steps every take';
const F = 'showcase/src/assets/track/factory/';
const TASK = repo(F + 'task-done.png');
const APP = repo(F + 'app-top.png');
const REPLAY = repo(F + 'replay-approved-dark.png');
const REVIEW = repo('showcase/src/assets/repo/personal/14-review.png');

export default {
  title: 'GurtOS for Factory: Droid, made safe',
  edition: 'server',
  maxDur: 90,
  music: 'bed-tense-long.wav',
  card: { sponsor: 'Factory', track: 'Droid SDK', editions: ['server', 'personal'] },
  beats: [
    // 1. The sourced incident, nothing stronger than the sources say. Under it, the real box stopping a key hunt (scripted agent).
    { hold: 0.9, parts: [
        { v: { type: 'clip', src: cap('ar03.mp4'), from: 8.6, note: SCRIPTED, moves: [{ at: 4.2, s: 1.5, px: 0.36, py: 0.62, d: 0.8 }],
            lt: { kicker: 'Nx packages, August 2025', title: "Malicious packages started the AI tools on developers' machines" } } },
        { cue: 'with', v: { type: 'lines', size: 54, kicker: 'Nx packages, August 2025', lines: [
            { text: 'With permission-skipping flags', cue: 'permission' },
            { text: 'Told them to hunt for keys', cue: 'told' },
            { text: 'Wiz: it worked in hundreds of cases. Guardrails sometimes blocked it.', dim: true, cue: 'wiz' }],
          source: 'Sources: Wiz, Aug 27, 2025 · Nx advisory', sourceAt: { at: 0.3 } } }] },
    // 2. Real Droid with Claude: its own user and copy; the proxy adds the key; 240 of 240 samples.
    { parts: [
        { v: { type: 'stills', src: TASK, note: 'Real Droid with Claude Sonnet 5.5, Oct 24 run', moves: [
            { cue: 'droid', s: 2.1, px: 0.84, py: 0.58, d: 0.9 }, { cue: 'copy', s: 2.1, px: 0.84, py: 0.3, d: 0.8 }],
            lt: { kicker: 'Droid by Factory, running Claude', title: 'A real task: its own user, no internet' } } },
        { cue: 'and', v: { type: 'lines', size: 48, kicker: 'Merge gate, Oct 24 · real Droid with Claude', lines: [
            { text: 'The proxy adds the real key outside the task', cue: 'proxy' },
            { text: 'ok  all 240 process samples held only a placeholder key; no real key ever entered the task', mono: true, cue: 'two' }],
          source: 'Droid, running Claude as its own Linux user, edited the file in its own copy', sourceAt: { at: 0.3 } } }] },
    // 3. Triggers. T-FA-03 (a file dropped into a watched folder starts a task) is not captured: the five-trigger card only.
    // TODO cap:fa-trigger-file.mp4 (T-FA-03)
    { hold: 0.9, v: { type: 'lines', size: 54, kicker: 'Triggers we designed: each one starts a Droid task', lines: [
        { text: 'A schedule', cue: 'schedule' }, { text: 'A new file', cue: 'file' }, { text: 'A webhook', cue: 'webhook' },
        { text: 'An ASI:One chat', cue: 'asi' }, { text: 'A Jira label', cue: 'jira' }],
      source: 'Also: a GitHub issue labelled droid, and gurtos-exec', sourceAt: { at: 0.4 } } },
    // 4. Plan first, and the plan lands on the phone. The notice is a simulator image.
    { hold: 0.4, parts: [
        { v: { type: 'stills', src: APP, moves: [{ at: 0.3, s: 1.7, px: 0.5, py: 0.72, d: 0.8 }],
            lt: { kicker: 'Factory app', title: 'Plan first is on' } } },
        { cue: 'lands', v: { type: 'stills', h: 700, note: 'iOS simulator: the notice the box builds', items: [
            { src: repo(F + 'plan-phone.png'), device: 'phone', label: "Droid's real plan", at: 0.1 },
            { src: repo(F + 'iphone-plan-actions.png'), device: 'bare', hf: 0.65, label: 'Approve or Deny', at: 0.5 }] } }] },
    // 5. Coder, read-only reviewer, the diff, every step in the log, the cost.
    { hold: 0.5, parts: [
        { v: { type: 'stills', src: TASK, note: 'Real Droid with Claude, Oct 24 run', moves: [{ at: 0.3, s: 1.8, px: 0.35, py: 0.3, d: 0.8 }],
            lt: { kicker: 'A coder droid edits', title: 'A read-only reviewer droid checks' } } },
        { cue: 'checks', v: { type: 'stills', src: REPLAY, note: 'Real Droid, Oct 25 run', moves: [{ at: 0.2, s: 1.5, px: 0.55, py: 0.38, d: 0.8 }] } },
        { cue: 'cost', v: { type: 'stills', src: cap('factory-task-card.png') } }] },
    // Slot: the flight recorder. A live replay (scripted agent), then Keep or Undo on Personal.
    { insert: 'flight-recorder', hold: 1.0, parts: [
        { v: { type: 'clip', src: cap('fr.mp4'), from: 20.7, rate: 1.5, moves: [{ at: 0.1, s: 1.35, px: 0.5, py: 0.45, d: 0.8 }],
            lt: { kicker: SCRIPTED, title: 'Flight recorder: replay, step by step', t: 0.1 } } },
        { cue: 'then', v: { type: 'stills', src: REVIEW, note: 'A test task on Personal', moves: [{ at: 0.1, s: 2.0, px: 0.62, py: 0.3, d: 0.7 }] } }] },
    // 6. Autonomy levels the OS enforces; hooks are a convenience, and the card says so. T-FA-04 (a paused git push) is not captured.
    // TODO cap:fa-autonomy-hook.mp4 (T-FA-04)
    { hold: 1.0, parts: [
        { v: { type: 'stills', src: APP, moves: [{ cue: 'autonomy', s: 1.9, px: 0.5, py: 0.63, d: 0.8 }],
            lt: { kicker: 'Factory app · Limits', title: 'The OS enforces the level' } } },
        { cue: 'low', v: { type: 'clip', src: cap('ar03.mp4'), from: 13.0, moves: [{ at: 0.05, s: 1.5, px: 0.36, py: 0.64, d: 0.7 }],
            lt: { kicker: SCRIPTED, title: 'Other hosts: blocked and logged', t: 0.05 } } },
        { cue: 'hooks', off: 0.4, v: { type: 'lines', size: 54, kicker: 'Droid hooks: a convenience. The OS limits are the boundary.', lines: [
            { text: 'Hooks log each tool result', cue: 'log' }, { text: 'and pause risky commands', cue: 'pause' }],
          source: 'Paused: rm -rf, git push, sudo, npm publish, curl to sh', sourceAt: { at: 0.4 } } }] },
    // 7. Both editions, then the end card.
    { hold: 1.8, parts: [
        { v: { type: 'stills', src: repo('site/src/assets/home/server-screen.png'), lt: { kicker: 'GurtOS Server', title: 'Droid works while you are away', edition: 'server' } } },
        { cue: 'personal', v: { type: 'stills', src: REVIEW, note: 'A test task on Personal', moves: [{ at: 0.3, s: 2.0, px: 0.62, py: 0.3, d: 0.8 }],
            lt: { kicker: 'GurtOS Personal', title: 'Changes only on Keep', edition: 'personal' } } },
        { cue: 'gurt', v: { type: 'end', lines: ['gurtos.com', 'github.com/benz16107/calhacks13', 'Open source, Apache-2.0'] } }] },
  ],
};
