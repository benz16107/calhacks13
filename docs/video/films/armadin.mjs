// Armadin: attacks GurtOS stops (tracks/armadin.md). Format: a red-team thriller. Real attacks play full-bleed, the CISA
// alert is pinned to an evidence board, each refusal is circled on the log, the sandbox prints in a terminal with two
// NOT BUILT stamps, and the film ends on counters that roll to the published score. One zoom, on the host list.
// Same narration and facts as v1. Positions in `marks` are fractions of each crop (measured on 1920x1080 frames).
const cap = (f) => `cap:${f}`, repo = (f) => `repo:${f}`;
const SCRIPTED = 'Scripted agent: same steps every take';
const PHONE = 'showcase/src/assets/track/armadin';

export default {
  title: 'GurtOS for Armadin: attacks GurtOS stops',
  edition: 'server',
  maxDur: 90, // Devpost's cap for the main video; the track list's target for Armadin
  music: 'bed-redteam-long.wav',
  style: { bg: 'night' },
  card: { sponsor: 'Armadin', track: 'Best Security Hack', editions: ['server', 'personal', 'business'] },
  beats: [
    // 1. The road-bike task starts and the Blocked toast drops (real, full-bleed), a header names each way in, then the
    // task's own Linux user. ar03 from 7.6: the toast drops 0.8 s in; the task window opens near 12.5 s of the file.
    { parts: [
        { v: { type: 'shot', frame: 'full', src: cap('ar03.mp4'), from: 7.6, enter: 'cut', note: SCRIPTED,
            lt: { kicker: 'Attacked through', title: 'Pages they read', t: 1.2, dur: 1.5 } } },
        { cue: 'packages', v: { type: 'shot', frame: 'full', src: cap('ar03.mp4'), from: 10.33, enter: 'cut', note: SCRIPTED,
            lt: { kicker: 'And through', title: 'Packages they install', t: 0.02, dur: 1.4 },
            marks: [{ cue: 'install', kind: 'box', x: 0.772, y: 0.042, w: 0.215, h: 0.17, color: 'blocked' },
              { cue: 'key', kind: 'underline', x: 0.173, y: 0.322, w: 0.239, h: 0.02, color: 'amber' }] } },
        { cue: 'on', after: 'key', v: { type: 'shot', frame: 'full', src: cap('a06.mp4'), from: 4, enter: 'cut', note: SCRIPTED,
            lt: { kicker: 'Same core in Server, Personal and Business', title: 'Each task: its own Linux user', t: 0.2, dur: 3.8 },
            marks: [{ cue: 'own', kind: 'circle', x: 0.722, y: 0.482, w: 0.122, h: 0.022, color: 'blocked' }] } }] },
    // 2. The CISA alert pinned to the board, strings to our harmless copy, then the real run full-bleed.
    { parts: [
        { v: { type: 'caseboard', kicker: 'EVIDENCE BOARD · CISA ALERT, SEPT 23, 2025',
            items: [
              { id: 'cisa', kind: 'card', label: 'CISA ALERT · Sept 23, 2025', title: 'Over 500 npm packages compromised', x: 520, y: 140, w: 680, rot: -1.5, cue: 'cisa' },
              { id: 'did', kind: 'card', label: 'WHAT IT DID', title: 'It hunted for tokens and cloud keys', lines: ['and sent them to an endpoint the attacker controlled'], x: 1380, y: 170, w: 700, rot: 1.4, cue: 'worm' },
              { id: 'src', kind: 'card', label: 'SOURCE', title: 'cisa.gov', lines: ['/news-events/alerts/2025/09/23/', 'widespread-supply-chain-', 'compromise-impacting-npm-ecosystem'], x: 480, y: 580, w: 760, rot: -1, cue: 'npm' },
              { id: 'ours', kind: 'photo', src: cap('ar-notice.png'), crop: { x: 280, y: 280, w: 935, h: 470 }, x: 1330, y: 560, w: 780, rot: 1.8, cue: 'we' }],
            strings: [{ from: 'cisa', to: 'did', cue: 'worm', off: 0.3, sag: 50 }, { from: 'did', to: 'ours', cue: 'we', sag: 90 }] } },
        { cue: 'copy', v: { type: 'shot', frame: 'full', src: cap('ar01.mp4'), from: 7.47, enter: 'iris', note: SCRIPTED,
            moves: [{ cue: 'blocked', s: 1.6, px: 0.396, py: 0.315, d: 0.8 }],
            lt: { kicker: 'gurt-chalk-utils: a harmless imitation, a real npm install', title: '10 of 11 steps blocked or contained', t: 0.8, dur: 2.8 } } }] },
    // 3. The booby-trapped page: the window, a hand-drawn circle on each refused step as the voice names it, BLOCKED.
    { hold: 0.6, v: { type: 'shot', frame: 'window', src: cap('ar03.mp4'), from: 13, crop: { x: 250, y: 165, w: 1420, h: 860 }, enter: 'wipe-down', note: SCRIPTED,
        lt: { kicker: 'GurtOS Server', title: 'The booby-trapped page', t: 0.2, dur: 2.6 },
        marks: [
          { cue: 'vault', kind: 'circle', x: 0.1176, y: 0.4767, w: 0.211, h: 0.0267, color: 'blocked', label: 'Vault read: fails', labelW: 360 },
          { cue: 'proxy', kind: 'circle', x: 0.1387, y: 0.529, w: 0.314, h: 0.0267, color: 'blocked', label: 'Proxy: refused', labelW: 330 },
          { cue: 'firewall', kind: 'circle', x: 0.1176, y: 0.6337, w: 0.238, h: 0.0267, color: 'blocked', label: 'Firewall: refused', labelW: 360 },
          { cue: 'approving', kind: 'circle', x: 0.1176, y: 0.7384, w: 0.227, h: 0.0267, color: 'blocked', label: 'Self-approval: refused', labelW: 440 }],
        stamp: { text: 'BLOCKED', cue: 'refused', color: 'blocked', x: 0.76, y: 0.22, rot: -8, size: 96 } } },
    // Slot, once merged: attack it yourself.
    { insert: 'attack-yourself', hold: 0.6, v: { type: 'shot', frame: 'window', src: 'slot:attack-yourself', enter: 'wipe',
        lt: { kicker: 'Attack it yourself', title: 'Paste an injection, watch each defence stop it' } } },
    // 4. Tripwire keys: two phone cards, tilted toward each other.
    { hold: 0.8, v: { type: 'pair', note: 'iOS simulator: the notice the box builds', items: [
        { src: repo(`${PHONE}/iphone-tripwire-task.png`), frame: 'tilt', tiltY: 13, enter: 'drop', label: 'The task, undone', at: 0.1 },
        { src: repo('native/screenshots/iphone-tripwire-notification.png'), frame: 'tilt', tiltY: -13, enter: 'whip-l', label: 'The phone, alerted', cue: 'phone' }] } },
    // 5. The hijacked payment, split: the AP-4 refusal and the over-limit bill waiting for a person, under TEST MONEY.
    { hold: 1.4, v: { type: 'pair', items: [
        { src: cap('ar04.mp4'), from: 9, frame: 'paper', crop: { x: 700, y: 500, w: 495, h: 100 }, enter: 'drop', rot: -1.2, label: 'The lookalike bank change', caption: 'Made-up company · Nessie test bank · test money',
          marks: [{ cue: 'rule', kind: 'circle', x: 0.638, y: 0.56, w: 0.089, h: 0.17, color: 'blocked' },
            { cue: 'refuses', kind: 'circle', x: 0.0505, y: 0.33, w: 0.095, h: 0.17, color: 'blocked' }] },
        { src: cap('ar04.mp4'), from: 19.75, rate: 0.55, frame: 'window', crop: { x: 1470, y: 30, w: 440, h: 240 }, label: 'The over-limit bill', cue: 'over', color: 'amber',
          marks: [{ cue: 'no', kind: 'box', x: 0.068, y: 0.72, w: 0.875, h: 0.146, color: 'blocked' }] }],
      stamps: [{ text: 'TEST MONEY', cue: 'test', color: 'amber', box: 'frame', x: 0.5, y: 0.72, rot: -5, size: 88 }] } },
    // 6. The sandbox, printed in a terminal, then two NOT BUILT stamps on the lines that say so.
    { hold: 0.6, v: { type: 'terminal', title: "Every task's sandbox, measured on the cloud box", size: 44, lines: [
        { text: 'Seccomp: 2 · a system-call filter', kind: 'ok', cue: 'system' },
        { text: 'cpu.max 200000 100000 · 2 CPU cores', kind: 'ok', cue: 'cpu' },
        { text: 'MemoryMax 2G · MemorySwapMax 0 · 512 processes', kind: 'ok', cue: 'memory' },
        { text: 'Not built: Landlock', kind: 'warn', cue: 'landlock' },
        { text: 'Not built: a per-task disk quota', kind: 'warn', cue: 'disk' }],
      stamps: [{ text: 'NOT BUILT', cue: 'landlock', color: 'amber', x: 0.3, y: 0.74, rot: -6, size: 64 },
        { text: 'NOT BUILT', cue: 'disk', color: 'amber', x: 0.68, y: 0.82, rot: 5, size: 64 }] } },
    // 7. The published score on rolling counters, held; then the end card.
    { hold: 3, parts: [
        { v: { type: 'scoreboard', kicker: 'THE PUBLISHED SCORE · 16 OS-level attacks', items: [
            { n: '15', of: '16', label: 'caught', cue: 'sixteen', color: 'done' },
            { n: '1', label: 'not covered: send through a host it may reach', cue: 'one', after: 'fifteen', color: 'blocked' },
            { n: '2', label: 'machines, same score', cue: 'machines', after: 'two', color: 'accent' }],
          source: 'tracks/armadin/SCOREBOARD.md · Oct 24 · laptop VM (no swap) and cloud box (8 GB swap)', srcTop: 720, sourceAt: { cue: 'attacks' } } },
        { cue: 'gurt', v: { type: 'end', lines: [{ slot: 'try-live', text: 'Try GurtOS live: {url}' }, 'Attacks stop at the OS, whatever the model does.', 'gurtos.com', 'github.com/benz16107/calhacks13', 'Open source, Apache-2.0'] } }] },
  ],
};
