// Mana: plan in Mana, act safely in GurtOS (tracks/mana.md). Real Mana pages and chats (screenshots), the real GurtOS box, the rules file and a live run's report.
const cap = (f) => `cap:${f}`, repo = (f) => `repo:${f}`;
const M = 'showcase/src/assets/track/mana/';

export default {
  title: 'GurtOS for Mana: plan in Mana, act safely in GurtOS',
  edition: 'personal',
  maxDur: 90,
  music: 'bed-hopeful-long.wav',
  card: { sponsor: 'Mana', track: 'Building with Mana', editions: ['personal', 'business'] },
  beats: [
    // 1. Mana is where we think; GurtOS is where the work runs. Both real, from the first second.
    { pre: 0.2, post: 0.2, parts: [
        { v: { type: 'stills', src: repo(M + 'project-page.png'), lt: { kicker: 'Mana', title: 'AI workspaces are good for thinking', t: 0.2, dur: 2.1 } } },
        { cue: 'but', off: -0.2, v: { type: 'clip', src: cap('a03.mp4'), from: 8, rate: 1.3, note: 'Scripted agent: same steps every take',
            lt: { kicker: 'GurtOS', title: 'Where the work runs safely' } } }] },
    // 2. The public Mana chat: draft rules in, gaps out.
    { pre: 0.2, post: 0.2, parts: [
        { v: { type: 'stills', src: repo(M + 'chat-review.png'), label: 'Public Mana chat: Credit Desk Hackathon Agents Review' } },
        { cue: 'found', off: -0.1, v: { type: 'stills', src: repo(M + 'chat-gen3.png'), label: '12 gaps found, 69 rules proposed' } }] },
    // 3. The finding that changed the build: two records, one business; REL-1 and SOD-5; a live run cites both.
    { pre: 0.2, post: 0.2, parts: [
        { v: { type: 'stills', src: cap('mana-gap2.png'), label: "Mana's answer: two records, one business" } },
        { cue: 'twenty', off: -0.5, v: { type: 'stats', cols: 1, size: 150, items: [{ n: '$20,000', label: 'two limits of $10,000 for one business', at: 0.2 }] } },
        { cue: 'rules', v: { type: 'lines', size: 50, kicker: 'credit-rules.yaml · version 0.2, worked out with Mana', lines: [
            { text: 'REL-1  Two records are one business', mono: true, at: 0.1 },
            { text: 'SOD-5  ...records for one business', mono: true, at: 0.8 }] } },
        { cue: 'now', v: { type: 'lines', size: 50, kicker: "A live run's analyst report", lines: [
            { text: 'Rules: REL-1, COL-7, COL-3, SOD-5, REV-3, REV-5', mono: true, at: 0.2 },
            { text: "Keep at $10,000, per REL-1", mono: true, at: 0.5 }],
          source: 'tracks/credit-desk/runs', sourceAt: { at: 0.4 } } }] },
    // 4. Rules drafted in Mana reach Business only after the owner approves the exact text.
    // TODO: no capture of a Mana rules proposal waiting for approval (T-MA-03); the Business Rules screen stands in, and the sync is only checked by the merge gate.
    { pre: 0.2, post: 0.2, v: { type: 'stills', src: repo('showcase/src/assets/repo/business/2-rules.png'), note: 'Rules sync is checked by the merge gate',
        lt: { kicker: 'GurtOS Business · Settings, Rules', title: 'Drafted in Mana, approved by an owner', t: 0.3, dur: 3.2 } } },
    // 5. A visitor's price check from a Mana app reaches the owner's phone; the task runs boxed in.
    { pre: 0.2, post: 0.2, parts: [
        { v: { type: 'stills', src: cap('mana-ask-top.png'), label: 'Ask GurtOS, an app inside Mana' } },
        { cue: 'request', off: -0.2, v: { type: 'stills', h: 720, note: "Apple's simulators", items: [
            { src: repo(M + 'iphone-guest.png'), label: 'iPhone · test computer', at: 0.1 }, { src: repo(M + 'watch-guest.png'), label: 'Apple Watch', hf: 0.5, cue: 'phone' }] } },
        { cue: 'after', v: { type: 'stills', src: cap('mana-ask-note.png'), label: 'The same Ask GurtOS app' } }] },
    // 6. Plan in Mana, act safely in GurtOS; the end card.
    { hold: 5.4, pre: 0.2, post: 0.2, parts: [
        { v: { type: 'stills', src: repo(M + 'project-page.png') } },
        { cue: 'gurt', v: { type: 'end', lines: ['Public Mana links are on the Devpost page', 'gurtos.com', 'github.com/benz16107/calhacks13', 'Open source, Apache-2.0'] } }] },
  ],
};
