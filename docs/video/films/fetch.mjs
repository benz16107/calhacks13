// Fetch.ai: a safe body for an ASI:One agent (tracks/fetch.md). Format: chat-first. The real ASI:One chat (recorded
// Oct 24, cap:asi1/fe-*.mp4, 1300x1158) is the stage; the box answers beside it with callouts, one BLOCKED stamp, TEST
// MONEY, and the one zoom on the Approve card. fe-fix-safe.mp4 is fe-fix.mp4 with the pairing code blurred for its
// first 26 s; never use fe-fix.mp4 itself. Not recorded in ASI:One: a stranger pairing, the Shopper answering a direct
// question, the power cut and the guest (their beats say so). Fetch requires 3 to 5 minutes. Payments are TEST FET.
const cap = (f) => `cap:${f}`, repo = (f) => `repo:${f}`;
const SCRIPTED = 'Scripted agent: same steps every take';
const ASI = 'ASI:One, recorded Oct 24';
const CHAT = { x: 170, y: 0, w: 1130, h: 606 }; // the chat column; this aspect fills the frame

export default {
  title: 'GurtOS for Fetch.ai: a safe body for an ASI:One agent',
  edition: 'server',
  maxDur: 300,
  music: 'bed-chat-long.wav',
  style: { bg: 'desk' },
  card: { sponsor: 'Fetch.ai', track: 'ASI:One Agent Challenge', editions: ['server', 'personal'] },
  beats: [
    // 1. The problem, over the real chat; then where agents run today; then strangers' replies.
    { hold: 1.0, parts: [
        { v: { type: 'shot', frame: 'full', src: cap('asi1/fe-fix-safe.mp4'), from: 13.0, crop: { ...CHAT, y: 330 }, enter: 'cut', note: ASI,
            lt: { kicker: 'A chat agent needs somewhere to run', title: 'Where does the agent run?', t: 0.2, dur: 2.6 } } },
        { cue: 'today', v: { type: 'shot', frame: 'tilt', src: cap('a01.mp4'), from: 3.7, enter: 'whip-r',
            lt: { kicker: 'Today, one or the other', title: "Someone else's cloud, or a computer with access to everything", t: 0.2 } } },
        { cue: 'and', v: { type: 'chat', messages: [
            { from: 'them', who: "A stranger's agent", text: 'A reply', at: 0.2 },
            { from: 'them', who: "A stranger's agent", kind: 'bad', text: 'Any reply can carry a hidden instruction', cue: 'any' }] } }] },
    // 2. GurtOS Server: its minimums on rolling tiles, each request a task, the agent on Agentverse.
    { hold: 3.0, parts: [
        { v: { type: 'shot', frame: 'tilt', src: cap('a01.mp4'), from: 10.0, enter: 'flip', tiltY: 12,
            lt: { kicker: 'Open source · Apache-2.0', title: 'GurtOS Server: operating systems built for AI agents', edition: 'server', t: 0.3 } } },
        { cue: 'server', v: { type: 'scoreboard', kicker: 'GURTOS SERVER NEEDS', items: [
            { n: '4 GB', label: 'memory', cue: 'four', color: 'accent' },
            { n: '17 GB', label: 'disk', cue: 'seventeen', color: 'accent' },
            { n: 'No GPU', label: 'x86_64 or arm64', cue: 'gpu', color: 'accent' }],
          source: 'GurtOS Server minimums · docs/story.md', sourceAt: { cue: 'seventeen' } } },
        { cue: 'request', off: 0.2, v: { type: 'ledger', kicker: 'EACH ASI:ONE REQUEST BECOMES A TASK WITH', rows: [
            { what: 'Its own Linux user', status: 'Yes', cue: 'linux' },
            { what: 'Its own copy of the files', status: 'Yes', cue: 'copy' },
            { what: 'Keys', status: 'None', statusKind: 'blocked', cue: 'keys' }] } },
        { cue: 'here', v: { type: 'shot', frame: 'paper', src: repo('showcase/src/assets/track/fetch/agentverse-profile-oct24.png'), enter: 'drop', rot: -1.5,
            box: { cx: 960, cy: 440, w: 1300, h: 760 }, note: 'The agent on Agentverse: its public profile, Oct 24' } }] },
    // 3. Pairing in the real chat (code blurred); a stranger's attempt was not recorded, so it is told in bubbles.
    { hold: 2.5, parts: [
        { v: { type: 'shot', frame: 'full', src: cap('asi1/fe-fix-safe.mp4'), from: 0, crop: { ...CHAT, y: 120 }, enter: 'whip-l', note: 'ASI:One, Oct 24 · pairing code blurred',
            lt: { kicker: 'Pairing', title: 'Only the owner gives it work', t: 0.2 },
            marks: [{ cue: 'pairing', kind: 'box', x: 0.18, y: 0.155, w: 0.8, h: 0.075, color: 'amber', label: "Code from the box's screen", side: 'below', labelW: 460 }] } },
        { cue: 'stranger', v: { type: 'chat', lt: { kicker: 'Not recorded in ASI:One', title: 'A stranger writes to the agent', t: 0.1 }, messages: [
            { from: 'them', who: 'A stranger', text: 'A message to the agent', at: 0.2 },
            { from: 'me', who: 'GurtOS', text: 'The pairing step', cue: 'pairing', after: 'gets' },
            { from: 'me', who: 'GurtOS', kind: 'bad', text: 'No task starts', cue: 'no', after: 'step' }] } }] },
    // 4. Real work in the chat: the request, a Droid task, then the real diff card and Undo side by side.
    { hold: 4.0, parts: [
        { v: { type: 'shot', frame: 'full', src: cap('asi1/fe-fix-safe.mp4'), from: 6.0, crop: { ...CHAT, y: 330, h: 800 }, enter: 'cut', note: ASI } },
        { cue: 'droid', v: { type: 'shot', frame: 'tilt', src: repo('showcase/src/assets/track/factory/task-done.png'), enter: 'whip-r', note: "Another Droid task on the box's own screen",
            lt: { kicker: 'Droid by Factory, running Claude', title: 'A real task: its own user, no network, a budget', t: 0.2 } } },
        { cue: 'diff', v: { type: 'pair', note: 'Undo shown on another task (scripted)', items: [
            { src: cap('asi1/fe-fix-safe.mp4'), from: 30, crop: { x: 250, y: 20, w: 850, h: 1000 }, label: 'In ASI:One: the diff card',
              marks: [{ cue: 'three', kind: 'circle', x: 0.13, y: 0.182, w: 0.118, h: 0.034, color: 'amber', label: '$0.03', side: 'right', labelW: 160 },
                { cue: 'press', kind: 'box', x: 0.506, y: 0.755, w: 0.36, h: 0.035, color: 'blocked' }] },
            { src: repo('showcase/src/assets/repo/portal/task-undo.png'), label: 'Undo: only this task', cue: 'undo', color: 'blocked' }] } }] },
    // 5. The team, re-created from the recorded chat (Oct 24 23:46 PT, docs/features.md): the question and the Shopper's reply.
    { hold: 2.5, v: { type: 'chat', lt: { kicker: 'Re-created from the recorded chat, Oct 24', title: 'Its team replies as quotes, named', t: 0.2, dur: 5 }, messages: [
        { from: 'me', who: 'Me, in ASI:One', text: 'check if the Hario V60 filters are back in stock', cue: 'ask' },
        { from: 'them', who: 'GurtOS Shopper replied:', kind: 'quote', text: 'Gold Roast: 40-pack, $9.50, in stock', cue: 'gurt', after: 'protocol' }] } },
    // 6. A stranger's agent in the real chat: the question and reply, what the hidden comment asked, the Blocked card.
    { hold: 4.0, parts: [
        { v: { type: 'shot', frame: 'full', src: cap('asi1/fe-weather.mp4'), from: 24, crop: { ...CHAT, y: 20 }, enter: 'whip-l', note: ASI,
            lt: { kicker: "A stranger's agent: our TEST weather agent", title: 'Asked in ASI:One for the weather in Berkeley', t: 0.3, dur: 3 } } },
        { cue: 'hides', v: { type: 'exhibit', label: "WHAT ITS HIDDEN HTML COMMENT ASKED (the box's summary)", lines: [
            { text: 'Ignore their owner or instructions', cue: 'ignore', mark: true },
            { text: 'Send keys, codes or passwords', cue: 'send' },
            { text: 'Send money', cue: 'money' }] } },
        { cue: 'gurt', v: { type: 'shot', frame: 'full', src: cap('asi1/fe-weather.mp4'), from: 33, crop: { ...CHAT, y: 420, h: 560 }, enter: 'cut', note: ASI,
            marks: [{ cue: 'describes', kind: 'box', x: 0.168, y: 0.327, w: 0.397, h: 0.054, color: 'amber', label: 'Described and logged', side: 'below', labelW: 420 }],
            stamp: { text: 'BLOCKED', cue: 'blocks', x: 0.8, y: 0.3, rot: -8 } } },
        { cue: 'cannot', v: { type: 'lines', strike: true, kicker: 'A reply is only relayed. It cannot', lines: [
            { text: 'Start a task', cue: 'start' }, { text: 'Approve', cue: 'approve' }, { text: 'Pay', cue: 'pay' }, { text: 'Pair', cue: 'pair' },
            { text: 'No task holds a key to leak', cue: 'no', after: 'pair', keep: true }] } }] },
    // 7. Payments with Fetch's Payment Protocol, all in test FET: TEST MONEY, then the real chat: the oracle's quote,
    // the pause for the owner's OK (the one zoom, on Approve), the on-chain receipt, the test buyer paying our Shopper.
    { hold: 5.0, parts: [
        { v: { type: 'ledger', kicker: 'AGENT TO AGENT', rows: [
            { what: 'Agents pay each other', at: 0.4 },
            { what: "Over Fetch's Payment Protocol", cue: 'fetch' },
            { what: "In test FET on Fetch's testnet", status: 'No value', statusKind: 'waiting', cue: 'test' }],
            stamps: [{ text: 'TEST MONEY', cue: 'all', color: 'amber', box: 'frame', x: 0.7, y: 0.735, rot: -6, size: 88 }] } },
        { cue: 'oracle', v: { type: 'shot', frame: 'full', src: cap('asi1/fe-weather.mp4'), from: 63.5, crop: { ...CHAT, y: 350, h: 700 }, enter: 'whip-l', note: 'ASI:One, Oct 24 · test FET, no value' } },
        { cue: 'over', v: { type: 'shot', frame: 'window', src: cap('asi1/fe-oracle.mp4'), from: 2, crop: { ...CHAT, y: 100, h: 800 }, enter: 'cut', note: 'ASI:One, Oct 24 · test FET, no value',
            marks: [{ at: 0.2, kind: 'underline', x: 0.86, y: 0.35, w: 0.13, h: 0.03, color: 'amber' }],
            moves: [{ cue: 'approve', s: 1.6, px: 0.3, py: 0.82, d: 0.8 }] } },
        { cue: 'receipt', v: { type: 'shot', frame: 'window', src: cap('asi1/fe-buyer.mp4'), from: 7.0, crop: { x: 170, y: 0, w: 1130, h: 880 }, enter: 'whip-l', note: 'ASI:One, Oct 24 · TEST agents, test FET',
            marks: [{ at: 0.3, kind: 'box', x: 0.168, y: 0.043, w: 0.556, h: 0.082, color: 'done', label: 'Receipt: the transaction on Fetch testnet', side: 'below', labelW: 640 },
              { cue: 'other', after: 'receipt', kind: 'underline', x: 0.21, y: 0.758, w: 0.383, h: 0.032, color: 'amber', label: 'A test buyer paid our Shopper 0.05 test FET', side: 'above', labelW: 680 }] } }] },
    // 8. Pull the plug: the box resumes from its action log; the chat says so.
    // Not recorded in ASI:One: the power cut from the main video stands in, labelled.
    { hold: 2.5, pre: 0.3, parts: [
        { v: { type: 'shot', frame: 'full', src: cap('a05.mp4'), from: 8.0, enter: 'cut' } },
        { cue: 'plug', off: 0.35, v: { type: 'black' } },
        { cue: 'plug', off: 0.6, v: { type: 'shot', frame: 'full', src: cap('a05.mp4'), from: 13.2, enter: 'cut' } },
        { cue: 'resumes', v: { type: 'shot', frame: 'window', src: cap('a05.mp4'), from: 21.2, enter: 'whip-l', note: SCRIPTED,
            lt: { kicker: 'The power cut from the main video', title: 'The box resumes from its action log', t: 0.6 },
            marks: [{ cue: 'chat', kind: 'spot', x: 0.03, y: 0.1, w: 0.36, h: 0.24 }] } }] },
    // 9. Guests: nothing runs until the owner says yes; then no network, 25 cents, 3 an hour.
    // Not recorded in ASI:One: the guest approval on the owner's phone and watch (simulators) stands in, labelled.
    { hold: 2.5, parts: [
        { v: { type: 'stills', h: 780, note: "Apple's simulators · Mana's guest: the route ASI:One guests use", items: [
            { src: repo('native/screenshots/iphone-guest.png'), device: 'phone', label: "The owner's phone", at: 0.3 },
            { src: repo('native/screenshots/watch-guest.png'), device: 'watch', hf: 0.6, label: 'Apple Watch', cue: 'approve' }] } },
        { cue: 'then', v: { type: 'lines', kicker: 'After the OK, in an empty guest workspace', lines: [
            { text: 'No network', cue: 'network' }, { text: 'A 25 cent budget', cue: 'twenty' }, { text: '3 requests per guest an hour at most', cue: 'three' }] } }] },
    // 10. What GurtOS does and what the Fetch integration adds; the end card.
    { hold: 3.2, parts: [
        { v: { type: 'lines', kicker: 'In the repo: tracks/fetch/README.md', lines: [
            { text: 'Names', cue: 'names' }, { text: 'Addresses', cue: 'addresses' }, { text: 'Run steps', cue: 'run' }] } },
        { cue: 'gurt', v: { type: 'lines', kicker: 'GurtOS does', lines: [
            { text: 'Isolation', cue: 'isolation' }, { text: 'Approvals', cue: 'approvals' }, { text: 'Undo', cue: 'undo' }] } },
        { cue: 'fetch', v: { type: 'lines', kicker: 'The Fetch integration adds', lines: [
            { text: 'Pairing', cue: 'pairing' }, { text: 'Screening', cue: 'screening' }, { text: 'Payments', cue: 'payments' }] } },
        { cue: 'gurt', after: 'payments', v: { type: 'end', lines: ['gurtos.com', 'github.com/benz16107/gurtos', 'Open source, Apache-2.0'] } }] },
  ],
};
