// Vultr: the parts that must be public or big (tracks/vultr.md). Format: a build-and-boot timelapse. The real release disc
// installs at about 2x with its own progress bar, a spec sheet types the instance size, an elapsed-time strip counts the
// minutes to boot, a restore strip counts 2.8 s, and the cloud box whips in with CLOSED stamped on the rest of its API.
// Real Vultr install screenshots (cropped, no console toolbar, no pairing code), the real release disc installing, the live
// Mana box-status app. One zoom, on the installer line in disc-install.mp4.
// The kit has no running clock or progress bar, so the minutes and seconds are `timeline` strips (a count and an axis).
// TODO: the Vultr console recording of the install timelapse (T-VU-01), the Object Storage listing and the restore on a fresh
// instance (T-VU-02) and the live x402 route and refused closed route (T-VU-04) are not captured; the stand-ins are below.
const cap = (f) => `cap:${f}`, repo = (f) => `repo:${f}`;

export default {
  title: 'GurtOS for Vultr: the parts that must be public or big',
  edition: 'server',
  maxDur: 90,
  music: 'bed-build-long.wav',
  style: { bg: 'grid' },
  card: { sponsor: 'Vultr', track: 'MLH, Best use of Vultr', editions: ['server'] },
  beats: [
    // 1. GurtOS Server on a Vultr instance, full-bleed from the first second; the ordinary cloud server's problem as a header.
    { pre: 0.2, post: 0.2, v: { type: 'shot', frame: 'full', src: cap('vultr-box.png'), crop: { x: 0, y: 20, w: 1685, h: 948 }, enter: 'cut',
        lt: { kicker: 'On an ordinary cloud server', title: 'Every agent runs as one user holding every key', t: 4.1, dur: 4.6 } } },
    // 2. The real Server disc installs (about 2x, the installer's own progress bar), the instance size on a spec sheet beside the
    // real Vultr console, five minutes on the clock strip, then it boots from its own disk.
    { pre: 0.2, post: 0.2, parts: [
        { v: { type: 'shot', frame: 'window', src: cap('disc-install.mp4'), from: 2.6, rate: 2, enter: 'wipe', note: 'Disc in a VM. Sped up.',
            moves: [{ at: 0.5, s: 2, px: 0.25, py: 0.16, d: 0.6 }, { at: 2.0, s: 1, d: 0.5 }] } },
        { cue: 'with', v: { type: 'dossier', bg: 'grid', tab: 'VULTR INSTANCE', title: 'The real Server disc', enter: 'slide-up', fields: [
            { k: 'Plan', v: 'vc2-1c-1gb', at: 0.3 },
            { k: 'vCPU', v: '1', cue: 'one' },
            { k: 'Memory', v: '1 GB', cue: 'gigabyte' }],
          pip: { src: cap('vultr-installer.png'), at: 0.5, w: 700, corner: 'br', label: 'Vultr console, installing', color: 'accent' } } },
        { cue: 'about', v: { type: 'timeline', bg: 'grid', kicker: 'ELAPSED · TO BOOTED', from: 'Disc in', to: 'Booted', dots: [0, 1], step: 1.4,
            cue: 'five', count: 5, label: 'minutes, about', color: 'accent' } },
        { cue: 'own', v: { type: 'shot', frame: 'window', src: repo('showcase/src/assets/track/vultr/disc-booted.png'), enter: 'wipe',
            lt: { kicker: 'Installed in about 5 minutes', title: 'Booted from its own disk', t: 0.3, dur: 3 } } }] },
    // 3. Encrypted backup to Object Storage; restored in 2.8 s with the waiting task still waiting.
    { pre: 0.2, post: 0.2, parts: [
        { v: { type: 'terminal', title: 'backup', bg: 'night', enter: 'cut', size: 44, lines: [
            { text: 'back up state', cmd: true, at: 0.1 },
            { text: 'Encrypted with age', kind: 'ok', cue: 'encrypted' },
            { text: 'Vultr Object Storage holds only ciphertext', kind: 'ok', cue: 'object' },
            { text: 'The owner holds the key', kind: 'ok', cue: 'owner' }] } },
        { cue: 'restored', v: { type: 'timeline', bg: 'grid', kicker: 'RESTORE · ONTO A FRESH INSTANCE', from: 'Backup', to: 'Restored', dots: [0, 1], step: 1.2,
            cue: 'fresh', count: '2.8 s', label: 'to restore onto a fresh instance', color: 'done' } },
        { cue: 'waiting', v: { type: 'shot', frame: 'window', src: cap('a05.mp4'), from: 21.2, enter: 'whip-r', note: 'Power-cut test on a laptop VM',
            marks: [{ cue: 'still', kind: 'box', x: 0.157, y: 0.163, w: 0.155, h: 0.168, color: 'amber', label: 'Still waiting', side: 'below', labelW: 420 }] } }] },
    // 4. What else runs on Vultr, typed line by line.
    { pre: 0.2, post: 0.2, v: { type: 'terminal', title: 'vultr', bg: 'night', enter: 'cut', size: 40, lines: [
        { text: 'What runs on Vultr?', cmd: true, at: 0.1 },
        { text: 'Relay for name.box.gurtos.com', kind: 'ok', cue: 'relay' },
        { text: 'Release discs built on a fresh vc2-4c-8gb', kind: 'ok', cue: 'builds' },
        { text: 'Object Storage mirror with signed SHA256SUMS', kind: 'ok', cue: 'mirrors' },
        { text: 'Firewall group set from code', kind: 'ok', cue: 'firewall' }] } },
    // 5. The cloud box answers its public routes; CLOSED on the rest of its API; the cost; the end card.
    // TODO: the live x402 route and the refused closed route (T-VU-04) are not captured; the live Mana app on the box stands in.
    { hold: 3.8, pre: 0.2, post: 0.2, parts: [
        { v: { type: 'shot', frame: 'window', src: repo('showcase/src/assets/track/vultr/mana-live.png'), enter: 'whip-l',
            note: 'gurt-cloud.box.gurtos.com: Jira, Mana and x402 buyers (test network)',
            lt: { kicker: 'gurt-cloud.box.gurtos.com', title: 'Everything else in its API: closed', t: 5.3, dur: 2.2 },
            stamp: { text: 'CLOSED', cue: 'stays', color: 'blocked', x: 0.72, y: 0.55, rot: -8, size: 120 } } },
        { cue: 'three', v: { type: 'scoreboard', bg: 'grid', kicker: 'THE LIVE TESTS · test network', size: 170, items: [
            { n: '3', label: 'live tests', cue: 'three', color: 'accent' }, { n: '< $0.20', label: 'in total, for all three', cue: 'cost', color: 'done' }] } },
        { cue: 'gurt', v: { type: 'end', lines: ['gurt-cloud.box.gurtos.com', 'gurtos.com', 'github.com/benz16107/calhacks13', 'Open source, Apache-2.0'] } }] },
  ],
};
