// Moss: memory that can't be poisoned (tracks/moss.md). Format: a spoken-word film. Hard cuts on the word, real Personal
// screens held still, and the narration's key words landing on screen as big labels one at a time as the voice says them
// (the kit has no kinetic-type layer, so each word is a label on an invisible mark). The planted memory is the only drama:
// one circle on it, one BLOCKED stamp on the no, one zoom on its text. Real screenshots only: the Personal desktop, the Find
// app, the task page with the planted memory (scripted agent). T-MO-01 to T-MO-03 live captures are not recorded.
// TODO cap:moss-planted.mp4 (T-MO-01, the notification and the blocked row), cap:moss-search.mp4 (T-MO-02), cap:moss-voice.mp4 (T-MO-03).
// If a voice take is added and uses a typed stand-in for the microphone, say so in its lower third.
const cap = (f) => `cap:${f}`, repo = (f) => `repo:${f}`;
const SCRIPTED = 'Scripted agent: same steps every take';

// A big word that lands on its cue: an invisible mark (no stroke) whose label is the type. cx and top are in the pane's pixels.
const word = (cue, text, cx, top, fw, fh, o = {}) => ({ cue, kind: 'underline', weight: 0, x: cx / fw, y: (top - 34) / fh, w: 0.001, h: 0.001,
  label: text, side: 'below', labelW: o.labelW ?? 800, size: o.size ?? 96, color: o.color ?? 'amber', after: o.after });

export default {
  title: "GurtOS for Moss: memory that can't be poisoned",
  edition: 'personal',
  maxDur: 90,
  music: 'bed-voice-long.wav',
  style: { bg: 'plain' },
  card: { sponsor: 'Moss', track: 'Agents that remember you', editions: ['personal'] },
  beats: [
    // 1. The problem, over the real Personal desktop held still (the product is on screen from the first word).
    { hold: 0.6, v: { type: 'shot', frame: 'full', src: repo('showcase/src/assets/repo/personal/12-approval.png'), enter: 'cut', marks: [
        word('someones', "someone's", 350, 260, 1920, 1080, { size: 100, labelW: 700 }),
        word('cloud', 'cloud', 790, 260, 1920, 1080, { size: 100, labelW: 500 }),
        word('a', 'a false', 300, 420, 1920, 1080, { size: 100, labelW: 700, color: 'blocked', after: 'plant' }),
        word('memory', 'memory', 710, 420, 1920, 1080, { size: 100, labelW: 700, color: 'blocked' })] } },
    // 2. Hard cut to the Find app: the Moss index lives in the computer's memory; agents search it with no network and no keys.
    { hold: 0.8, v: { type: 'shot', frame: 'window', src: repo('showcase/src/assets/track/moss/find-search.png'), enter: 'cut', marks: [
        word('no', 'no network', 1000, 240, 1560, 702, { size: 100, labelW: 900, color: 'accent' }),
        word('no', 'no keys', 1000, 400, 1560, 702, { size: 100, labelW: 900, color: 'accent', after: 'network' })] } },
    // 3. The planted memory: one zoom on its text and one circle, the owner says no (BLOCKED), then the task list shows it
    // is not shared with agents.
    { hold: 0.8, parts: [
        { v: { type: 'shot', frame: 'window', src: repo('showcase/src/assets/track/moss/plant-ask.png'), enter: 'cut', note: SCRIPTED,
            moves: [{ cue: 'proposed', s: 1.8, px: 0.29, py: 0.2, d: 0.7 }, { cue: 'gurt', s: 1, d: 0.7 }],
            marks: [{ cue: 'always', kind: 'circle', x: 0.169, y: 0.194, w: 0.229, h: 0.027, color: 'blocked' },
              { cue: 'no', kind: 'circle', x: 0.557, y: 0.209, w: 0.034, h: 0.046, color: 'amber' }],
            stamp: { text: 'BLOCKED', cue: 'blocked', color: 'blocked', x: 0.7, y: 0.52, rot: -7, size: 96 } } },
        { cue: 'stored', v: { type: 'shot', frame: 'window', src: cap('moss-tasks.png'), enter: 'cut', note: 'Find: Not shared with agents',
            marks: [{ cue: 'nowhere', kind: 'circle', x: 0.726, y: 0.717, w: 0.157, h: 0.056, color: 'blocked' },
              { cue: 'never', kind: 'underline', weight: 0, x: 0.6, y: 0.72, w: 0.001, h: 0.001, color: 'amber', label: 'Never handed to a later task', side: 'left', labelW: 600, size: 34 }] } }] },
    // 4. Search time on a counter, one preference for every app, Forget.
    { hold: 0.6, parts: [
        { v: { type: 'scoreboard', bg: 'grid', kicker: 'THE MOSS INDEX · IN THE COMPUTER\'S MEMORY', size: 230, items: [
            { n: '3.1 ms', label: 'median search time, through the computer', cue: 'three', color: 'accent' }],
          source: 'Two test VMs · docs/story.md', sourceAt: { at: 0.8 }, srcTop: 640 } },
        { cue: 'one', after: 'milliseconds', v: { type: 'shot', frame: 'window', src: cap('moss-memory.png'), enter: 'cut', marks: [
            { cue: 'preference', kind: 'underline', x: 0.029, y: 0.55, w: 0.373, h: 0.04, color: 'amber', label: 'One preference, every app', side: 'right', labelW: 700 },
            { cue: 'forget', kind: 'circle', x: 0.91, y: 0.735, w: 0.048, h: 0.04, color: 'blocked', label: 'Out of the index', side: 'left', labelW: 480 },
            { cue: 'log', kind: 'underline', weight: 0, x: 0.5, y: 0.83, w: 0.001, h: 0.001, color: 'accent', label: 'In the log: the id, never the content', side: 'below', labelW: 1100, size: 40 }] } }] },
    // 5. Talk to your computer; voice can approve only a request that spends nothing (the words land on theirs); end card.
    { hold: 3.0, parts: [
        { v: { type: 'shot', frame: 'window', src: cap('moss-tray.png'), enter: 'cut', note: 'Super + Alt + Space, or this menu item',
            marks: [{ cue: 'ask', kind: 'circle', x: 0.488, y: 0.764, w: 0.171, h: 0.026, color: 'amber' }] } },
        { cue: 'voice', v: { type: 'lines', kicker: 'Voice can approve only', size: 120, lines: [
            { text: 'A request', cue: 'request' }, { text: 'that spends', cue: 'spends' }, { text: 'nothing', cue: 'nothing' }] } },
        { cue: 'gurt', v: { type: 'end', lines: ['gurtos.com', 'github.com/benz16107/calhacks13', 'Open source, Apache-2.0'] } }] },
  ],
};
