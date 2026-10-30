// Mana: plan in Mana, act safely in GurtOS (tracks/mana.md). Format: two rooms and a doorbell. Mana's real pages are the
// planning room (pinned to a board, circled, set beside the box), GurtOS is where the work runs (a recording that whips in
// from the right), and a guest's request lights up the owner's phone. Same narration and facts as before.
// Positions in `marks` are fractions of each crop. The kit has no kinetic type, so "the owner approves the exact text" is
// a callout label on the real Rules screen.
const cap = (f) => `cap:${f}`, repo = (f) => `repo:${f}`;
const M = 'showcase/src/assets/track/mana/';

export default {
  title: 'GurtOS for Mana: plan in Mana, act safely in GurtOS',
  edition: 'personal',
  maxDur: 90,
  music: 'bed-social-long.wav',
  style: { bg: 'desk' },
  card: { sponsor: 'Mana', track: 'Building with Mana', editions: ['personal', 'business'] },
  beats: [
    // 1. Mana is where we think; GurtOS is where the work runs. Both real, from the first second.
    { pre: 0.2, post: 0.2, parts: [
        { v: { type: 'shot', frame: 'paper', src: repo(M + 'project-page.png'), enter: 'drop', rot: -1.2, box: { cx: 960, cy: 500, w: 800, h: 860 },
            lt: { kicker: 'Mana', title: 'AI workspaces are good for thinking', t: 0.2, dur: 2.1 } } },
        { cue: 'but', off: -0.2, v: { type: 'shot', frame: 'full', src: cap('a03.mp4'), from: 13.5, rate: 1.3, enter: 'whip-l', note: 'Scripted agent: same steps every take',
            lt: { kicker: 'GurtOS', title: 'Where the work runs safely', t: 0.3, dur: 2.2 },
            marks: [{ cue: 'real', kind: 'box', x: 0.148, y: 0.262, w: 0.483, h: 0.087, color: 'blocked', label: 'Blocked and logged', side: 'below', labelW: 440 }] } }] },
    // 2. The public Mana chat, pinned to a board: draft rules in, twelve gaps and sixty-nine rules out.
    { pre: 0.2, post: 0.2, v: { type: 'caseboard', kicker: 'PUBLIC MANA CHAT · Credit Desk Hackathon Agents Review', items: [
        { id: 'a', kind: 'photo', src: repo(M + 'chat-review.png'), x: 470, y: 140, w: 540, rot: -2.2, at: 0.1 },
        { id: 'b', kind: 'photo', src: repo(M + 'chat-gen3.png'), x: 1060, y: 170, w: 540, rot: 1.8, cue: 'found', off: -0.2 },
        { id: 'n1', kind: 'note', text: '12 gaps found', x: 1600, y: 250, w: 420, rot: -3, cue: 'twelve', off: -0.3 },
        { id: 'n2', kind: 'note', text: '69 rules proposed', x: 1600, y: 540, w: 420, rot: 2.5, cue: 'proposed', off: -0.3 }],
      strings: [{ from: 'b', to: 'n1', cue: 'twelve', off: -0.3 }, { from: 'n1', to: 'n2', cue: 'proposed', off: -0.3, sag: 40 }] } },
    // 3. The finding that changed the build: two records, one business. The records are circled, the limits add up to
    // $20,000, the sentence about it is the one zoom, REL-1 and SOD-5 are typed, and a live run cites both.
    { pre: 0.2, post: 0.2, parts: [
        { v: { type: 'shot', frame: 'paper', src: cap('mana-gap2.png'), enter: 'slide-up', rot: -0.8, box: { cx: 960, cy: 470, w: 1500, h: 400 }, caption: "Mana's answer: two records, one business",
            marks: [{ cue: 'records', kind: 'circle', x: 0.416, y: 0.413, w: 0.329, h: 0.196, color: 'amber' },
              { cue: 'business', kind: 'circle', x: 0.796, y: 0.413, w: 0.068, h: 0.196, color: 'amber' },
              { cue: 'tenthousand', kind: 'circle', x: 0.289, y: 0.707, w: 0.049, h: 0.196, color: 'blocked' }] } },
        { cue: 'That', off: -0.1, v: { type: 'scoreboard', bg: 'night', kicker: 'TWO RECORDS, ONE BUSINESS', size: 190, srcTop: 560, items: [
            { n: '$20,000', label: 'for one business', at: 0.1, color: 'blocked' }] } },
        { cue: 'each', after: 'twenty', off: -0.1, v: { type: 'shot', frame: 'paper', src: cap('mana-gap2.png'), enter: 'whip-r', rot: 0.8, box: { cx: 960, cy: 470, w: 1500, h: 400 },
            moves: [{ at: 0.3, s: 1.8, px: 0.67, py: 0.8, d: 0.8 }],
            marks: [{ at: 0.4, kind: 'underline', x: 0.468, y: 0.707, w: 0.049, h: 0.196, color: 'blocked' }] } },
        { cue: 'rules', off: -0.3, v: { type: 'exhibit', bg: 'board', label: 'credit-rules.yaml · version 0.2, worked out with Mana', enter: 'drop', rot: -1.4, size: 56, lines: [
            { text: 'REL-1  Two records are one business', mark: true, at: 0.3 },
            { text: 'SOD-5  ...records for one business', mark: true, at: 1.5 }] } },
        { cue: 'now', off: -0.2, v: { type: 'terminal', title: "a live run · analyst report", enter: 'whip-l', size: 40, lines: [
            { text: 'Rules: REL-1, COL-7, COL-3, SOD-5, REV-3, REV-5', at: 0.2 },
            { text: 'Keep at $10,000, per REL-1', kind: 'ok', at: 0.9 }] } }] },
    // 4. Rules drafted in Mana reach Business only after the owner approves the exact text.
    // TODO: no capture of a Mana rules proposal waiting for approval (T-MA-03); the Business Rules screen stands in, and the sync is only checked by the merge gate.
    { pre: 0.2, post: 0.2, v: { type: 'shot', frame: 'window', src: repo('showcase/src/assets/repo/business/2-rules.png'), crop: { x: 340, y: 47, w: 1240, h: 920 }, enter: 'iris',
        note: 'Rules sync is checked by the merge gate',
        lt: { kicker: 'GurtOS Business · Settings, Rules', title: 'Drafted in Mana, approved by an owner', t: 0.3, dur: 3.2 },
        marks: [{ cue: 'approves', kind: 'box', x: 0.349, y: 0.471, w: 0.356, h: 0.06, color: 'accent', label: 'The owner approves the exact text', side: 'below', labelW: 640 }] } },
    // 5. A visitor's price check from a Mana app reaches the owner's phone (a tilted card, the watch as an inset); the
    // task runs boxed in: 25 cents, no network.
    { pre: 0.2, post: 0.2, parts: [
        { v: { type: 'pair', bg: 'night', items: [
            { src: cap('mana-ask-top.png'), label: 'Ask GurtOS, an app inside Mana', enter: 'fade' },
            { src: repo(M + 'iphone-guest.png'), frame: 'tilt', tiltY: -12, label: "iPhone · Apple's simulator", color: 'amber', cue: 'request', off: -0.2 }],
          pip: { src: repo(M + 'watch-guest.png'), cue: 'request', off: -0.1, w: 300, corner: 'br', enter: 'slide-up', label: "Apple Watch", color: 'accent' } } },
        { cue: 'after', off: -0.2, v: { type: 'shot', frame: 'paper', src: cap('mana-ask-note.png'), enter: 'whip-l', rot: 0.8, box: { cx: 960, cy: 470, w: 1400, h: 400 }, caption: 'The same Ask GurtOS app',
            marks: [{ cue: 'approval', kind: 'underline', x: 0.101, y: 0.19, w: 0.676, h: 0.116, color: 'accent' },
              { cue: 'runs', kind: 'underline', x: 0.101, y: 0.45, w: 0.55, h: 0.116, color: 'amber' }] } },
        { cue: 'with', off: -0.1, v: { type: 'scoreboard', bg: 'night', kicker: 'IN AN EMPTY WORKSPACE', size: 170, srcTop: 520, items: [
            { n: 'No', label: 'network of its own', cue: 'no', color: 'done' },
            { n: '25', label: 'cents of tool spending, at most', cue: 'twenty', color: 'amber' }],
          source: "Nothing runs until the box's owner taps Approve.", sourceAt: { at: 0.8 } } }] },
    // 6. Both rooms side by side, then the end card.
    { hold: 5.4, pre: 0.2, post: 0.2, parts: [
        { v: { type: 'pair', bg: 'night', items: [
            { src: repo(M + 'project-page.png'), label: 'Plan in Mana', color: 'accent', enter: 'whip-r' },
            { src: cap('a03.mp4'), from: 18, crop: { x: 270, y: 180, w: 960, h: 660 }, label: 'Act safely in GurtOS', color: 'amber', cue: 'act', off: -0.1 }] } },
        { cue: 'open', v: { type: 'end', lines: ['Public Mana links are on the Devpost page', 'gurtos.com', 'github.com/benz16107/gurtos', 'Open source, Apache-2.0'] } }] },
  ],
};
