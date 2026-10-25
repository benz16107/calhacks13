// The main Devpost video (main.md). One beat per narration paragraph; cues are words the voice says.
const cap = (f) => `cap:${f}`, repo = (f) => `repo:${f}`;
const SCRIPTED = 'Scripted agent: same steps every take';
const BOARD = { type: 'board', at: 0.5, title: '16 OS-level attacks', summary: '14 caught · 2 not covered, published',
            source: 'tracks/armadin/SCOREBOARD.md · run Oct 24 on a laptop VM and a cloud box', rows: [
            { label: "Read another task's files", ok: true }, { label: 'Read the vault', ok: true }, { label: 'Send to a host not allowed', ok: true },
            { label: 'Go around the proxy to an IP', ok: true }, { label: "Approve itself through the box's API", ok: true }, { label: 'Approve itself through SpacetimeDB', ok: true },
            { label: 'Symlink out of its copy', ok: true }, { label: "Read another process's environment", ok: true }, { label: 'ptrace another process', ok: true },
            { label: "Read another task's /tmp", ok: true }, { label: 'Send data over DNS', ok: true }, { label: 'Go around the firewall over IPv6', ok: true },
            { label: 'A fork bomb', ok: true }, { label: 'A memory hog', ok: true }, { label: 'Fill the disk', ok: false }, { label: 'Send through a host it may reach', ok: false }] };
const SUITE = { type: 'suite', items: [
            { text: 'GurtOS Server', at: 0.9 }, { text: 'GurtOS Personal', at: 1.1 }, { text: 'GurtOS Business', at: 1.3 },
            { text: 'Phone and portal apps', cue: 'apps' }, { text: 'Remote access', cue: 'remote' }, { text: 'App platform', cue: 'platform' },
            { text: 'Jira', cue: 'jira' }, { text: 'ASI:One', cue: 'asi' }, { text: 'Shopper', cue: 'shopper' }, { text: 'Credit desk', cue: 'finance' }, { text: 'Open source', cue: 'open' }] };

