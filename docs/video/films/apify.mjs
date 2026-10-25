// Apify: web robots with no keys (tracks/apify.md). One beat per narration paragraph.
// Format: a crawl desk with a checkpoint. Typed terminals, two big-number cards at once, rolling counters, one flash and a
// WITHHELD stamp where the trap page is caught, downward wipes like a page feed, one zoom on the window's rows.
// Not captured yet (no recordings of these): T-AP-01 (two live tasks), T-AP-02 (the trap page through the reader), T-AP-03 (the Apify window with rows and an approval), T-AP-04 (schedule and webhook).
const cap = (f) => `cap:${f}`, repo = (f) => `repo:${f}`;
const SCRIPTED = 'Scripted agent: same steps every take';
const A = 'showcase/src/assets/track/apify/';

export default {
  title: 'GurtOS for Apify: web robots with no keys',
  edition: 'personal',
  maxDur: 90,
  music: 'bed-crawl-long.wav',
  style: { bg: 'grid' },
  card: { sponsor: 'Apify', track: 'Best Use of Apify', editions: ['personal', 'server'] },
  beats: [
    // 1. The problem, over the real box stopping a booby-trapped page (scripted agent) from the first second. A circle on the Blocked banner.
    { hold: 0.3, v: { type: 'shot', frame: 'full', src: cap('a03.mp4'), from: 8.0, enter: 'cut', note: SCRIPTED,
        lt: { kicker: 'Web agents today', title: 'Your browser, hidden instructions, unseen spend', t: 0.3, dur: 5.6 },
        marks: [{ cue: 'hide', kind: 'circle', x: 0.781, y: 0.077, w: 0.073, h: 0.022, color: 'blocked', weight: 6, label: 'Blocked', side: 'left', labelW: 220 }] } },
    // 2. Its own Linux user, no network, no Apify token; the box runs the Actor with the vault's token. The task recording is inset; the lines are typed.
    { v: { type: 'terminal', title: 'An Apify call from a task', size: 40, enter: 'fade',
        pip: { src: cap('a06.mp4'), from: 4, crop: { x: 250, y: 165, w: 1420, h: 680 }, w: 800, corner: 'br', enter: 'slide-up', label: 'Each task: its own Linux user',
          marks: [{ cue: 'own', kind: 'box', x: 0.696, y: 0.5, w: 0.279, h: 0.07, color: 'amber', weight: 5 }] },
        lines: [
          { text: 'No network', cmd: true, cue: 'network' },
          { text: 'No Apify token', cmd: true, cue: 'apify' },
          { text: "The box runs the Actor with a token the agent can't read", kind: 'ok', cue: 'box' }] } },
    // Slot: agent permissions, with Apify's own refusal (the owner turned its key off). Nothing here claims a prompt screen.
    { insert: 'permissions', hold: 0.5, v: { type: 'shot', frame: 'paper', src: cap('apify-key-off-padded.png'), crop: { x: 0, y: 90, w: 960, h: 350 }, box: { cx: 960, cy: 450, w: 1400, h: 560 },
        enter: 'drop', rot: -1.2, note: 'Scripted agent, throwaway computer',
        marks: [
          { cue: 'enforces', kind: 'box', x: 0.026, y: 0.617, w: 0.964, h: 0.189, color: 'blocked', weight: 5, label: "The owner turned Apify's key off", side: 'above', labelW: 760 },
          { cue: 'permissions', kind: 'underline', x: 0.025, y: 0.023, w: 0.777, h: 0.05, color: 'amber', weight: 6, label: 'Allow, Deny or revoke in Settings', side: 'below', labelW: 760 }] } },
    // 3. The live run of Oct 23. TODO cap:ap-live.mp4 (T-AP-01: two network-less tasks, the result cards, the token search).
    // The two result cards arrive at the same instant; a counter lands on 0.
    { hold: 0.6, parts: [
        { v: { type: 'lines', kicker: 'Live run · Oct 23', lines: [{ text: 'Two tasks, no network', cue: 'two' }, { text: 'Two Actors on Apify, at once', cue: 'ran' }] } },
        { cue: 'airpods', v: { type: 'scoreboard', kicker: 'THE TWO RESULTS · live run, Oct 23, on test VMs', size: 86, srcTop: 520, items: [
            { n: '$299.99\u00a0CAD', label: 'AirPods Pro 3, in stock · Best Buy Canada', cue: 'airpods', color: 'accent' },
            { n: 'Cole\u00a0Coffee\u00a0Café', label: '6255 College Ave, Oakland', cue: 'airpods', color: 'amber' }] } },
        { cue: 'token', v: { type: 'scoreboard', kicker: 'THE TOKEN SEARCH', size: 260, srcTop: 640, items: [{ n: '0', label: 'copies of the token in either log', cue: 'token', color: 'done' }] } }] },
    // 4. Our own Actor. The lines are the real detector's output on the trap page, typed. A flash and a WITHHELD stamp. TODO cap:ap-reader.mp4 (T-AP-02).
    { hold: 0.9, v: { type: 'terminal', title: 'Agent-Safe Page Reader · our own Actor', size: 38, enter: 'wipe-down', alarms: [{ cue: 'withheld' }],
        stamp: { text: 'WITHHELD', cue: 'withheld', color: 'blocked', x: 0.72, y: 0.62, rot: -8, size: 92 },
        lines: [
          { text: 'Every page goes through it', kind: 'out', cue: 'every' },
          { text: 'The trap page: a road bike for $300', kind: 'warn', cue: 'page', after: 'reader' },
          { text: 'risk: high   score: 100   where: display:none', cmd: true, cue: 'scores' },
          { text: 'Withheld from the agent', kind: 'bad', cue: 'withheld' },
          { text: 'Detector output on the live-demo page', kind: 'out', cue: 'withheld', off: 0.6 }] } },
    // 5. Cost capped twice; the Apify window (a new computer: nothing has run yet, and the screen says so). One zoom, on the rows.
    { hold: 0.5, parts: [
        { v: { type: 'shot', frame: 'window', src: repo(A + 'apify-window.png'), enter: 'wipe-down', note: 'Counted cost is an estimate',
            moves: [{ cue: 'capped', s: 2.0, px: 0.37, py: 0.3, d: 0.9 }],
            marks: [
              { cue: 'budget', kind: 'box', x: 0.35, y: 0.24, w: 0.06, h: 0.089, color: 'amber', weight: 5, label: "Counted: the task's budget", side: 'left', labelW: 260, size: 18 },
              { cue: 'cap', after: 'budget', kind: 'box', x: 0.425, y: 0.24, w: 0.065, h: 0.089, color: 'accent', weight: 5, label: 'Apify cost: what Apify reports', side: 'below', labelW: 330, size: 18 }] } },
        { cue: 'the', after: 'run', v: { type: 'scoreboard', kicker: 'Cost is capped twice', size: 260, srcTop: 640, items: [
            { n: '$0.10', label: 'default cap on one run', at: 0.2, color: 'amber' }], source: 'Default cap on a run: $0.10', sourceAt: { at: 0.2 } } }] },
    // 6. Schedules and webhooks on a Server box, then the end card. TODO cap:ap-webhook.mp4 (T-AP-04).
    { hold: 2.1, parts: [
        { v: { type: 'timeline', kicker: "Set-up and teardown tested live. Delivery tested with Apify's payload shape.", from: 'Schedule', to: 'Webhook', dots: [0, 1], count: 2, step: 0.7, color: 'accent', cue: 'an',
            label: 'Apify triggers on a Server box, while you are away' } },
        { cue: 'gurt', v: { type: 'end', lines: ['gurtos.com', 'github.com/benz16107/calhacks13', 'Open source, Apache-2.0'] } }] },
  ],
};
