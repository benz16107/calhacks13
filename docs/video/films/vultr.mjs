// Vultr: the parts that must be public or big (tracks/vultr.md). Real Vultr install screenshots (cropped, no console toolbar, no pairing code), the real release disc installing, the live Mana box-status app.
const cap = (f) => `cap:${f}`, repo = (f) => `repo:${f}`;

export default {
  title: 'GurtOS for Vultr: the parts that must be public or big',
  edition: 'server',
  maxDur: 90,
  music: 'bed-calm-long.wav',
  card: { sponsor: 'Vultr', track: 'MLH, Best use of Vultr', editions: ['server'] },
  beats: [
    // 1. GurtOS Server on a Vultr instance, from the first second; the ordinary cloud server's problem as a lower third.
    { pre: 0.2, post: 0.2, v: { type: 'stills', src: cap('vultr-box.png'),
        lt: { kicker: 'On an ordinary cloud server', title: 'Every agent runs as one user holding every key', t: 4.1, dur: 4.6 } } },
    // 2. The real Server disc installed on a 1 vCPU, 1 GB instance, then booted from its own disk.
    // TODO: the Vultr console recording of the install timelapse (T-VU-01) is not captured; the cropped console screenshots and the real disc in a VM stand in.
    { pre: 0.2, post: 0.2, parts: [
        { v: { type: 'stills', src: cap('vultr-installer.png'), label: 'Real Server disc on vc2-1c-1gb: 1 vCPU, 1 GB' } },
        { cue: 'with', off: -0.1, v: { type: 'clip', src: cap('disc-install.mp4'), from: 0, rate: 2.2, drift: false, moves: [{ at: 1.15, s: 2.0, px: 0.25, py: 0.06, d: 0.5 }],
            note: 'Disc in a VM. Sped up.' } },
        { cue: 'about', off: -0.1, v: { type: 'stills', src: cap('vultr-box.png'), lt: { kicker: 'Installed in about 5 minutes', title: 'Booted from its own disk, disc detached', t: 0.3, dur: 3 } } }] },
    // 3. Encrypted backup; restored in 2.8 s with the waiting task still waiting.
    // TODO: the Object Storage listing and the restore on a fresh instance (T-VU-02) are not captured; text cards and the local power-cut test stand in.
    { pre: 0.2, post: 0.2, parts: [
        { v: { type: 'lines', kicker: 'Backup to Vultr Object Storage', lines: [
            { text: 'Encrypted with age', cue: 'encrypted' }, { text: 'Vultr holds only ciphertext', cue: 'object' }, { text: 'Owner holds the key', cue: 'and' }] } },
        { cue: 'restored', off: -0.1, v: { type: 'stats', cols: 1, size: 150, items: [{ n: '2.8 s', label: 'to restore onto a fresh instance', at: 0.2 }] } },
        { cue: 'waiting', v: { type: 'clip', src: cap('a05.mp4'), from: 21.2, note: 'Power-cut test on a laptop VM',
            moves: [{ cue: 'still', s: 1.7, px: 0.2, py: 0.22, d: 0.8 }] } }] },
    // 4. What else runs on Vultr: relay, build machine, mirror, firewall, the always-on box.
    { pre: 0.2, post: 0.2, v: { type: 'lines', size: 50, kicker: 'What runs on Vultr', lines: [
        { text: 'Relay for name.box.gurtos.com', cue: 'relay' }, { text: 'Release discs built on a fresh vc2-4c-8gb', cue: 'builds' },
        { text: 'Object Storage mirror with signed SHA256SUMS', cue: 'mirrors' }, { text: 'Firewall group set from code', cue: 'firewall' },
        { text: 'The always-on cloud box', at: 4.2 }] } },
    // 5. The cloud box answers its public routes; the rest stays closed; the cost; the end card.
    // TODO: the live x402 route and the refused closed route (T-VU-04) are not captured; the live Mana app on the box stands in.
    { hold: 3.8, pre: 0.2, post: 0.2, parts: [
        { v: { type: 'stills', src: repo('showcase/src/assets/track/vultr/mana-live.png'), label: 'gurt-cloud.box.gurtos.com: Jira, Mana and x402 buyers (test network)' } },
        { cue: 'rest', v: { type: 'lines', kicker: 'gurt-cloud.box.gurtos.com', lines: [{ text: 'Everything else in its API: closed', blocked: true, cue: 'rest' }] } },
        { cue: 'three', v: { type: 'stats', cols: 2, size: 112, items: [{ n: '3', label: 'live tests', cue: 'three' }, { n: 'Under $0.20', label: 'in total', cue: 'under' }] } },
        { cue: 'gurt', v: { type: 'end', lines: ['gurt-cloud.box.gurtos.com', 'gurtos.com', 'github.com/benz16107/calhacks13', 'Open source, Apache-2.0'] } }] },
  ],
};