export default {
  title: 'GurtOS: operating systems built for AI agents',
  edition: 'server',
  maxDur: 180, // Devpost's cap for the main video; the track list's target for Armadin
  music: 'bed-hopeful-long.wav',
  beats: [
    // The hook: a 2.4 s montage of real product shots under the title.
    { dur: 2.4, v: { type: 'montage', items: [{ src: cap('a03.mp4'), from: 20 }, { src: cap('a02.mp4'), from: 12.4 }, { src: cap('fr.mp4'), from: 18 }, { src: cap('a04.mp4'), from: 18 }] } },
    // 1. The problem, sourced.
    { v: { type: 'stats', cols: 4, size: 96, items: [
        { n: '392,891', label: 'GitHub stars for OpenClaw, an agent on your own computer', cue: 'starred' },
        { n: '21,639', label: 'copies open to the internet', cue: 'twenty' },
        { n: '341', label: 'of its 2,857 skills were malware', cue: 'three' },
        { n: '1 click', label: 'to steal its token', cue: 'click' }],
      source: 'Sources: GitHub API, Oct 23 2026 · Censys, Jan 2026 · Koi Security, ClawHub · CVE-2026-25253', sourceAt: { cue: 'twenty' } } },
    // 3. Why an OS.
    { hold: 0.6, v: { type: 'lines', strike: true, kicker: 'The operating systems we have', lines: [
        { text: 'Built for one person at a keyboard', cue: 'built' },
        { text: 'Permissions per user, not per task', cue: 'permissions' },
        { text: 'Secrets any process can read', cue: 'any' },
        { text: 'The network: all or nothing', cue: 'network' },
        { text: 'No approval, no budget, no record, no undo', cue: 'approval' }] } },
    // 4. GurtOS, the filesystem, Droid with Claude.
    { parts: [
        { v: { type: 'clip', src: cap('a01.mp4'), from: 2, lt: { kicker: 'GurtOS Server, the box screen', title: 'Operating systems built for AI agents' } } },
        { cue: 'every', v: { type: 'layers', kicker: 'Every task: its own Linux user, its own copy-on-write layer', layers: [
            { user: 'box-7q4m2k', task: 'Write the weekly notes', files: 'notes.md', at: 0.3 },
            { user: 'box-k2xd9r', task: 'Rename the photo folders', files: 'photos/', cue: 'linux' },
            { user: 'box-r8tn4w', task: 'Find me a road bike', files: 'bikes.md', cue: 'copy' }],
          caption: 'Each layer holds only what its task changed. Nothing is copied.', captionAt: { cue: 'runs' } } },
        { cue: 'factory', v: { type: 'stills', src: repo('showcase/src/assets/track/factory/task-done.png'), moves: [{ cue: 'claude', s: 1.45, px: 0.68, py: 0.56, d: 0.9 }],
          lt: { kicker: 'Droid by Factory, running Claude', title: 'A real task: its own user, no internet' } } }] },
    // 5. Three editions.
    { parts: [
        { v: { type: 'stills', src: repo('site/src/assets/home/server-screen.png'), lt: { kicker: 'Always on, no human login', title: 'GurtOS Server', edition: 'server', t: 1.6 } } },
        { cue: 'personal', v: { type: 'stills', src: repo('site/src/assets/home/personal-everyday-dark.png'), lt: { kicker: 'Your own laptop, agents in the desktop', title: 'GurtOS Personal', edition: 'personal' } } },
        { cue: 'business', v: { type: 'stills', src: repo('site/src/assets/home/business-desktop.png'), lt: { kicker: 'One box for a team: roles, routed approvals, audit', title: 'GurtOS Business', edition: 'business' } } }] },
    // Moment 1: undo one task.
    { hold: 0.6, parts: [
        { v: { type: 'clip', src: cap('a04.mp4'), from: 7.5, rate: 1.2, moves: [{ at: 0.2, s: 1.3, px: 0.5, py: 0.38, d: 0.8 }], lt: { kicker: 'Moment 1 · GurtOS Server', title: 'Undo one task' } } },
        { cue: 'undo', v: { type: 'clip', src: cap('a04.mp4'), from: 16.0, moves: [{ at: 0, s: 1.3, px: 0.5, py: 0.38, d: 0.01 }] } }] },
    // 6. Moment 2: the booby-trapped page.
    { hold: 1.0, parts: [
        { v: { type: 'clip', src: cap('a03.mp4'), from: 7.5, rate: 1.3, note: SCRIPTED, lt: { kicker: 'Moment 2 · GurtOS Server', title: 'The booby-trapped page' } } },
        { cue: 'send', v: { type: 'clip', src: cap('a03.mp4'), from: 16.8, note: SCRIPTED, moves: [{ at: 0.4, s: 1.55, px: 0.36, py: 0.6, d: 0.8 }] } },
        { cue: 'undoes', v: { type: 'clip', src: cap('a03.mp4'), from: 29.4, note: SCRIPTED } }] },
    // 7. Moment 3: box screen and phone, recorded together; the tap lands on "I approve".
    { hold: 0.8, v: { type: 'split', src: cap('a02.mp4'), from: 3.6, note: 'Scripted task · test money',
        crops: [{ x: 36, y: 90, w: 1440, h: 900, cx: 760, bw: 1220 }, { x: 1508, y: 118, w: 390, h: 844, cx: 1575, bw: 420, radius: 40 }],
        lt: { kicker: 'Moment 3 · GurtOS Server', title: 'A pause for your OK' } } },
    // 8. Moment 4: pull the plug; the request is still waiting afterwards.
    { hold: 1.0, pre: 1.3, parts: [
        { v: { type: 'clip', src: cap('a05.mp4'), from: 8.0, lt: { kicker: 'Moment 4 · GurtOS Server', title: 'Pull the plug' } } },
        // The power cut: a 0.25 s blink, then the boot screen while the voice says the box boots.
        { cue: 'plug', off: 0.35, v: { type: 'black' } },
        { cue: 'plug', off: 0.6, v: { type: 'clip', src: cap('a05.mp4'), from: 13.2, drift: false } },
        { cue: 'picks', v: { type: 'clip', src: cap('a05.mp4'), from: 21.2, moves: [{ cue: 'approval', s: 1.7, px: 0.2, py: 0.22, d: 0.8 }] } }] },
    // 9. Security: the published attack test, the placeholder key. Slot: attack it yourself, in place of the key line.
    { slot: { id: 'attack-yourself', parts: [{ v: BOARD }, { cue: 'attack', after: 'can', v: { type: 'clip', src: 'slot:attack-yourself',
        lt: { kicker: 'Attack it yourself', title: 'Paste an injection, watch each defence stop it' } } }] },
      parts: [
        { v: BOARD },
        { cue: 'real', v: { type: 'stats', cols: 1, size: 150, items: [{ n: '240 of 240', label: 'process samples of a real Droid task held only a placeholder key', at: 0.2 }],
            source: 'Merge gate, Oct 24, real Droid with Claude. The proxy adds the real key outside the task.', srcTop: 520 } }] },
    // 10. Light: measured weight.
    { hold: 0, v: { type: 'stats', cols: 3, size: 96, items: [
        { n: '1 GB', label: 'memory: the Server disc installed and ran on a 1 GB cloud machine', cue: 'server', after: 'old' },
        { n: '1.37 GB', label: 'the Server install disc', at: 0.6 },
        { n: '903 MB', label: 'Personal at idle, about 150 MB less than stock Ubuntu', cue: 'personal' }],
      source: 'Measured Oct 24 on a 1 GB Vultr machine, and against stock Ubuntu 24.04', sourceAt: { at: 1.0 } } },
    // 11. Phone and portal: live control from anywhere.
    { hold: 0.4, v: { type: 'stills', h: 700, note: "iPhone, Watch and Mac: screenshots from Apple's simulators", items: [
        { src: repo('showcase/src/assets/repo/portal/phone-home.png'), device: 'phone', label: 'app.gurtos.com', cue: 'portal' },
        { src: repo('native/screenshots/iphone-approval-dark.png'), device: 'phone', label: 'iPhone', cue: 'iphone' },
        { src: repo('native/screenshots/watch-big.png'), device: 'watch', hf: 0.5, label: 'Apple Watch', cue: 'watch' },
        { src: repo('native/screenshots/mac-menu-dark.png'), device: 'bare', hf: 0.5, label: 'Mac', cue: 'mac' },
        { src: repo('native/screenshots/android-notifications.png'), device: 'phone', label: 'Android', cue: 'android' }] } },
    // 12. You can try it, it's real: the Download page, the real disc installing, where it installs.
    { hold: 0, parts: [
        { v: { type: 'clip', src: cap('dl.mp4'), from: 1.4, moves: [{ cue: 'gurtos', s: 1.35, px: 0.42, py: 0.42, d: 0.9 }],
            lt: { kicker: 'gurtos.com/download', title: 'Signed install discs: Server and Personal' } } },
        { cue: 'download', off: 0.45, v: { type: 'clip', src: cap('disc-install.mp4'), from: 0, rate: 3, drift: false, moves: [{ at: 0.6, s: 2.0, px: 0.25, py: 0.06, d: 0.45 }],
            note: 'Release disc in a VM, sped up' } },
        { cue: 'virtual', v: { type: 'lines', kicker: 'It installs on', lines: [
            { text: 'Regular PCs, Intel and AMD (x86_64)', at: 0.1 },
            { text: 'Apple-silicon Macs, in a virtual machine (arm64)', at: 0.25 },
            { text: 'Cloud servers (tested on Vultr)', cue: 'cloud' }] } }] },
    // 13. It's all documented: four real pages of gurtos.com/docs.
    { hold: 0, parts: [
        { v: { type: 'clip', src: cap('docs.mp4'), from: 1.6, lt: { kicker: 'gurtos.com/docs', title: 'How it works, the security model, the APIs' } } },
        { cue: 'slash', off: 0.55, v: { type: 'clip', src: cap('docs.mp4'), from: 7.7 } },
        { cue: 'security', v: { type: 'clip', src: cap('docs.mp4'), from: 11.7 } },
        { cue: 'check', v: { type: 'clip', src: cap('docs.mp4'), from: 15.7 } }] },
    // 14. A suite, open source, end card. Slot: try it live, with the public link on the end card.
    { hold: 2.0, slot: { id: 'try-live', parts: [{ v: SUITE }, { cue: 'gurt', v: { type: 'end', lines: ['Try GurtOS live: {url}', 'gurtos.com', 'gurtos.com/download', 'github.com/benz16107/calhacks13', 'Open source, Apache-2.0'] } }] },
      parts: [
        { v: SUITE },
        { cue: 'gurt', v: { type: 'end', lines: ['gurtos.com', 'gurtos.com/download', 'github.com/benz16107/calhacks13', 'Open source, Apache-2.0'] } }] },
  ],
};
