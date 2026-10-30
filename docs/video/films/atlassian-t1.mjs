// Atlassian Track 1: hand an issue to an agent (tracks/atlassian-t1.md). Real Jira, Confluence, JSM and Rovo screenshots (tracks/jira/screenshots), cropped where noted.
// Format: the agent as a teammate inside Jira. The film stays on Jira's own pages; each beat hands the issue to the next
// part of the team with a directional wipe, and hard cuts land on each click. One zoom, on the result comment.
// The kit has no kinetic type or typewriter header: the three ways to start are mark labels with an invisible stroke
// (`say`) over a dimmed Jira page, and the header is a lower third.
const cap = (f) => `cap:${f}`, repo = (f) => `repo:${f}`;
const J = 'tracks/jira/screenshots/';
const ISSUE = repo(J + 'started-from-issue.png');
const TASK = repo('showcase/src/assets/track/factory/task-done.png');
const SCRIPTED = 'Scripted agent: same steps every take';

// A line of big type that lands on its word (a mark label with no visible stroke). x, y are fractions of 1920 x 1080.
const say = (cue, text, x, y, o = {}) => ({ cue, off: o.off ?? -0.3, kind: 'underline', x, y, w: 0.001, h: 0.001, weight: 0, after: o.after,
  color: o.color ?? 'ink', label: text, side: 'right', labelW: o.w ?? 1000, size: o.size ?? 62 });

