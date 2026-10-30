// Factory: Droid, made safe (tracks/factory.md). One beat per narration paragraph. Real Droid with Claude: the Oct 24 run's screenshots.
// Format: a code review of Droid's own work. Review notes and hand-drawn boxes on the real task, the diff checked line by
// line, downward wipes like a diff scrolling, one zoom (on the diff). The kit has no bottom timeline overlay, so the
// plan-approve-code-review-keep dots are not drawn; the beats follow that order instead.
const cap = (f) => `cap:${f}`, repo = (f) => `repo:${f}`;
const SCRIPTED = 'Scripted agent: same steps every take';
const F = 'showcase/src/assets/track/factory/';
const TASK = repo(F + 'task-done.png');
const APP = repo(F + 'app-top.png');
const REPLAY = repo(F + 'replay-approved-dark.png');
const REVIEW = repo('showcase/src/assets/repo/personal/14-review.png');

// A review note: a pill with an invisible stroke, landing on its word. x, y are fractions of the 1920 x 1080 picture.
const note = (cue, text, x, y, o = {}) => ({ cue, off: o.off ?? -0.3, kind: 'underline', x, y, w: 0.001, h: 0.001, weight: 0, color: o.color ?? 'amber',
  label: text, side: 'right', labelW: o.w ?? 1000, size: o.size ?? 44 });

