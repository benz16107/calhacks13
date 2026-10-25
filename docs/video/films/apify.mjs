// Apify: web robots with no keys (tracks/apify.md). One beat per narration paragraph.
// Not captured yet (no recordings of these): T-AP-01 (two live tasks), T-AP-02 (the trap page through the reader), T-AP-03 (the Apify window with rows and an approval), T-AP-04 (schedule and webhook).
const cap = (f) => `cap:${f}`, repo = (f) => `repo:${f}`;
const SCRIPTED = 'Scripted agent: same steps every take';
const A = 'showcase/src/assets/track/apify/';

export default {
  title: 'GurtOS for Apify: web robots with no keys',
  edition: 'personal',
  maxDur: 90,
  music: 'bed-calm-long.wav',
  card: { sponsor: 'Apify', track: 'Best Use of Apify', editions: ['personal', 'server'] },
  beats: [
    // 1. The problem, over the real box stopping a booby-trapped page (scripted agent) from the first second.
    { hold: 0.3, v: { type: 'clip', src: cap('a03.mp4'), from: 8.0, note: SCRIPTED, moves: [{ at: 1.0, s: 1.8, px: 0.9, py: 0.15, d: 0.9 }],
        lt: { kicker: 'Web agents today', title: 'Your browser, hidden instructions, unseen spend' } } },
    // 2. Its own Linux user, no network, no Apify token; the box runs the Actor with the vault's token.
    { parts: [
        { v: { type: 'clip', src: cap('a06.mp4'), from: 4, note: SCRIPTED, moves: [{ cue: 'own', s: 2.1, px: 0.745, py: 0.56, d: 0.9 }],
            lt: { kicker: 'GurtOS Personal and Server', title: 'Each task: its own Linux user' } } },
        { cue: 'with', v: { type: 'lines', size: 54, kicker: 'An Apify call from a task', lines: [
            { text: 'No network', cue: 'network' }, { text: 'No Apify token', cue: 'apify' },
            { text: "The box runs the Actor with a token the agent can't read", dim: true, cue: 'box' }] } }] },
    // Slot: agent permissions, with Apify's own refusal (the owner turned its key off). Nothing here claims a prompt screen.
    { insert: 'permissions', hold: 0.5, v: { type: 'stills', src: cap('apify-key-off-padded.png'), note: 'Scripted agent, throwaway computer',
        lt: { kicker: 'Agent permissions', title: "The owner turned Apify's key off" } } },
    // 3. The live run of Oct 23. TODO cap:ap-live.mp4 (T-AP-01: two network-less tasks, the result cards, the token search).
    { hold: 0.6, parts: [
        { v: { type: 'lines', kicker: 'Live run · Oct 23', lines: [{ text: 'Two tasks, no network', cue: 'two' }, { text: 'Two Actors on Apify, at once', cue: 'ran' }] } },
        { cue: 'airpods', v: { type: 'stats', cols: 2, size: 80, items: [
            { n: '$299.99 CAD', label: 'AirPods Pro 3, in stock · Best Buy Canada', at: 0.1 },
            { n: 'Cole Coffee Café', label: '6255 College Ave, Oakland', cue: 'cole' }],
          source: 'Live run, Oct 23, on test VMs', sourceAt: { at: 0.4 }, srcTop: 430 } },
        { cue: 'token', v: { type: 'stats', cols: 1, size: 150, items: [{ n: '0', label: 'copies of the token in either log', at: 0.2 }], srcTop: 520 } }] },
    // 4. Our own Actor. The lines are the real detector's output on the trap page. TODO cap:ap-reader.mp4 (T-AP-02).
    { hold: 0.9, v: { type: 'lines', size: 54, kicker: 'Agent-Safe Page Reader · our own Actor', lines: [
        { text: 'Every page goes through it', cue: 'every' },
        { text: 'The trap page: a road bike for $300', dim: true, cue: 'page', after: 'reader' },
        { text: 'risk: high   score: 100   where: display:none', mono: true, cue: 'scores' },
        { text: 'Withheld from the agent', blocked: true, cue: 'withheld' }],
      source: 'Detector output on the live-demo page', sourceAt: { cue: 'scores' } } },
    // 5. Cost capped twice; the Apify window (a new computer: nothing has run yet, and the screen says so).
    { hold: 0.5, parts: [
        { v: { type: 'lines', kicker: 'Cost is capped twice', lines: [
            { text: "The task's budget", cue: 'budget' }, { text: "Apify's cap on each run", cue: 'apify' }],
          source: 'Default cap on a run: $0.10', sourceAt: { at: 0.3 } } },
        { cue: 'window', v: { type: 'stills', src: repo(A + 'apify-window.png'), note: 'Counted cost is an estimate', moves: [{ at: 0.3, s: 2.0, px: 0.35, py: 0.29, d: 0.8 }],
            lt: { kicker: 'The Apify window', title: "Counted cost and Apify's cost" } } }] },
    // 6. Schedules and webhooks on a Server box, then the end card. TODO cap:ap-webhook.mp4 (T-AP-04).
    { hold: 2.1, parts: [
        { v: { type: 'lines', kicker: 'GurtOS Server · while you are away', lines: [
            { text: 'An Apify schedule', cue: 'schedule' }, { text: 'An Apify webhook', cue: 'webhook' }, { text: 'Start tasks', dim: true, cue: 'start' }],
          source: "Set-up and teardown tested live. Delivery tested with Apify's payload shape.", sourceAt: { at: 0.3 } } },
        { cue: 'gurt', v: { type: 'end', lines: ['gurtos.com', 'github.com/benz16107/calhacks13', 'Open source, Apache-2.0'] } }] },
  ],
};