export default {
  title: 'GurtOS for Atlassian: hand an issue to an agent',
  edition: 'business',
  maxDur: 90,
  music: 'bed-team-long.wav',
  style: { bg: 'desk' },
  card: { sponsor: 'Atlassian', track: 'Agentic Workforce Challenge, Track 1: agents that do the work', editions: ['business'] },
  beats: [
    // 1. A teammate's issue, in Jira from the first second; its text can come from anyone. One underline on the word "anyone".
    { pre: 0.2, post: 0.2, parts: [
        { v: { type: 'shot', frame: 'full', src: ISSUE, crop: { x: 0, y: 0, w: 650, h: 366 }, enter: 'cut',
            lt: { kicker: 'PLAT-33510', title: 'A teammate files an issue for an agent', t: 0.2, dur: 2.6 } } },
        { cue: 'but', off: -0.1, v: { type: 'shot', frame: 'full', src: ISSUE, crop: { x: 0, y: 236, w: 650, h: 366 }, enter: 'cut',
            marks: [{ cue: 'anyone', kind: 'underline', x: 0.318, y: 0.333, w: 0.68, h: 0.158, color: 'amber', weight: 8, label: 'Text from anyone', side: 'below', labelW: 520, size: 42 }] } }] },
    // 2. Three ways to start; this one gets a label. The Jira page is dimmed under the type.
    // TODO: the real label being added (T-AT-08) and the Automation editor (T-AT-09) are not captured; the page behind is the issue.
    { pre: 0.2, post: 0.2, v: { type: 'shot', frame: 'full', src: ISSUE, crop: { x: 0, y: 284, w: 650, h: 366 }, enter: 'wipe', marks: [
        { at: 0, kind: 'spot', x: -0.3, y: 0.02, w: 0.001, h: 0.001 },
        say('label', 'A label', 0.2, 0.30),
        say('assignment', 'An assignment', 0.2, 0.42),
        say('run', 'A Run in GurtOS step in an Automation rule', 0.2, 0.54, { w: 1500, size: 54 }),
        say('this', 'Label: gurtos-agent', 0.2, 0.70, { color: 'amber', off: 0 }),
        { cue: 'label', after: 'this', kind: 'underline', x: 0.2208, y: 0.351, w: 0.1365, h: 0.001, color: 'amber', weight: 9 }] } },
    // 3. Its own Linux user, no keys, no network, twenty-five cents. The issue and the box's task side by side; a counter rolls to 25.
    { pre: 0.2, post: 0.2, parts: [
        { v: { type: 'pair', items: [
            { src: ISSUE, enter: 'wipe-down', label: 'The issue · PLAT-33510', color: 'accent' },
            { src: TASK, crop: { x: 1095, y: 170, w: 420, h: 500 }, enter: 'wipe', cue: 'as', label: 'A Droid task on the same core',
              marks: [
                { cue: 'user', kind: 'box', x: 0.024, y: 0.476, w: 0.95, h: 0.076, color: 'amber', weight: 5, label: 'Its own Linux user', side: 'above', labelW: 420 },
                { cue: 'keys', kind: 'box', x: 0.024, y: 0.562, w: 0.95, h: 0.15, color: 'blocked', weight: 5 }] }] } },
        { cue: 'twenty', off: -0.8, v: { type: 'scoreboard', kicker: 'The task starts with', size: 260, items: [{ n: '25', label: 'cents, the whole budget', at: 0.3, color: 'amber' }] } }] },
    // Slot: agent permissions, shown as the real refusals only.
    { insert: 'permissions', pre: 0.2, post: 0.2, parts: [
        { v: { type: 'shot', frame: 'window', src: cap('t2-perm-blocked.png'), enter: 'slide-up', box: { cx: 960, cy: 400, w: 1560, h: 400 }, caption: 'Credit desk, same core: refused by the OS',
            marks: [{ cue: 'enforces', kind: 'box', x: 0.165, y: 0.117, w: 0.82, h: 0.157, color: 'blocked', weight: 6 }] } },
        { cue: 'like', off: -0.1, v: { type: 'shot', frame: 'window', src: repo('showcase/src/assets/track/crs/perm-audit.png'), enter: 'cut', box: { cx: 960, cy: 440, w: 1480, h: 790 }, caption: 'Credit desk, same core: in the audit log',
            marks: [{ cue: 'deny', kind: 'box', x: 0.095, y: 0.219, w: 0.525, h: 0.05, color: 'amber', weight: 6 }] } }] },
    // 4. The result comment: the diff, one file, three cents, a second start that does not run twice. One zoom, on this comment.
    { pre: 0.2, post: 0.2, v: { type: 'shot', frame: 'window', src: ISSUE, enter: 'wipe',
        lt: { kicker: 'Droid with Claude', title: 'The result, on the issue', t: 0.3, dur: 2.2 },
        moves: [{ cue: 'reports', s: 1.6, px: 0.55, py: 0.55, d: 0.9 }],
        marks: [
          { cue: 'file', kind: 'circle', x: 0.355, y: 0.726, w: 0.24, h: 0.028, color: 'amber', weight: 5 },
          { cue: 'spent', kind: 'box', x: 0.318, y: 0.392, w: 0.68, h: 0.066, color: 'done', weight: 5 }],
        stamp: { text: 'RUNS ONCE', cue: 'twice', color: 'done', x: 1.36, y: 0.5, rot: -7, size: 64 } } },
    // Slot: the flight recorder (the scripted take; the real Droid task is the result above).
    { insert: 'flight-recorder', pre: 0.2, post: 0.2, v: { type: 'shot', frame: 'window', src: cap('fr.mp4'), from: 11.5, rate: 1.6, crop: { x: 240, y: 105, w: 1500, h: 840 }, enter: 'wipe-down',
        note: 'Flight recorder replay · ' + SCRIPTED } },
    // 5. Roll back this task only; a risky step asks in Jira or Service Management.
    { pre: 0.2, post: 0.2, parts: [
        { v: { type: 'shot', frame: 'window', src: repo(J + 'rollback-confirm.png'), enter: 'wipe', marks: [
            { cue: 'roll', kind: 'circle', x: 0.805, y: 0.632, w: 0.135, h: 0.15, color: 'blocked', weight: 6 },
            { cue: 'only', kind: 'underline', x: 0.481, y: 0.375, w: 0.305, h: 0.071, color: 'amber', weight: 7, label: 'Only this task', side: 'above', labelW: 420 }] } },
        { cue: 'risky', off: -0.1, v: { type: 'shot', frame: 'window', src: cap('t1-approval-top.png'), enter: 'cut', box: { cx: 960, cy: 420, w: 1400, h: 740 }, caption: 'Test money · ' + SCRIPTED, marks: [
            { cue: 'spending', kind: 'circle', x: 0.189, y: 0.296, w: 0.065, h: 0.04, color: 'amber', weight: 6 },
            { cue: 'budget', kind: 'underline', x: 0.124, y: 0.334, w: 0.162, h: 0.038, color: 'blocked', weight: 6 }] } },
        { cue: 'pushing', off: -0.1, v: { type: 'shot', frame: 'full', src: repo(J + 'jsm-approval.png'), crop: { x: 0, y: 0, w: 1140, h: 641 }, enter: 'wipe-down',
            note: 'Jira Service Management · SECOPS-168',
            marks: [
              { cue: 'production', kind: 'box', x: 0.021, y: 0.12, w: 0.5, h: 0.095, color: 'amber', weight: 6 },
              { cue: 'asks', kind: 'circle', x: 0.668, y: 0.285, w: 0.153, h: 0.047, color: 'accent', weight: 6 }] } }] },
    // 6. Rovo and the daily Confluence page are pinned as documents; OS and Forge, both open source; the end card.
    { hold: 3, pre: 0.2, post: 0.2, parts: [
        { v: { type: 'caseboard', items: [
            { id: 'rv', kind: 'photo', src: cap('t2-rovo-activity.png'), x: 400, y: 95, w: 480, rot: -1.5, cue: 'rovo', enter: 'whip-l' },
            { id: 'cf', kind: 'photo', src: cap('t1-confluence.png'), crop: { x: 120, y: 0, w: 600, h: 450 }, x: 1020, y: 130, w: 700, rot: 1.5, cue: 'confluence', enter: 'whip-l' },
            { id: 'os', kind: 'card', label: 'THE OS', title: 'Isolation, budget, undo', lines: ['Open source'], x: 1640, y: 110, w: 440, rot: 2, cue: 'os' },
            { id: 'fg', kind: 'card', label: 'THE FORGE APP', title: 'Panel, Rovo, triggers', lines: ['Open source'], x: 1640, y: 430, w: 440, rot: -2, cue: 'forge' }],
          strings: [{ from: 'rv', to: 'cf', cue: 'daily', sag: 90 }] } },
        { cue: 'both', v: { type: 'end', lines: ['gurtos.com', 'github.com/benz16107/gurtos', 'Open source, Apache-2.0'] } }] },
  ],
};
