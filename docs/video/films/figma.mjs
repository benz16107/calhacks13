// Figma: one design system for a whole OS (tracks/figma.md). Real Figma exports and the running app; stage numbers from docs/stagelog.md.
const repo = (f) => `repo:${f}`, cap = (f) => `cap:${f}`;
const F = 'docs/figma/';
const CMP = 'Figma frame, running app, difference';
// One stage's result: the minutes and the rating, said by the voice at the end of its beat.
const result = (n, stage) => ({ type: 'stats', cols: 1, size: 150, items: [{ n, label: 'minutes, 4 of 5', at: 0.2 }],
  source: 'docs/stagelog.md', srcTop: 500, sourceAt: { at: 0.6 } });

export default {
  title: 'GurtOS for Figma: one design system for a whole OS',
  edition: 'server',
  maxDur: 180, // Figma's limit for the demo video, embedded in the Figma Slides deck
  music: 'bed-calm-long.wav',
  card: { sponsor: 'Figma', track: 'Best Workflow, Stage Log, Best Design and Most Creative', editions: ['server', 'personal', 'business'] },
  beats: [
    // 1. One screen is easy; an ecosystem is not. Real screens from the first second, then the one design system.
    { parts: [
        { v: { type: 'stills', items: [
            { src: repo(F + 'os-v2/desktop/home-approval-banner.png'), label: 'The Figma frame', at: 0.1 },
            { src: repo('portal/screenshots/desktop.png'), label: 'The running portal', at: 0.3 }] } },
        { cue: 'three', off: -0.1, v: { type: 'stills', h: 420, items: [
            { src: repo('portal/screenshots/desktop.png'), label: 'Box screen', at: 0.1 },
            { src: repo('showcase/src/assets/repo/portal/tasks.png'), label: 'Portal', cue: 'portal' },
            { src: repo('showcase/src/assets/repo/portal/phone-home.png'), label: 'Phone app', cue: 'phone', hf: 1.5 },
            { src: repo('showcase/src/assets/repo/personal/14-review.png'), label: 'Native desktop', cue: 'native' }] } },
        { cue: 'give', off: -0.1, v: { type: 'stills', src: repo(F + 'os-v2/system-foundations.png'),
            lt: { kicker: 'Figma · GurtOS foundations', title: 'Colors and type drift apart', t: 0.2, dur: 2.4 } } },
        { cue: 'everything', off: -0.1, v: { type: 'stills', src: repo(F + 'ecosystem-map.png'),
            lt: { kicker: 'FigJam ecosystem map · 2 min', title: 'Everything starts from one design system' } } }] },
    // 2. Stage 1, ideation: the board, the research, three directions, the pick.
    { parts: [
        { v: { type: 'stills', src: repo(F + 'ideation-board.png'),
            moves: [{ cue: 'architecture', s: 2.1, px: 0.28, py: 0.28, d: 0.9 }, { cue: 'four', s: 2.1, px: 0.68, py: 0.28, d: 0.9 }, { cue: 'through', s: 1, d: 0.9 }],
            lt: { kicker: 'Stage 1 · FigJam + Figma MCP server', title: 'Ideation', t: 0.2, dur: 3.2 } } },
        { cue: 'gathered', off: -0.4, v: { type: 'lines', kicker: 'Ideation research', lines: [
            { text: 'Two rounds of 15 references', cue: 'two' }, { text: 'from real operating systems', cue: 'real' }] } },
        { cue: 'and', after: 'systems', off: -0.1, v: { type: 'stills', h: 560, items: [
            { src: repo(F + 'directions/a-home-server-box.png'), label: 'A · Home-server OS', at: 0.05 },
            { src: repo(F + 'directions/b-console-box.png'), label: 'B · Console', at: 0.15 },
            { src: repo(F + 'directions/c-hardware-box.png'), label: 'C · Hardware OS', at: 0.25 }] } },
        { cue: 'forty', off: -0.1, v: result('42', 'ideation') }] },
    // 3. Stage 2, prototyping: four flows, 136 links, the edition variable.
    { parts: [
        { v: { type: 'stills', h: 700, items: [
            { src: repo(F + 'os-v2/phone/2-approval-notification.png') }, { src: repo(F + 'os-v2/phone/1-home.png') }, { src: repo(F + 'os-v2/phone/4-tasks.png') }],
            lt: { kicker: 'Stage 2 · Figma Design + Figma Make', title: 'Prototyping', t: 0.2, dur: 3.3 } } },
        { cue: 'four', v: { type: 'stats', cols: 2, size: 150, items: [
            { n: '4', label: 'flows across the new screens', cue: 'four' }, { n: '136', label: 'prototype links', cue: 'one' }],
          source: 'docs/stagelog.md', sourceAt: { cue: 'one' } } },
        { cue: 'all', v: { type: 'stills', items: [
            { src: repo(F + 'os-v2/setup/01-welcome.png'), cue: 'twelve' },
            { src: repo(F + 'os-v2/setup/07-apps.png'), cue: 'setup' },
            { src: repo(F + 'os-v2/setup/12-done.png'), cue: 'steps' }] } },
        { cue: 'approving', off: -0.1, v: { type: 'stills', src: repo(F + 'os-v2/phone/2-approval-notification.png'), h: 780,
            lt: { kicker: 'Flow · phone', title: 'Approving a spend', t: 0.1, dur: 1.4 } } },
        { cue: 'undoing', off: -0.1, v: { type: 'stills', src: repo(F + 'os-v2/windows/task-detail-undo-confirm.png'),
            moves: [{ cue: 'task', s: 1.8, px: 0.52, py: 0.58, d: 0.8 }] } },
        { cue: 'variable', off: -0.1, v: { type: 'stills', h: 700, items: [
            { src: repo(F + 'phone-app/2a-home-server.png'), label: 'Edition: Server' },
            { src: repo(F + 'phone-app/2b-home-personal.png'), label: 'Personal' },
            { src: repo(F + 'phone-app/2c-home-business-rosa.png'), label: 'Business' }] } },
        { cue: 'sixty', off: -0.1, v: result('61', 'prototyping') }] },
    // 4. Stage 3, handoff: the variable and its CSS name, the two accent values, the drift check (run today).
    { parts: [
        { v: { type: 'stills', src: repo(F + 'os-v2/system-foundations.png'), lt: { kicker: 'Stage 3 · Figma Design + Figma MCP server', title: 'Handoff', t: 0.2, dur: 2 } } },
        { cue: 'every', v: { type: 'lines', size: 56, kicker: 'Every Figma variable carries its CSS name', lines: [
            { text: 'Figma window/bg, CSS --color-window-bg', mono: true, cue: 'variable' },
            { text: 'Figma space/xs, CSS --space-xs', mono: true, cue: 'carries' },
            { text: 'Figma motion/duration-fast, CSS --duration-fast', mono: true, cue: 'code' }] } },
        { cue: 'accent', off: -0.2, v: { type: 'lines', kicker: 'accent/bg in Figma and --color-accent-bg in the code', lines: [
            { text: 'Light  #2F64A6', mono: true, cue: 'light' }, { text: 'Dark  #78A9E6', mono: true, cue: 'dark' },
            { text: 'Same name, same two values', cue: 'uses' }] } },
        { cue: 'script', off: -0.2, v: { type: 'lines', lines: [
            { text: '$ node docs/figma/tokens/sync.ts --check', mono: true, cue: 'script' },
            { text: 'The first run found 18 drifts', blocked: true, cue: 'first' },
            { text: '0 drifts across 82 Figma tokens.', mono: true, cue: 'today' }],
          source: 'Run on Oct 25', sourceAt: { cue: 'today' } } },
        { cue: 'minutes', after: 'sixty', off: -0.35, v: result('67', 'handoff') }] },
    // 5. Stage 4, code generation: the frames became the portal; Business and Personal from their own frames.
    { parts: [
        { v: { type: 'lines', kicker: 'Stage 4 · Figma MCP server (get_design_context)', lines: [{ text: 'Code generation', cue: 'code' }] } },
        { cue: 'claude', v: { type: 'stills', src: repo(F + 'os-v2/desktop/home-approval-banner.png') } },
        { cue: 'built', v: { type: 'stills', items: [
            { src: repo(F + 'os-v2/desktop/home-approval-banner.png'), label: 'The Figma frame' },
            { src: repo('portal/screenshots/desktop.png'), label: 'The portal it became', cue: 'portal' }] } },
        { cue: 'business', v: { type: 'stills', items: [
            { src: repo(F + 'business/1a-people.png'), label: 'Business, the approved frame' },
            { src: repo('showcase/src/assets/repo/business/1a-people.png'), label: 'Business, the running app', cue: 'approved' }] } },
        { cue: 'personal', v: { type: 'stills', items: [
            { src: repo(F + 'os-v2/personal/review-keep-or-undo.png'), label: 'Personal, its own frame' },
            { src: repo('showcase/src/assets/repo/personal/14-review.png'), label: 'Native libadwaita window', cue: 'native' }] } },
        { cue: 'three', v: { type: 'stats', cols: 1, size: 150, items: [{ n: '349', label: 'minutes, 4 of 5', at: 0.2 }],
          source: 'docs/stagelog.md', srcTop: 500, sourceAt: { at: 0.6 } } }] },
    // 6. One web kit for Server and Business, native Personal, and the comparison script (77 frames, each scored).
    { parts: [
        { v: { type: 'stills', h: 520, items: [
            { src: repo('portal/screenshots/desktop.png'), label: 'Server: the web kit', cue: 'server' },
            { src: repo('showcase/src/assets/repo/business/1a-people.png'), label: 'Business: the same kit', cue: 'business' },
            { src: repo('showcase/src/assets/repo/personal/14-review.png'), label: 'Personal: native, same colors and type', cue: 'personal' }] } },
        { cue: 'script', off: -0.2, v: { type: 'stills', src: repo(F + 'compare/desktop.png'), label: CMP } },
        { cue: 'running', v: { type: 'stills', src: repo(F + 'compare/settings-03-permissions.png'), label: '77 frames, each with a score' } }] },
    // 7. Everything around the system: deck, Sites, Community, Dev Mode, Code Connect (unpublished, rated 3).
    { parts: [
        { v: { type: 'lines', kicker: 'Around the design system', lines: [{ text: 'A 16-slide Figma Slides deck', cue: 'sixteen' }] } },
        { cue: 'landing', v: { type: 'stills', src: cap('figma-landing-hero.png'), lt: { kicker: 'Landing page for Figma Sites', title: 'Built from the system', t: 0.4, dur: 1.8 } } },
        { cue: 'community', v: { type: 'stills', src: repo(F + 'community/cover.png') } },
        { cue: 'dev', off: -0.3, v: { type: 'lines', kicker: 'Dev Mode · kit code on 95 components', lines: [
            { text: '<Button kind="suggested" onClick={approve}>Approve $8.00</Button>', mono: true, cue: 'dev' }],
          source: 'portal/src/kit/ui.tsx', sourceAt: { cue: 'dev' } } },
        { cue: 'code', after: 'components', v: { type: 'lines', kicker: 'Code Connect', lines: [
            { text: '95 templates written', cue: 'written' }, { text: 'Not published: needs an Organization plan', blocked: true, cue: 'because' },
            { text: 'Rated 3 of 5', cue: 'we' }] } }] },
    // 8. The stage log, then the end card.
    { hold: 3, parts: [
        { v: { type: 'stats', cols: 4, size: 112, items: [
            { n: '42', label: 'minutes of ideation', at: 0.1 }, { n: '61', label: 'minutes of prototyping', at: 0.3 },
            { n: '67', label: 'minutes of handoff', at: 0.5 }, { n: '349', label: 'minutes of code generation', at: 0.7 }],
          source: 'Each 4 of 5 · docs/stagelog.md', sourceAt: { at: 0.5 } } },
        { cue: 'open', v: { type: 'end', lines: ['gurtos.com', 'github.com/benz16107/calhacks13', 'Open source, Apache-2.0'] } }] },
  ],
};
