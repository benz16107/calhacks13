// Atlassian Track 1: hand an issue to an agent (tracks/atlassian-t1.md). Real Jira, Confluence, JSM and Rovo screenshots (tracks/jira/screenshots), cropped where noted.
const cap = (f) => `cap:${f}`, repo = (f) => `repo:${f}`;
const J = 'tracks/jira/screenshots/';
const SCRIPTED = 'Scripted agent: same steps every take';

export default {
  title: 'GurtOS for Atlassian: hand an issue to an agent',
  edition: 'business',
  maxDur: 90,
  music: 'bed-hopeful-long.wav',
  card: { sponsor: 'Atlassian', track: 'Agentic Workforce Challenge, Track 1: agents that do the work', editions: ['business'] },
  beats: [
    // 1. A teammate's issue, in Jira from the first second; its text can come from anyone.
    { pre: 0.2, post: 0.2, v: { type: 'stills', src: repo(J + 'started-from-issue.png'), h: 800,
        lt: { kicker: 'PLAT-33510', title: 'A teammate files an issue for an agent', t: 0.2, dur: 2.6 },
        moves: [{ cue: 'obeys', s: 1.5, px: 0.45, py: 0.55, d: 1.0 }] } },
    // 2. Three ways to start; this one gets a label.
    // TODO: the real label being added (T-AT-08) and the Automation editor (T-AT-09) are not captured; text cards stand in.
    { pre: 0.2, post: 0.2, parts: [
        { v: { type: 'lines', kicker: 'Three ways to start', lines: [
            { text: 'A label', cue: 'label' }, { text: 'An assignment', cue: 'assignment' }, { text: 'A Run in GurtOS step in an Automation rule', cue: 'run' }] } },
        { cue: 'this', v: { type: 'lines', kicker: 'PLAT-33510', lines: [{ text: 'Label: gurtos-agent', cue: 'label' }] } }] },
    // 3. Its own Linux user, no keys, no network, twenty-five cents.
    { pre: 0.2, post: 0.2, parts: [
        { v: { type: 'stills', src: repo('showcase/src/assets/track/factory/task-done.png'),
            moves: [{ cue: 'as', s: 2.2, px: 0.83, py: 0.55, d: 0.9 }],
            lt: { kicker: 'A Droid task on the same core', title: 'Its own user, no sites', t: 0.3, dur: 2.5 } } },
        { cue: 'twenty', off: -0.2, v: { type: 'stats', cols: 1, size: 150, items: [{ n: '25 cents', label: 'budget', at: 0.2 }] } }] },
    // Slot: agent permissions, shown as the real refusals only.
    { insert: 'permissions', pre: 0.2, post: 0.2, parts: [
        { v: { type: 'stills', src: cap('t2-perm-blocked.png'), label: 'Credit desk, same core: refused by the OS' } },
        { cue: 'like', off: -0.1, v: { type: 'stills', src: repo('showcase/src/assets/track/crs/perm-audit.png'), label: 'Credit desk, same core: in the audit log',
            moves: [{ at: 0.3, s: 1.35, px: 0.5, py: 0.22, d: 0.8 }] } }] },
    // 4. The result comment: the diff, one file, three cents, a second start that does not run twice.
    { pre: 0.2, post: 0.2, v: { type: 'stills', src: repo(J + 'started-from-issue.png'), h: 800,
        lt: { kicker: 'Droid with Claude', title: 'The result, on the issue', t: 0.3, dur: 3.2 },
        moves: [{ cue: 'exact', s: 1.7, px: 0.45, py: 0.86, d: 0.9 }, { cue: 'changed', s: 1.7, px: 0.4, py: 0.74, d: 0.8 },
                { cue: 'spent', s: 1.9, px: 0.55, py: 0.38, d: 0.8 }, { cue: 'starting', s: 1, d: 0.8 }] } },
    // Slot: the flight recorder (the scripted take; the real Droid task is the result above).
    { insert: 'flight-recorder', pre: 0.2, post: 0.2, v: { type: 'clip', src: cap('fr.mp4'), from: 11.5, rate: 1.6, note: 'Flight recorder replay · ' + SCRIPTED } },
    // 5. Roll back this task only; a risky step asks in Jira or Service Management.
    { pre: 0.2, post: 0.2, parts: [
        { v: { type: 'stills', src: repo(J + 'rollback-confirm.png') } },
        { cue: 'risky', off: -0.1, v: { type: 'stills', src: cap('t1-approval-top.png'), label: 'Test money · ' + SCRIPTED.toLowerCase() } },
        { cue: 'pushing', off: -0.1, v: { type: 'stills', src: repo(J + 'jsm-approval.png'), label: 'Jira Service Management' } }] },
    // 6. Rovo, the daily Confluence page, OS and Forge, both open source; the end card.
    { hold: 3, pre: 0.2, post: 0.2, parts: [
        { v: { type: 'stills', src: cap('t2-rovo-activity.png'), h: 800 } },
        { cue: 'confluence', off: -0.2, v: { type: 'stills', src: cap('t1-confluence.png'), label: 'Daily Confluence page' } },
        { cue: 'os', v: { type: 'lines', kicker: 'Two parts, both open source', lines: [
            { text: 'The OS: isolation, budget, undo', cue: 'os' }, { text: 'The Forge app: panel, Rovo, triggers', cue: 'forge' }] } },
        { cue: 'both', v: { type: 'end', lines: ['gurtos.com', 'github.com/benz16107/calhacks13', 'Open source, Apache-2.0'] } }] },
  ],
};
