// Armadin: attacks GurtOS stops (tracks/armadin.md). Reuses the main video's footage style; its own takes are ar01, ar03, ar04.
const cap = (f) => `cap:${f}`, repo = (f) => `repo:${f}`;
const SCRIPTED = 'Scripted agent: same steps every take';

export default {
  title: 'GurtOS for Armadin: attacks GurtOS stops',
  edition: 'server',
  maxDur: 90, // Devpost's cap for the main video; the track list's target for Armadin
  music: 'bed-tense-long.wav',
  card: { sponsor: 'Armadin', track: 'Best Security Hack', editions: ['server', 'personal', 'business'] },
  beats: [
    // 1. The problem, then the OS answer.
    { parts: [
        { v: { type: 'lines', kicker: 'Agents get attacked through', lines: [
            { text: 'The pages they read', cue: 'pages' }, { text: 'The packages they install', cue: 'packages' },
            { text: 'On an ordinary computer, a fooled agent can send out every key', cue: 'install', off: 0.3, dim: true }] } },
        { cue: 'on', after: 'key', v: { type: 'clip', src: cap('a06.mp4'), from: 4, moves: [{ cue: 'task', after: 'gurt', s: 2.1, px: 0.745, py: 0.56, d: 0.9 }],
            lt: { kicker: 'Same core in Server, Personal and Business', title: 'Each task: its own Linux user' } } }] },
    // 2. A real attack, sourced; our harmless copy, installed for real.
    { parts: [
        { v: { type: 'lines', kicker: 'CISA alert · Sept 23, 2025', lines: [
            { text: 'Over 500 npm packages compromised', at: 0.3 },
            { text: 'It hunted for tokens and cloud keys, and sent them to an endpoint the attacker controlled', dim: true, cue: 'september' }],
          source: 'cisa.gov/news-events/alerts/2025/09/23/widespread-supply-chain-compromise-impacting-npm-ecosystem', sourceAt: { cue: 'september' } } },
        { cue: 'we', v: { type: 'clip', src: cap('ar01.mp4'), from: 8.4, note: SCRIPTED, moves: [{ cue: 'ten', s: 1.5, px: 0.36, py: 0.3, d: 0.8 }],
            lt: { kicker: 'gurt-chalk-utils: a harmless imitation, a real npm install', title: '10 of 11 steps blocked or contained' } } }] },
    // 3. The booby-trapped page, every step refused.
    { hold: 0.6, parts: [
        { v: { type: 'clip', src: cap('ar03.mp4'), from: 7.6, note: SCRIPTED, lt: { kicker: 'GurtOS Server', title: 'The booby-trapped page' } } },
        { cue: 'vault', v: { type: 'clip', src: cap('ar03.mp4'), from: 13, note: SCRIPTED, moves: [
            { at: 0.05, s: 1.5, px: 0.4, py: 0.31, d: 0.7 },
            { cue: 'proxy', s: 1.5, px: 0.36, py: 0.64, d: 0.7 },
            { cue: 'approving', s: 1.5, px: 0.46, py: 0.31, d: 0.7 }] } }] },
    // Slot, once merged: attack it yourself.
    { insert: 'attack-yourself', hold: 0.6, v: { type: 'clip', src: 'slot:attack-yourself', lt: { kicker: 'Attack it yourself', title: 'Paste an injection, watch each defence stop it' } } },
    // 4. Tripwire keys: the poisoned package's send ended its task; the phone's notice.
    { hold: 0.8, v: { type: 'stills', h: 760, note: "iOS simulator: the notice the box builds", items: [
        { src: repo('showcase/src/assets/track/armadin/iphone-tripwire-task.png'), device: 'phone', label: 'The task, undone', cue: 'decoy' },
        { src: repo('native/screenshots/iphone-tripwire-notification.png'), device: 'phone', label: 'The phone, alerted', cue: 'phone' }] } },
    // 5. The hijacked payment: refused in code, then a person says no.
    { hold: 1.4, parts: [
        { v: { type: 'clip', src: cap('ar04.mp4'), from: 7.2, note: 'Made-up company · Nessie test bank · test money', moves: [{ at: 0.3, s: 1.5, px: 0.42, py: 0.55, d: 0.8 }],
            lt: { kicker: 'Credit desk · AP clerk seat', title: 'Bank change by email: refused (AP-4)' } } },
        { cue: 'over', v: { type: 'clip', src: cap('ar04.mp4'), from: 16.6, note: 'Test money', moves: [{ at: 0.05, s: 1.8, px: 0.86, py: 0.12, d: 0.6 }] } },
        { cue: 'says', after: 'person', v: { type: 'clip', src: cap('ar04.mp4'), from: 25, note: 'Test money', moves: [{ at: 0.05, s: 1.5, px: 0.42, py: 0.3, d: 0.6 }] } }] },
    // 6. The sandbox, with what is not built.
    { hold: 0.6, v: { type: 'lines', size: 52, kicker: "Every task's sandbox, measured on the cloud box", lines: [
        { text: 'Seccomp: 2 · a system-call filter', mono: true, cue: 'system' },
        { text: 'cpu.max 200000 100000 · 2 CPU cores', mono: true, cue: 'cpu' },
        { text: 'MemoryMax 2G · MemorySwapMax 0 · 512 processes', mono: true, cue: 'memory' },
        { text: 'Not built: Landlock', blocked: true, cue: 'landlock' },
        { text: 'Not built: a per-task disk quota', blocked: true, cue: 'disk' }] } },
    // 7. The published score, then the end card.
    { hold: 3, parts: [
        { v: { type: 'board', at: 0.2, step: 0.15, title: '16 OS-level attacks', summary: '14 caught · 2 not covered · same score on two machines',
            source: 'tracks/armadin/SCOREBOARD.md · Oct 24 · laptop VM (no swap) and cloud box (8 GB swap)', rows: [
            { label: "Read another task's files", ok: true }, { label: 'Read the vault', ok: true }, { label: 'Send to a host not allowed', ok: true },
            { label: 'Go around the proxy to an IP', ok: true }, { label: "Approve itself through the box's API", ok: true }, { label: 'Approve itself through SpacetimeDB', ok: true },
            { label: 'Symlink out of its copy', ok: true }, { label: "Read another process's environment", ok: true }, { label: 'ptrace another process', ok: true },
            { label: "Read another task's /tmp", ok: true }, { label: 'Send data over DNS', ok: true }, { label: 'Go around the firewall over IPv6', ok: true },
            { label: 'A fork bomb', ok: true }, { label: 'A memory hog', ok: true }, { label: 'Fill the disk', ok: false }, { label: 'Send through a host it may reach', ok: false }] } },
        { cue: 'gurt', v: { type: 'end', lines: [{ slot: 'try-live', text: 'Try GurtOS live: {url}' }, 'Attacks stop at the OS, whatever the model does.', 'gurtos.com', 'github.com/benz16107/calhacks13', 'Open source, Apache-2.0'] } }] },
  ],
};
