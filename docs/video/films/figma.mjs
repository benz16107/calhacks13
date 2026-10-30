// Figma: one design system for a whole OS (tracks/figma.md). Format: a design-process story that walks the stage log.
// Each stage has its own device (an evidence board for ideation, tilted phones for prototyping, a case file and a terminal
// for handoff, match cuts from each Figma frame to its running app for code generation), and each ends on the stage-log
// strip: dots on an axis sized by minutes (42, 61, 67, 349) that fills as the stage lands. Real Figma exports and the
// running app; stage numbers from docs/stagelog.md. One zoom, on the compare page's "6.2% of pixels differ".
const repo = (f) => `repo:${f}`, cap = (f) => `cap:${f}`;
const F = 'docs/figma/';
// Where each stage ends on the axis: its share of the 519 logged minutes (42, 61, 67, 349).
const AT = [0.081, 0.198, 0.328, 1];
// One stage's result on the stage-log strip: the minutes roll up, the dots up to this stage are lit.
const result = (stage, min, name) => ({ type: 'timeline', kicker: 'THE STAGE LOG · EACH RATED 4 OF 5', from: 'Ideation', to: 'Code generation',
  dots: AT.slice(0, stage), step: 0.3, count: min, label: `minutes of ${name}`, color: 'done' });
// A match cut: the same frame, a different picture, on a word.
const MATCH = { cx: 960, cy: 440, w: 1400, h: 720 };

