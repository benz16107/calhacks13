// SpacetimeDB: the live nervous system (tracks/spacetime.md). Live recordings: a02 (moment 3), a30 (Rosa's request), a33
// (Audit). Real screenshots: the Live board and its Agents and Computers tabs. No slots are listed for this video.
// TODO cap:st-claims.mp4 (T-ST-01, the claim check running), cap:st-visibility.mp4 (T-ST-02, three clients),
// cap:st-late-answer.mp4 (T-ST-03, the refused stranger): not recorded; the counts are a text card from docs/story.md.
const cap = (f) => `cap:${f}`, repo = (f) => `repo:${f}`;
const SCRIPTED = 'Scripted agent: same steps every take';
const MAIN_SPLIT = [{ x: 36, y: 90, w: 1440, h: 900, cx: 760, bw: 1220 }, { x: 1508, y: 118, w: 390, h: 844, cx: 1575, bw: 420, radius: 40 }];

export default {
  title: 'GurtOS for SpacetimeDB: the live nervous system',
  edition: 'business',
  maxDur: 90,
  music: 'bed-hopeful-long.wav',
  card: { sponsor: 'SpacetimeDB', track: 'The core real-time backend', editions: ['server', 'personal', 'business'] },
  beats: [
    // 1. The problem, over the real Live board (the product is on screen from the first word); its words ride in the footnote.
    { hold: 0.4, v: { type: 'stills', src: cap('st-live.png'), note: 'Usually: a database, a websocket server, a cache, sign-in glue' } },
    // 2. One self-hosted SpacetimeDB on each box; every screen sees the same request at the same moment (A02, live).
    { hold: 0.6, v: { type: 'split', src: cap('a02.mp4'), from: 0, note: 'The OS vouches for each screen. SpacetimeDB holds the rules.', crops: MAIN_SPLIT,
        lt: { kicker: 'GurtOS · one SpacetimeDB on each box', title: 'The same request, on every screen', edition: 'server' } } },
    // 3. Atomic claim: 3 agents, 15 claims, 12 jobs, 12 distinct, none twice.
    { hold: 0.8, parts: [
        { v: { type: 'stills', src: cap('st-agents.png'), note: SCRIPTED } },
        { cue: 'three', v: { type: 'stats', cols: 4, size: 110, items: [
            { n: '3', label: 'agents', at: 0.1 },
            { n: '15', label: 'claims', cue: 'fifteen' },
            { n: '12', label: 'jobs', cue: 'twelve' },
            { n: '12', label: 'different jobs, none twice', cue: 'different' }],
          source: `${SCRIPTED} · docs/story.md`, sourceAt: { at: 0.4 }, srcTop: 470 } }] },
    // 4. Row-level visibility: Rosa's request is routed to her (A30, live); Priya and a stranger get nothing.
    { hold: 1.0, parts: [
        { v: { type: 'clip', src: cap('a30.mp4'), from: 12.0, lt: { kicker: 'GurtOS Business', title: "A request routed to Rosa" } } },
        { cue: 'priya', v: { type: 'lines', kicker: 'The same box, the same moment', lines: [
            { text: 'Rosa: sees her request', dim: true, at: 0.3 }, { text: 'Priya: nothing', at: 0.8 }, { text: 'A stranger: nothing', cue: 'stranger' }] } }] },
    // 5. First answer wins (A02, live: the phone approves, the box screen says it is already approved); recorded under the vouched name; a stranger is refused.
    { hold: 0.6, parts: [
        { v: { type: 'split', src: cap('a02.mp4'), from: 12.4, note: 'Scripted task · test money', crops: MAIN_SPLIT,
            lt: { kicker: 'GurtOS · SpacetimeDB reducer', title: 'The first answer wins' } } },
        { cue: 'answer', after: 'refused', v: { type: 'clip', src: cap('a33.mp4'), from: 6.0, lt: { kicker: 'GurtOS Business · Audit', title: 'Recorded under the name the box vouched for' } } },
        { cue: 'stranger', v: { type: 'lines', kicker: 'Answering as someone else', lines: [{ text: "A stranger's identity: refused", blocked: true, at: 0.3 }], size: 72 } }] },
    // 6. Timer, live meters, the Maincloud fleet view off by default.
    { hold: 0.6, parts: [
        { v: { type: 'lines', kicker: 'In the database', lines: [{ text: 'A timer can bring a second person in', at: 0.4 }] } },
        { cue: 'live', v: { type: 'stills', src: cap('st-agents.png'), moves: [{ at: 0.3, s: 1.5, px: 0.5, py: 0.15, d: 0.8 }], note: 'Meters match the lists' } },
        { cue: 'maincloud', v: { type: 'stills', src: cap('st-computers.png'), note: 'Off by default: counts only' } }] },
    // 7. Open source; end card.
    { hold: 3.0, v: { type: 'end', lines: ['gurtos.com', 'github.com/benz16107/calhacks13', 'Open source, Apache-2.0'] } },
  ],
};