export default {
  title: 'GurtOS for Factory: Droid, made safe',
  edition: 'server',
  maxDur: 90,
  music: 'bed-code-long.wav',
  style: { bg: 'grid' },
  card: { sponsor: 'Factory', track: 'Droid SDK', editions: ['server', 'personal'] },
  beats: [
    // 1. The sourced incident, nothing stronger than the sources say. Under it, the real Droid task, full-bleed, with a review note per claim.
    { hold: 0.9, v: { type: 'shot', frame: 'full', src: TASK, enter: 'cut',
        note: 'Sources: Wiz, Aug 27, 2025 · Nx advisory',
        lt: { kicker: 'Nx packages, August 2025', title: "Malicious packages started the AI tools on developers' machines", t: 0.3, dur: 6.8 },
        marks: [
          note('permission', 'With permission-skipping flags', 0.17, 0.44),
          note('told', 'Told them to hunt for keys', 0.17, 0.54, { color: 'blocked' }),
          note('wiz', 'Wiz: it worked in hundreds of cases. Guardrails sometimes blocked it.', 0.17, 0.64, { color: 'accent', w: 1100 })] } },
    // 2. Real Droid with Claude: its own user and copy; the proxy adds the key; 240 of 240 samples.
    { parts: [
        { v: { type: 'shot', frame: 'window', src: TASK, enter: 'wipe-down', note: 'Real Droid with Claude Sonnet 5.5, Oct 24 run',
            marks: [
              { cue: 'droid', kind: 'box', x: 0.6906, y: 0.642, w: 0.2494, h: 0.093, color: 'accent', weight: 5, label: 'Claude, inside Droid', side: 'left', labelW: 420 },
              { cue: 'linux', kind: 'box', x: 0.6906, y: 0.455, w: 0.2494, h: 0.038, color: 'amber', weight: 5, label: 'Its own Linux user', side: 'left', labelW: 420 },
              { cue: 'key', kind: 'box', x: 0.6906, y: 0.5, w: 0.2494, h: 0.038, color: 'blocked', weight: 5, label: 'Sites it may reach: none', side: 'left', labelW: 520 }] } },
        { cue: 'two', off: -0.2, v: { type: 'scoreboard', kicker: 'Merge gate, Oct 24 · real Droid with Claude', size: 250, srcTop: 760, items: [
            { n: '240', of: '240', label: 'process samples held only a placeholder key; no real key ever entered the task', cue: 'two', color: 'done' }],
          source: 'The proxy adds the real key outside the task.', sourceAt: { at: 1.0 } } }] },
    // 3. Triggers. T-FA-03 (a file dropped into a watched folder starts a task) is not captured: the five triggers are typed in a terminal.
    // TODO cap:fa-trigger-file.mp4 (T-FA-03)
    { hold: 0.9, v: { type: 'terminal', title: 'Triggers we designed: each one starts a Droid task', size: 40, enter: 'wipe-down', lines: [
        { text: 'schedule', cmd: true, cue: 'schedule' },
        { text: 'new file', cmd: true, cue: 'new' },
        { text: 'webhook', cmd: true, cue: 'webhook' },
        { text: 'ASI:One chat', cmd: true, cue: 'asi' },
        { text: 'Jira label', cmd: true, cue: 'jira' },
        { text: 'Also: a GitHub issue labelled droid, and gurtos-exec', kind: 'out', cue: 'label' }] } },
    // 4. Plan first, and the plan lands on the phone. The notice is a simulator image. APPROVED lands on "approve".
    { hold: 0.4, parts: [
        { v: { type: 'shot', frame: 'window', src: APP, enter: 'wipe-down', marks: [
            { cue: 'plans', off: -0.2, kind: 'box', x: 0.242, y: 0.676, w: 0.516, h: 0.074, color: 'amber', weight: 6, label: 'Plan first is on', side: 'left', labelW: 420 }] } },
        { cue: 'lands', v: { type: 'pair', items: [
            { src: repo(F + 'plan-phone.png'), frame: 'tilt', tiltY: 12, tiltX: 3, enter: 'cut', label: "Droid's real plan", color: 'accent' },
            { src: repo(F + 'iphone-plan-actions.png'), frame: 'tilt', tiltY: -12, tiltX: 3, enter: 'slide-up', at: 0.5, label: 'iOS simulator: Approve or Deny', color: 'amber' }],
          stamp: { text: 'APPROVED', cue: 'approve', color: 'done', x: 0.5, y: 0.78, rot: -6, size: 84 } } }] },
    // 5. Coder, read-only reviewer, the diff, every step in the log, the cost. One zoom, on the diff.
    { hold: 0.5, parts: [
        { v: { type: 'shot', frame: 'full', src: REPLAY, crop: { x: 0, y: 50, w: 1600, h: 900 }, enter: 'wipe-down', note: 'Real Droid, Oct 25 run',
            moves: [{ cue: 'diff', s: 1.7, px: 0.68, py: 0.43, d: 0.8 }],
            marks: [
              { cue: 'coder', kind: 'box', x: 0.361, y: 0.371, w: 0.619, h: 0.088, color: 'amber', weight: 5, label: "The coder's change", side: 'below', labelW: 420, until: { cue: 'read' } },
              { cue: 'reviewer', kind: 'box', x: 0.361, y: 0.371, w: 0.619, h: 0.088, color: 'done', weight: 5, label: 'A read-only reviewer droid checks it', side: 'below', labelW: 700, until: { cue: 'diff' } },
              { cue: 'diff', kind: 'underline', x: 0.361, y: 0.408, w: 0.619, h: 0.021, color: 'blocked', weight: 5, label: 'Removed', side: 'above', labelW: 260 },
              { cue: 'diff', off: 0.4, kind: 'underline', x: 0.361, y: 0.43, w: 0.619, h: 0.021, color: 'done', weight: 5, label: 'Added', side: 'below', labelW: 260 }] } },
        { cue: 'cost', v: { type: 'shot', frame: 'paper', src: cap('factory-task-card.png'), enter: 'wipe-down', box: { cx: 960, cy: 420, w: 1500, h: 400 }, rot: -1.0, marks: [
            { at: 0.3, kind: 'box', x: 0.027, y: 0.607, w: 0.155, h: 0.107, color: 'done', weight: 4, label: 'Every step is in the log', side: 'right', labelW: 700 },
            { cue: 'token', kind: 'circle', x: 0.618, y: 0.296, w: 0.171, h: 0.12, color: 'amber', weight: 4, label: "Droid's own token counts", side: 'below', labelW: 600 }] } }] },
    // Slot: the flight recorder. A live replay (scripted agent), then Keep or Undo on Personal.
    { insert: 'flight-recorder', hold: 1.0, parts: [
        { v: { type: 'shot', frame: 'tilt', src: cap('fr.mp4'), from: 20.7, rate: 1.5, crop: { x: 240, y: 105, w: 1500, h: 840 }, enter: 'wipe-down',
            lt: { kicker: SCRIPTED, title: 'Flight recorder: replay, step by step', t: 0.1 } } },
        { cue: 'then', v: { type: 'shot', frame: 'window', src: REVIEW, enter: 'cut', box: { cx: 960, cy: 430, w: 1480, h: 790 }, caption: 'A test task on Personal', marks: [
            { cue: 'keep', kind: 'circle', x: 0.6984, y: 0.2537, w: 0.061, h: 0.0315, color: 'amber' },
            { cue: 'undo', kind: 'circle', x: 0.641, y: 0.2537, w: 0.0536, h: 0.0315, color: 'blocked' }] } }] },
    // 6. Autonomy levels the OS enforces; hooks are a convenience, and the card says so. T-FA-04 (a paused git push) is not captured.
    // TODO cap:fa-autonomy-hook.mp4 (T-FA-04)
    { hold: 1.0, parts: [
        { v: { type: 'shot', frame: 'window', src: APP, enter: 'wipe-down', note: SCRIPTED, marks: [
            { cue: 'autonomy', kind: 'box', x: 0.242, y: 0.609, w: 0.516, h: 0.06, color: 'amber', weight: 6, label: 'The OS enforces the level', side: 'above', labelW: 460 }],
          pip: { src: cap('ar03.mp4'), from: 13.0, crop: { x: 250, y: 165, w: 1420, h: 680 }, cue: 'low', w: 780, corner: 'br', label: 'Other hosts: blocked and logged', color: 'blocked', frame: 'window', enter: 'slide-up',
            marks: [{ cue: 'network', kind: 'box', x: 0.023, y: 0.67, w: 0.652, h: 0.032, color: 'blocked', weight: 5 }] } } },
        { cue: 'hooks', off: 0.3, v: { type: 'terminal', title: 'Droid hooks: a convenience. The OS limits are the boundary.', size: 40, enter: 'wipe-down',
            alarms: [{ cue: 'risky' }], lines: [
            { text: 'Hooks log each tool result', kind: 'ok', cue: 'log' },
            { text: 'and pause risky commands', kind: 'warn', cue: 'pause' },
            { text: 'Paused: rm -rf, git push, sudo, npm publish, curl to sh', kind: 'out', cue: 'risky', off: 0.2 }] } }] },
    // 7. Both editions, then the end card. Server on the left, Personal wipes in on its word.
    { hold: 1.8, parts: [
        { v: { type: 'pair', items: [
            { src: repo('site/src/assets/home/server-screen.png'), frame: 'window', enter: 'wipe-down', label: 'GurtOS Server: Droid works while you are away', color: 'accent' },
            { src: REVIEW, frame: 'window', enter: 'wipe', cue: 'personal', label: 'GurtOS Personal: changes only on Keep', color: 'amber',
              marks: [{ cue: 'keep', kind: 'circle', x: 0.6984, y: 0.2537, w: 0.061, h: 0.0315, color: 'amber', weight: 6 }] }] } },
        { cue: 'gurt', v: { type: 'end', lines: ['gurtos.com', 'github.com/benz16107/gurtos', 'Open source, Apache-2.0'] } }] },
  ],
};