export default {
  title: 'GurtOS for Figma: one design system for a whole OS',
  edition: 'server',
  maxDur: 180, // Figma's limit for the demo video, embedded in the Figma Slides deck
  music: 'bed-design-long.wav',
  style: { bg: 'grid' },
  card: { sponsor: 'Figma', track: 'Best Workflow, Stage Log, Best Design and Most Creative', editions: ['server', 'personal', 'business'] },
  beats: [
    // 1. One screen is easy; an ecosystem is not. The Figma frame and the running portal share the frame, then the four
    // surfaces pinned, the foundations sheet, and the FigJam map.
    { parts: [
        { v: { type: 'pair', items: [
            { src: repo(F + 'os-v2/desktop/home-approval-banner.png'), label: 'The Figma frame' },
            { src: repo('portal/screenshots/desktop.png'), label: 'The running portal', cue: 'ecosystem', enter: 'wipe', color: 'amber' }] } },
        { cue: 'box', v: { type: 'caseboard', bg: 'desk', kicker: 'ONE OS · FOUR SURFACES', items: [
            { id: 'a', kind: 'photo', src: repo('portal/screenshots/desktop.png'), x: 405, y: 290, w: 440, rot: -2, cue: 'box', caption: 'Box screen' },
            { id: 'b', kind: 'photo', src: repo('showcase/src/assets/repo/portal/tasks.png'), x: 915, y: 240, w: 440, rot: 1.5, cue: 'portal', caption: 'Portal' },
            { id: 'c', kind: 'photo', src: repo('showcase/src/assets/repo/portal/phone-home.png'), x: 1240, y: 210, w: 200, rot: -1, cue: 'phone', caption: 'Phone app' },
            { id: 'd', kind: 'photo', src: repo('showcase/src/assets/repo/personal/14-review.png'), x: 1630, y: 300, w: 440, rot: 2, cue: 'native', caption: 'Native desktop' }] } },
        { cue: 'give', v: { type: 'shot', frame: 'paper', src: repo(F + 'os-v2/system-foundations.png'), crop: { x: 20, y: 120, w: 1190, h: 1110 }, enter: 'drop', rot: -1.2,
            box: { cx: 960, cy: 520, w: 900, h: 832 },
            lt: { kicker: 'Figma · GurtOS foundations', title: 'Colors and type drift apart', t: 0.3, dur: 2.0 } } },
        { cue: 'so', v: { type: 'shot', frame: 'window', src: repo(F + 'ecosystem-map.png'), enter: 'iris',
            lt: { kicker: 'FigJam ecosystem map · 2 min', title: 'Everything starts from one design system', t: 0.5 } } }] },
    // 2. Stage 1, ideation: the board and the research pinned, a string from each reference to a direction, the pick circled.
    { parts: [
        { v: { type: 'caseboard', bg: 'board', kicker: 'STAGE 1 · IDEATION · FigJam + Figma MCP server', items: [
            { id: 'brd', kind: 'photo', src: repo(F + 'ideation-board.png'), x: 450, y: 110, w: 760, rot: -1.5, at: 0.1, caption: 'FigJam ideation board' },
            { id: 'r1', kind: 'photo', src: repo(F + 'refs/01-umbrelos-home.jpg'), x: 1130, y: 110, w: 270, rot: 2, cue: 'two', caption: 'umbrelOS' },
            { id: 'r2', kind: 'photo', src: repo(F + 'refs/03-zimaos-dashboard.jpg'), x: 1440, y: 130, w: 270, rot: -2, cue: 'fifteen', caption: 'ZimaOS' },
            { id: 'r3', kind: 'photo', src: repo(F + 'refs/05-steamos-home.jpg'), x: 1750, y: 105, w: 270, rot: 1.5, cue: 'real', caption: 'SteamOS' },
            { id: 'da', kind: 'photo', src: repo(F + 'directions/a-home-server-box.png'), x: 1010, y: 560, w: 300, rot: -1.5, cue: 'drew', after: 'gathered', caption: 'A · Home-server OS',
              marks: [{ cue: 'picked', kind: 'circle', x: 0.18, y: 0.15, w: 0.64, h: 0.7, color: 'done' }] },
            { id: 'db', kind: 'photo', src: repo(F + 'directions/b-console-box.png'), x: 1370, y: 600, w: 300, rot: 1, cue: 'three', after: 'gathered', caption: 'B · Console' },
            { id: 'dc', kind: 'photo', src: repo(F + 'directions/c-hardware-box.png'), x: 1730, y: 565, w: 300, rot: -1, cue: 'directions', after: 'gathered', caption: 'C · Hardware OS' },
            { id: 'pk', kind: 'note', text: 'I picked this one', x: 730, y: 700, w: 230, rot: -4, cue: 'picked' }],
          strings: [{ from: 'r1', to: 'da', cue: 'three', after: 'gathered', sag: 30 }, { from: 'r2', to: 'db', cue: 'directions', after: 'gathered', sag: 30 },
            { from: 'r3', to: 'dc', cue: 'directions', after: 'gathered', off: 0.3, sag: 30 }] } },
        { cue: 'minutes', after: 'picked', v: result(1, 42, 'ideation') }] },
    // 3. Stage 2, prototyping: phone frames fanned as tilted cards, four flows and 136 links, the setup steps, the approval,
    // the undo, then one phone match-cut across the three editions.
    { parts: [
        { v: { type: 'caseboard', bg: 'night', kicker: 'STAGE 2 · PROTOTYPING · Figma Design + Figma Make', items: [
            { id: 'l', kind: 'photo', frame: 'tilt', tiltY: 16, tiltX: 3, src: repo(F + 'os-v2/phone/1-home.png'), x: 690, y: 210, w: 300, rot: -7, at: 0.3 },
            { id: 'r', kind: 'photo', frame: 'tilt', tiltY: -16, tiltX: 3, src: repo(F + 'os-v2/phone/4-tasks.png'), x: 1230, y: 210, w: 300, rot: 7, at: 0.5 },
            { id: 'm', kind: 'photo', frame: 'tilt', tiltY: 0, tiltX: 2, src: repo(F + 'os-v2/phone/2-approval-notification.png'), x: 960, y: 150, w: 300, rot: 0, at: 0.8 }] } },
        { cue: 'four', v: { type: 'scoreboard', bg: 'grid', kicker: 'THE PROTOTYPE · GurtOS screens v2', items: [
            { n: '4', label: 'flows across the new screens', cue: 'four', color: 'accent' },
            { n: '136', label: 'prototype links', cue: 'one', color: 'accent' }], source: 'docs/stagelog.md', sourceAt: { cue: 'one' } } },
        { cue: 'all', v: { type: 'pair', items: [
            { src: repo(F + 'os-v2/setup/01-welcome.png'), label: 'Step 1: Welcome' },
            { src: repo(F + 'os-v2/setup/12-done.png'), label: 'Step 12: Done', at: 0.15, color: 'amber' }] } },
        { cue: 'approving', v: { type: 'shot', bg: 'desk', frame: 'tilt', tiltY: -12, src: repo(F + 'os-v2/phone/2-approval-notification.png'), enter: 'flip', box: { cx: 960, cy: 520, w: 520, h: 900 },
            lt: { kicker: 'Flow · phone', title: 'Approving a spend', t: 0.05, dur: 1.4 },
            marks: [{ cue: 'phone', kind: 'box', x: 0.523, y: 0.506, w: 0.413, h: 0.052, color: 'amber' }] } },
        { cue: 'undoing', v: { type: 'shot', frame: 'window', src: repo(F + 'os-v2/windows/task-detail-undo-confirm.png'), enter: 'whip-l',
            marks: [{ cue: 'task', kind: 'box', x: 0.389, y: 0.45, w: 0.219, h: 0.192, color: 'amber' }] } },
        { cue: 'a', after: 'undoing', v: { type: 'shot', bg: 'desk', frame: 'window', src: repo(F + 'phone-app/2a-home-server.png'), enter: 'cut', caption: 'Edition: Server', box: { cx: 960, cy: 450, w: 440, h: 760 } } },
        { cue: 'switches', v: { type: 'shot', bg: 'desk', frame: 'window', src: repo(F + 'phone-app/2b-home-personal.png'), enter: 'cut', caption: 'Edition: Personal', box: { cx: 960, cy: 450, w: 440, h: 760 } } },
        { cue: 'edition', v: { type: 'shot', bg: 'desk', frame: 'window', src: repo(F + 'phone-app/2c-home-business-rosa.png'), enter: 'cut', caption: 'Edition: Business', box: { cx: 960, cy: 450, w: 440, h: 760 } } },
        { cue: 'sixty', v: result(2, 61, 'prototyping') }] },
    // 4. Stage 3, handoff: the variable and its CSS name on a case file, the two accent values side by side, the sync check
    // typed in a terminal, the drift counts (18, then 0).
    { parts: [
        { v: { type: 'exhibit', bg: 'board', label: 'STAGE LOG · STAGE 3', size: 76, enter: 'flip', lines: [
            { text: 'Handoff', mark: true, at: 0.2 }, { text: 'Figma Design + Figma MCP server', dim: true, at: 0.9 }] } },
        { cue: 'every', v: { type: 'dossier', tab: 'HANDOFF · VARIABLE TO CSS', title: 'Every Figma variable carries its CSS name', enter: 'slide-up', fields: [
            { k: 'window/bg', v: '--color-window-bg', cue: 'variable' },
            { k: 'space/xs', v: '--space-xs', cue: 'css' },
            { k: 'motion/duration-fast', v: '--duration-fast', cue: 'code' }] } },
        { cue: 'accent', v: { type: 'pair', items: [
            { src: cap('figma-accent-light.png'), label: 'Light #2F64A6', color: 'accent',
              marks: [{ cue: 'light', kind: 'circle', x: 0.037, y: 0.143, w: 0.17, h: 0.143, color: 'amber' }] },
            { src: cap('figma-accent-dark.png'), label: 'Dark #78A9E6', cue: 'dark', color: 'amber',
              marks: [{ cue: 'dark', off: 0.3, kind: 'circle', x: 0.037, y: 0.143, w: 0.17, h: 0.143, color: 'amber' }] }] } },
        { cue: 'script', v: { type: 'terminal', title: 'terminal', bg: 'night', enter: 'iris', size: 44, lines: [
            { text: 'node docs/figma/tokens/sync.ts --check', cmd: true, cue: 'script' },
            { text: 'Exports all 82 Figma tokens, fails on drift', kind: 'out', cue: 'eighty' }] } },
        { cue: 'found', v: { type: 'scoreboard', bg: 'grid', kicker: 'THE DRIFT CHECK · node docs/figma/tokens/sync.ts --check', size: 190, items: [
            { n: '18', label: 'drifts on the first run', cue: 'eighteen', color: 'blocked' },
            { n: '0', label: 'drifts across 82 Figma tokens', cue: 'today', color: 'done' }], source: 'Run on Oct 25', sourceAt: { cue: 'today' } } },
        { cue: 'sixty', v: result(3, 67, 'handoff') }] },
    // 5. Stage 4, code generation: each approved frame cuts to its running app (same framing, a hard cut on the word).
    { parts: [
        { v: { type: 'shot', frame: 'window', src: repo(F + 'os-v2/desktop/home-approval-banner.png'), enter: 'cut', box: MATCH, caption: 'The Figma frame',
            lt: { kicker: 'Stage 4 · Figma MCP server (get_design_context)', title: 'Code generation', t: 0.2, dur: 2.4 } } },
        { cue: 'portal', v: { type: 'shot', frame: 'window', src: repo('portal/screenshots/desktop.png'), enter: 'cut', box: MATCH, caption: 'The portal it became' } },
        { cue: 'business', v: { type: 'shot', frame: 'paper', src: repo(F + 'business/1a-people.png'), enter: 'cut', rot: -1, box: { ...MATCH, w: 1240, h: 680 }, caption: 'Business frame' } },
        { cue: 'frames', after: 'business', v: { type: 'shot', frame: 'paper', src: repo('showcase/src/assets/repo/business/1a-people.png'), enter: 'cut', rot: -1, box: { ...MATCH, w: 1240, h: 680 }, caption: 'Business app' } },
        { cue: 'personal', v: { type: 'shot', frame: 'tilt', tiltY: 10, src: repo(F + 'os-v2/personal/review-keep-or-undo.png'), enter: 'cut', box: MATCH, caption: 'Personal frame' } },
        { cue: 'libadwaita', v: { type: 'shot', frame: 'tilt', tiltY: 10, src: repo('showcase/src/assets/repo/personal/14-review.png'), enter: 'cut', box: MATCH, caption: 'Personal app' } },
        { cue: 'three', v: result(4, 349, 'code generation') }] },
    // 6. One web kit for Server and Business, native Personal, then the three-up compare page with its one zoom.
    { parts: [
        { v: { type: 'pair', items: [
            { src: repo('portal/screenshots/desktop.png'), label: 'Server: the web kit' },
            { src: repo('showcase/src/assets/repo/business/1a-people.png'), label: 'Business: the same kit', cue: 'business', enter: 'wipe', color: 'amber' }] } },
        { cue: 'personal', v: { type: 'shot', frame: 'tilt', tiltY: -9, src: repo('showcase/src/assets/repo/personal/14-review.png'), enter: 'whip-l',
            lt: { kicker: 'Personal', title: 'Native, same colors and type', t: 0.3, dur: 3.0 } } },
        { cue: 'script', v: { type: 'shot', frame: 'window', src: repo(F + 'compare/desktop.png'), enter: 'wipe-down', note: '77 frames, each with a score',
            moves: [{ cue: 'scores', s: 2.4, px: 0.13, py: 0.1, d: 0.8 }],
            marks: [{ cue: 'scores', off: 0.4, kind: 'underline', x: 0.078, y: 0.034, w: 0.126, h: 0.057, color: 'amber' }] } }] },
    // 7. Everything around the system, pinned: the deck, the landing page, the Community cover, Dev Mode, and Code Connect
    // stamped NOT PUBLISHED.
    { parts: [
        { v: { type: 'caseboard', bg: 'board', kicker: 'AROUND THE DESIGN SYSTEM', items: [
            { id: 'dk', kind: 'card', label: 'FIGMA SLIDES', title: 'A 16-slide deck', x: 330, y: 130, w: 420, rot: -2, cue: 'sixteen' },
            { id: 'ld', kind: 'photo', src: cap('figma-landing-hero.png'), x: 900, y: 110, w: 600, rot: 1.5, cue: 'landing', caption: 'Landing page on Figma Sites' },
            { id: 'cm', kind: 'photo', src: repo(F + 'community/cover.png'), x: 1540, y: 140, w: 480, rot: -1.5, cue: 'community', caption: 'Community playbook' },
            { id: 'dv', kind: 'card', label: 'DEV MODE · KIT CODE ON 95 COMPONENTS', title: '<Button kind="suggested" onClick={approve}>Approve $8.00</Button>', lines: ['portal/src/kit/ui.tsx'],
              x: 600, y: 520, w: 780, rot: 1, cue: 'dev' },
            { id: 'cc', kind: 'card', label: 'CODE CONNECT', title: '95 templates written', lines: [{ text: 'Needs an Organization plan', cue: 'organization' }, { text: 'Rated 3 of 5', cue: 'rated' }],
              x: 1500, y: 520, w: 640, rot: -1.5, cue: 'connect', stampH: 255,
              stamps: [{ text: 'NOT PUBLISHED', cue: 'unpublished', color: 'blocked', x: 0.5, y: 1.22, rot: -6, size: 52 }] }] } }] },
    // 8. The whole stage log, then the end card.
    { hold: 3, parts: [
        { v: { type: 'scoreboard', bg: 'grid', kicker: 'STAGE LOG · EACH 4 OF 5', size: 170, items: [
            { n: '42', label: 'minutes of ideation', at: 0.1, color: 'done' }, { n: '61', label: 'minutes of prototyping', at: 0.4, color: 'done' },
            { n: '67', label: 'minutes of handoff', at: 0.7, color: 'done' }, { n: '349', label: 'minutes of code generation', at: 1.0, color: 'done' }],
          source: 'docs/stagelog.md', sourceAt: { at: 1.4 } } },
        { cue: 'open', v: { type: 'end', lines: ['gurtos.com', 'github.com/benz16107/gurtos', 'Open source, Apache-2.0'] } }] },
  ],
};
