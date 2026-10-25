// Atlassian Track 2: undo only the wrong part (tracks/atlassian-t2.md). Real Jira, Confluence, JSM and Rovo screenshots (tracks/jira/screenshots), cropped where noted.
const cap = (f) => `cap:${f}`, repo = (f) => `repo:${f}`;
const J = 'tracks/jira/screenshots/';
const SCRIPTED = 'Scripted agent: same steps every take';

export default {
  title: 'GurtOS for Atlassian: undo only the wrong part',
  edition: 'business',
  maxDur: 90,
  music: 'bed-tense-long.wav',
  card: { sponsor: 'Atlassian', track: 'Agentic Workforce Challenge, Track 2: security for agents acting for a user', editions: ['business'] },
  beats: [
    // 1. BOX-29, the story: what the agent did, from the issue the box wrote.
    { pre: 0.2, post: 0.2, v: { type: 'stills', src: cap('t2-issue-ask.png'), label: 'BOX-29 in Jira · ' + SCRIPTED } },
    // 2. An ordinary computer, then a task's own Linux user.
    { pre: 0.2, post: 0.2, parts: [
        { v: { type: 'lines', strike: true, kicker: 'On an ordinary computer', lines: [
            { text: 'The agent runs as you', cue: 'agent' }, { text: 'With your keys', cue: 'with' }, { text: 'On shared files', cue: 'shared' }] } },
        { cue: 'gurt', off: -0.2, v: { type: 'clip', src: cap('a06.mp4'), from: 4, moves: [{ cue: 'task', after: 'gives', s: 2.1, px: 0.745, py: 0.56, d: 0.9 }],
            lt: { kicker: 'Same core in Server and Business', title: 'Each task: its own Linux user, no keys' } } }] },
    // 3. BOX-29 as a Jira issue, written from the box's log; the paste upload refused.
    { pre: 0.2, post: 0.2, parts: [
        { v: { type: 'stills', src: cap('t2-wait-top.png'), label: "BOX-29 in Jira, written from the box's own log" } },
        { cue: 'network', off: -0.2, v: { type: 'stills', src: cap('t2-issue-allowed.png'), label: SCRIPTED } }] },
    // Slot: the flight recorder replays a scripted task step by step.
    { insert: 'flight-recorder', pre: 0.2, post: 0.2, v: { type: 'clip', src: cap('fr.mp4'), from: 11.5, rate: 1.6, note: 'Flight recorder replay · ' + SCRIPTED } },
    // 4. The Confluence incident page, the JSM request, who approved, and the Business role.
    { pre: 0.2, post: 0.2, parts: [
        { v: { type: 'stills', src: cap('t2-incident-top.png'), label: 'The Confluence incident page' } },
        { cue: 'push', off: -0.3, v: { type: 'stills', src: repo(J + 'jsm-approval.png'), label: 'The Jira Service Management request' } },
        { cue: 'log', off: -0.3, v: { type: 'stills', src: cap('t2-audit-approved.png'), label: 'The log names who approved' } },
        { cue: 'in', after: 'approved', v: { type: 'clip', src: cap('a31.mp4'), from: 4.2, note: 'Merge gate, with Jira stand-ins',
            moves: [{ at: 0.3, s: 1.35, px: 0.72, py: 0.25, d: 0.8 }],
            lt: { kicker: 'GurtOS Business', title: "The company's role must allow it too" } } }] },
    // Slot: permissions, shown as the real refusals only.
    { insert: 'permissions', pre: 0.2, post: 0.2, parts: [
        { v: { type: 'stills', src: cap('t2-perm-blocked.png'), label: 'Credit desk, same core: refused by the OS' } },
        { cue: 'like', off: -0.1, v: { type: 'stills', src: repo('showcase/src/assets/track/crs/perm-audit.png'), label: 'Credit desk, same core: in the audit log',
            moves: [{ at: 0.3, s: 1.35, px: 0.5, py: 0.22, d: 0.8 }] } }] },
    // 5. Roll back: confirm, who asked, one layer out, the three configs back, the others keep theirs.
    { pre: 0.2, post: 0.2, parts: [
        { v: { type: 'stills', src: repo(J + 'rollback-confirm.png') } },
        { cue: 'forge', off: -0.1, v: { type: 'stills', src: cap('t2-audit-approved.png') } },
        { cue: 'then', off: -0.1, v: { type: 'layers', kicker: 'Roll back takes out one task layer', layers: [
            { user: 'Another task', task: 'Its own fix', files: 'its files', at: 0.05 },
            { user: 'This task', task: 'The retry rule', files: '3 configs', at: 0.2 }],
          undo: 1, undoAt: { cue: 'layer' } } },
        { cue: 'three', v: { type: 'stills', src: cap('t2-diff-rolled.png') } },
        { cue: 'every', v: { type: 'stills', src: cap('t2-undone.png'), label: 'Undoes file changes, not messages already sent' } }] },
    // 6. Rovo asks before it rolls back; one issue search, several issues back together.
    { pre: 0.2, post: 0.2, parts: [
        { v: { type: 'stills', h: 800, items: [{ src: cap('t2-rovo-activity.png'), at: 0.1 }, { src: cap('t2-rovo-confirm.png'), cue: 'asks' }] } },
        { cue: 'any', off: -0.2, v: { type: 'stills', src: cap('t2-jql-top.png') } },
        { cue: 'roll', after: 'issue', v: { type: 'stills', src: repo(J + 'bulk-report.png') } }] },
    // 7. Two parts, both open source; the end card.
    { hold: 3, pre: 0.2, post: 0.2, parts: [
        { v: { type: 'stills', src: repo(J + 'gadget.png') } },
        { cue: 'os', v: { type: 'lines', kicker: 'Two parts, both open source', lines: [
            { text: 'The OS: isolation, log, undo', cue: 'os' }, { text: 'The Forge app: panel, Rovo, bulk action, gadget', cue: 'forge' }] } },
        { cue: 'open', v: { type: 'end', lines: ['gurtos.com', 'github.com/benz16107/calhacks13', 'Open source, Apache-2.0'] } }] },
  ],
};
