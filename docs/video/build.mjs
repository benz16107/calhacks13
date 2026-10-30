#!/usr/bin/env node
// Build one video from its spec into a HyperFrames project, then (with --render) render it.
//   node docs/video/build.mjs main            -> docs/video/build/main/ (open it in Studio, or check it)
//   node docs/video/build.mjs main --render   -> also docs/video/out/main.mp4 and main.srt
// A spec (films/<id>.mjs) lists one beat per narration paragraph of its script; the voice (narration/say.py) sets every
// beat's length, and a visual can wait for a spoken word (`cue: 'Undo'`). Media: 'repo:<path>' (a file in this repo),
// 'cap:<file>' (studio/assets/capture), 'brand:<file>' (studio/assets/brand).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { kit } from './kit.mjs';

const HERE = import.meta.dirname, REPO = path.resolve(HERE, '../..'), STUDIO = path.join(HERE, 'studio');
const HF = 'hyperframes@0.8.193';
const W = 1920, H = 1080;
const FRAME = { cx: 960, cy: 468, w: 1560, h: 836 }; // media sits here; captions sit under it, lower thirds on it
const C = { ground: '#171e25', surface: '#222c36', sunken: '#2f3c4a', ink: '#f2efe8', ink2: '#b9c0c8', accent: '#8db4dd',
  accentBg: '#203247', amber: '#f2b544', blocked: '#f0a493', blockedBg: '#3d2622', done: '#9fd0a6', doneBg: '#20352a',
  rule: '#3a4653', edition: { server: '#8a9bad', personal: '#f2b544', business: '#8db4dd' } };
// The narration spells some names out so the voice says them right; captions show them as written.
const SHOW = [[['Gurt', 'O.S.'], 'GurtOS'], [['x', 'four', 'oh', 'two'], 'x402'], [['Spacetime', 'D', 'B'], 'SpacetimeDB'],
  [['app', 'dot', 'gurtos', 'dot', 'com'], 'app.gurtos.com'], [['ASI', 'One'], 'ASI:One']];

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const r3 = (n) => Math.round(n * 1000) / 1000;
const probe = (f) => parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString());
const dims = (f) => execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', f]).toString().trim().split(',').map(Number);

// ---------- words and captions ----------

export function wordsOf(alignment, offset = 0) {
  const { characters: ch, character_start_times_seconds: s, character_end_times_seconds: e } = alignment;
  const out = [];
  let cur = null;
  ch.forEach((c, i) => {
    if (/\s/.test(c)) { if (cur) out.push(cur); cur = null; return; }
    if (!cur) cur = { text: '', start: s[i] + offset, end: e[i] + offset };
    cur.text += c;
    cur.end = e[i] + offset;
  });
  if (cur) out.push(cur);
  return out;
}

// Join the spelled-out names back (Gurt O.S. -> GurtOS), keeping punctuation that follows the last part.
export function forDisplay(words) {
  const bare = (t) => t.replace(/[.,:;!?]+$/, '');
  const out = [];
  for (let i = 0; i < words.length; i++) {
    const hit = SHOW.find(([seq]) => seq.every((p, k) => words[i + k] && (k === seq.length - 1 ? words[i + k].text.startsWith(p) : bare(words[i + k].text) === p)));
    if (!hit) { out.push({ ...words[i] }); continue; }
    const [seq, shown] = hit, last = words[i + seq.length - 1];
    out.push({ text: shown + last.text.slice(seq[seq.length - 1].length), start: words[i].start, end: last.end });
    i += seq.length - 1;
  }
  return out;
}

export function groupsOf(words) {
  const groups = [];
  let g = [];
  const len = (ws) => ws.map((w) => w.text).join(' ').length;
  words.forEach((w, i) => {
    const next = words[i + 1];
    g.push(w);
    const sentence = /[.!?:]$/.test(w.text), comma = /[,;]$/.test(w.text), gap = next ? next.start - w.end : 9;
    if (!next || gap > 0.35 || sentence || (comma && g.length >= 3) || g.length >= 7 || (next && len([...g, next]) > 40)) {
      groups.push(g);
      g = [];
    }
  });
  return groups.map((ws, i) => {
    const start = Math.max(0, ws[0].start - 0.08);
    const nextStart = groups[i + 1] ? groups[i + 1][0].start - 0.08 : Infinity;
    return { words: ws, start: r3(start), end: r3(Math.min(ws[ws.length - 1].end + 0.35, nextStart - 0.02)) };
  });
}

const srtTime = (t) => { const ms = Math.round(t * 1000); const p = (n, w = 2) => String(n).padStart(w, '0'); return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`; };
export const srtOf = (groups) => groups.map((g, i) => `${i + 1}\n${srtTime(g.start)} --> ${srtTime(g.end)}\n${g.words.map((w) => w.text).join(' ')}\n`).join('\n');

// ---------- scenes ----------

const FONTS = `
@font-face { font-family: "Atkinson Hyperlegible Next"; font-weight: 400; src: url("assets/fonts/atkinson-hyperlegible-next-latin-400-normal.woff2") format("woff2"); }
@font-face { font-family: "Atkinson Hyperlegible Next"; font-weight: 600; src: url("assets/fonts/atkinson-hyperlegible-next-latin-600-normal.woff2") format("woff2"); }
@font-face { font-family: "Atkinson Hyperlegible Next"; font-weight: 700; src: url("assets/fonts/atkinson-hyperlegible-next-latin-700-normal.woff2") format("woff2"); }
@font-face { font-family: "Atkinson Hyperlegible Mono"; font-weight: 400; src: url("assets/fonts/atkinson-hyperlegible-mono-latin-400-normal.woff2") format("woff2"); }`;

// A scene file: one composition, its own paused timeline. `body` is markup inside #root; `js` adds tweens to `tl`.
function scene(id, dur, { css = '', body = '', js = '', ground = true, hills = false }) {
  return `<template>
  <style>${FONTS}
    #root { position: absolute; inset: 0; overflow: hidden; font-family: "Atkinson Hyperlegible Next", sans-serif; color: ${C.ink};${ground ? ` background: ${C.ground};` : ''} }
    #root .mono { font-family: "Atkinson Hyperlegible Mono", monospace; }
    #${id}-hills { position: absolute; left: 0; top: 0; width: ${W}px; height: ${H}px; }
    ${css}
  </style>
  <div id="root" data-composition-id="${id}" data-width="${W}" data-height="${H}">
    ${hills ? `<img id="${id}-hills" class="clip" data-layout-allow-overflow src="assets/brand/hills-dark.svg" alt="" data-start="0" data-duration="${r3(dur)}" data-track-index="0" />` : ''}
    <div id="${id}-c" style="position:absolute;inset:0" data-layout-allow-overflow>${body}</div>
  </div>
  <script>
    (function () {
      const tl = gsap.timeline({ paused: true });
      const $ = (s) => document.querySelector(s);
      ${hills ? `tl.fromTo("#${id}-hills", { scale: 1.05, transformOrigin: "50% 100%" }, { scale: 1, duration: ${r3(dur)}, ease: "sine.out" }, 0);` : ''}
      ${js}
      window.__timelines["${id}"] = tl;
    })();
  </script>
</template>
`;
}

// Fit a w x h box inside the frame area; returns its placement.
function fit(w, h, box = FRAME) {
  const s = Math.min(box.w / w, box.h / h);
  return { w: Math.round(w * s), h: Math.round(h * s), x: Math.round(box.cx - (w * s) / 2), y: Math.round(box.cy - (h * s) / 2), s };
}

// Camera moves on a media wrapper: each move frames a point (px, py as fractions) at scale s, never showing an edge.
function moves(sel, fw, fh, list = [], drift = true, dur = 10) {
  let js = `tl.fromTo("${sel}", { x: 0, y: 0, scale: 1, transformOrigin: "0 0" }, { x: 0, y: 0, scale: 1, duration: 0.01 }, 0);`;
  if (drift && !list.length) js += `tl.to("${sel}", { scale: 1.035, x: ${-fw * 0.0175}, y: ${-fh * 0.0175}, duration: ${r3(dur)}, ease: "sine.inOut" }, 0.01);`;
  for (const m of list) {
    const s = m.s ?? 1, x = Math.min(0, Math.max(fw - fw * s, fw / 2 - (m.px ?? 0.5) * fw * s)), y = Math.min(0, Math.max(fh - fh * s, fh / 2 - (m.py ?? 0.5) * fh * s));
    js += `tl.to("${sel}", { scale: ${s}, x: ${r3(x)}, y: ${r3(y)}, duration: ${m.d ?? 0.6}, ease: "power3.inOut" }, ${r3(Math.max(0.02, m.t))});`;
  }
  return js;
}

function lowerThird(id, lt, edition, fx, fy) {
  if (!lt) return { body: '', js: '', css: '' };
  const t0 = lt.t ?? 0.35, d = lt.dur ?? 4.6;
  return {
    css: `#${id}-lt { position: absolute; left: ${fx + 30}px; top: ${fy + 28}px; display: flex; gap: 18px; padding: 16px 26px 18px 18px; background: rgba(23,30,37,0.86); border-radius: 12px; opacity: 0; }
      #${id}-lt i { width: 7px; border-radius: 4px; background: ${C.edition[lt.edition ?? edition] ?? C.accent}; display: block; transform-origin: 50% 0; }
      #${id}-lt .k { font-size: 28px; color: ${C.ink2}; } #${id}-lt .t { font-size: 44px; font-weight: 700; line-height: 1.1; margin-top: 4px; }`,
    body: `<div id="${id}-lt"><i id="${id}-lt-bar"></i><div><div class="k mono">${esc(lt.kicker ?? '')}</div><div class="t">${esc(lt.title)}</div></div></div>`,
    js: `tl.fromTo("#${id}-lt", { opacity: 0, x: -20 }, { opacity: 1, x: 0, duration: 0.45, ease: "power3.out" }, ${t0});
      tl.fromTo("#${id}-lt-bar", { scaleY: 0 }, { scaleY: 1, duration: 0.45, ease: "power3.out" }, ${t0 + 0.05});
      tl.to("#${id}-lt", { opacity: 0, duration: 0.3, ease: "power2.in" }, ${r3(t0 + d)});`,
  };
}

function note(id, text, left, top) { // bottom-left inside the frame: the box screen's wallpaper, clear of the dock and banners
  if (!text) return { body: '', css: '', js: '' };
  return {
    css: `#${id}-note { position: absolute; left: ${left}px; bottom: ${H - top}px; padding: 8px 16px; border-radius: 10px; background: rgba(23,30,37,0.86); font-size: 28px; color: ${C.ink2}; opacity: 0; }`,
    body: `<div id="${id}-note" class="mono">${esc(text)}</div>`,
    js: `tl.fromTo("#${id}-note", { opacity: 0 }, { opacity: 1, duration: 0.4 }, 0.5);`,
  };
}

const V = {
  // The title card every track video opens with; its frame at 1.9 s is the thumbnail.
  trackcard(id, v, dur) {
    const eds = ['server', 'personal', 'business'], name = { server: 'Server', personal: 'Personal', business: 'Business' };
    return scene(id, dur, { hills: true,
      css: `#${id}-b { position: absolute; left: 0; right: 0; top: 150px; display: flex; flex-direction: column; align-items: center; gap: 22px; text-align: center; }
        #${id}-k { font-size: 30px; color: ${C.ink2}; letter-spacing: 0.02em; }
        #${id}-lock { display: flex; align-items: center; gap: 30px; } #${id}-logo { width: 120px; height: 120px; }
        #${id}-t { font-size: ${v.size ?? 118}px; font-weight: 700; line-height: 1.02; }
        #${id}-s { font-size: 46px; color: ${C.ink}; font-weight: 600; max-width: 1500px; line-height: 1.2; }
        #${id}-e { display: flex; align-items: center; gap: 16px; margin-top: 18px; font-size: 30px; color: ${C.ink2}; }
        #root .chip { display: flex; align-items: center; gap: 12px; padding: 10px 22px; border-radius: 999px; background: rgba(23,30,37,0.78); border: 2px solid rgba(242,239,232,0.16); font-size: 30px; font-weight: 700; color: ${C.ink}; }
        #root .chip.off { opacity: 0.38; } #root .chip i { width: 16px; height: 16px; border-radius: 50%; display: block; }`,
      body: `<div id="${id}-b"><div id="${id}-k" class="mono">${esc(v.kicker ?? 'Cal Hacks 13')}</div>
        <div id="${id}-lock"><img id="${id}-logo" src="assets/brand/logo.svg" alt="GurtOS" /><div id="${id}-t">GurtOS for ${esc(v.sponsor)}</div></div>
        <div id="${id}-s">${esc(v.track)}</div>
        <div id="${id}-e"><span>Best shown in</span>${eds.map((e) => `<div class="chip${v.editions.includes(e) ? '' : ' off'}" id="${id}-${e}"><i style="background:${C.edition[e]}"></i>${name[e]}</div>`).join('')}</div></div>`,
      js: `tl.fromTo("#${id}-k", { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.35, ease: "power3.out" }, 0.05);
        tl.fromTo("#${id}-logo", { opacity: 0, scale: 0.85 }, { opacity: 1, scale: 1, duration: 0.45, ease: "back.out(1.6)" }, 0.1);
        tl.fromTo("#${id}-t", { clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0% 0 0)", duration: 0.55, ease: "power3.inOut" }, 0.2);
        tl.fromTo("#${id}-s", { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.4, ease: "power3.out" }, 0.55);
        tl.fromTo("#${id}-e", { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.4, ease: "power3.out" }, 0.75);
        tl.to("#${id}-b", { opacity: 0, duration: 0.3, ease: "power2.in" }, ${r3(dur - 0.32)});`,
    });
  },

  // The opening hook: real product shots cut quickly under the title.
  montage(id, v, dur, ctx) {
    const n = v.items.length, seg = dur / n;
    return scene(id, dur, {
      css: `#root .mv { position: absolute; left: 0; top: 0; width: ${W}px; height: ${H}px; object-fit: cover; }
        #${id}-shade { position: absolute; inset: 0; background: radial-gradient(ellipse 62% 46% at 50% 46%, rgba(23,30,37,0.9) 0%, rgba(23,30,37,0.72) 55%, rgba(23,30,37,0.35) 100%); }
        #${id}-b { position: absolute; left: 0; right: 0; top: 330px; display: flex; flex-direction: column; align-items: center; gap: 26px; }
        #${id}-lock { display: flex; align-items: center; gap: 34px; } #${id}-logo { width: 140px; height: 140px; }
        #${id}-word { font-size: 140px; font-weight: 700; line-height: 1; } #${id}-sub { font-size: 50px; color: ${C.ink}; }`,
      body: v.items.map((it, i) => `<video id="${id}-v${i}" class="clip mv" src="${ctx.media(it.src)}" data-start="${r3(i * seg)}" data-duration="${r3(seg)}" data-media-start="${it.from ?? 0}" data-track-index="${2 + i}" muted playsinline></video>`).join('') +
        `<div id="${id}-shade"></div><div id="${id}-b"><div id="${id}-lock"><img id="${id}-logo" src="assets/brand/logo.svg" alt="GurtOS" /><div id="${id}-word">GurtOS</div></div><div id="${id}-sub">${esc(v.subtitle ?? 'Operating systems built for AI agents')}</div></div>`,
      js: `tl.fromTo("#${id}-logo", { opacity: 0, scale: 0.88 }, { opacity: 1, scale: 1, duration: 0.4, ease: "back.out(1.6)" }, 0.05);
        tl.fromTo("#${id}-word", { clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0% 0 0)", duration: 0.5, ease: "power3.inOut" }, 0.15);
        tl.fromTo("#${id}-sub", { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.4, ease: "power3.out" }, 0.45);
        tl.to("#${id}-b", { opacity: 0, duration: 0.25, ease: "power2.in" }, ${r3(dur - 0.27)});`,
    });
  },

  // A cut to black: the power cut.
  black(id, v, dur) { return scene(id, dur, { ground: false, css: `#root { background: #000; }` }); },

  title(id, v, dur, ctx) {
    const chips = ['server', 'personal', 'business'].map((e) => `<div class="chip" id="${id}-${e}"><i style="background:${C.edition[e]}"></i>${e[0].toUpperCase() + e.slice(1)}</div>`).join('');
    const on = v.editions ?? [ctx.edition];
    return scene(id, dur, { hills: true,
      css: `#${id}-b { position: absolute; left: 0; right: 0; top: ${v.top ?? 230}px; display: flex; flex-direction: column; align-items: center; gap: 30px; }
        #${id}-lock { display: flex; align-items: center; gap: 36px; } #${id}-logo { width: 150px; height: 150px; }
        #${id}-word { font-size: 150px; font-weight: 700; line-height: 1; } #${id}-sub { font-size: 50px; color: ${C.ink2}; }
        #${id}-chips { display: flex; gap: 22px; margin-top: 14px; }
        #root .chip { display: flex; align-items: center; gap: 14px; padding: 12px 26px; border-radius: 999px; background: rgba(23,30,37,0.72); border: 2px solid rgba(242,239,232,0.16); font-size: 32px; font-weight: 700; opacity: 0; }
        #root .chip i { width: 18px; height: 18px; border-radius: 50%; display: block; }`,
      body: `<div id="${id}-b"><div id="${id}-lock"><img id="${id}-logo" src="assets/brand/logo.svg" alt="GurtOS" /><div id="${id}-word">${esc(v.title ?? 'GurtOS')}</div></div>
        <div id="${id}-sub">${esc(v.subtitle ?? 'Operating systems built for AI agents')}</div>${v.chips === false ? '' : `<div id="${id}-chips">${chips}</div>`}</div>`,
      js: `tl.fromTo("#${id}-logo", { opacity: 0, scale: 0.86, y: 18 }, { opacity: 1, scale: 1, y: 0, duration: 0.6, ease: "back.out(1.6)" }, 0.2);
        tl.fromTo("#${id}-word", { clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0% 0 0)", duration: 0.7, ease: "power3.inOut" }, 0.45);
        tl.fromTo("#${id}-sub", { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.5, ease: "power3.out" }, 1.0);
        ${['server', 'personal', 'business'].map((e, i) => `tl.fromTo("#${id}-${e}", { opacity: 0, y: 14 }, { opacity: ${on.includes(e) ? 1 : 0.45}, y: 0, duration: 0.4, ease: "power3.out" }, ${1.4 + i * 0.12});`).join('\n')}
        tl.to("#${id}-b", { opacity: 0, y: -18, duration: 0.35, ease: "power2.in" }, ${r3(dur - 0.4)});`,
    });
  },

  // Big lines that arrive on their words; `strike` crosses each out in the blocked colour after it lands.
  lines(id, v, dur, ctx) {
    const items = v.lines.map((l) => (typeof l === 'string' ? { text: l } : l));
    const size = v.size ?? (items.length > 4 ? 54 : 66);
    return scene(id, dur, { hills: v.hills ?? true,
      css: `#${id}-b { position: absolute; left: 300px; right: 200px; top: ${v.top ?? (items.length > 4 ? 120 : 170)}px; display: flex; flex-direction: column; gap: ${Math.round(size * 0.42)}px; }
        #${id}-k { font-size: 28px; color: ${C.ink2}; margin-bottom: 8px; }
        #root .ln { position: relative; align-self: flex-start; font-size: ${size}px; font-weight: 700; line-height: 1.15; opacity: 0; }
        #root .ln.dim { color: ${C.ink2}; font-weight: 600; }
        #root .ln.mono { font-family: "Atkinson Hyperlegible Mono", monospace; font-weight: 400; font-size: ${Math.round(size * 0.78)}px; }
        #root .ln.blocked { color: ${C.blocked}; }
        #root .ln s { position: absolute; left: -6px; right: -6px; top: 54%; height: 7px; border-radius: 4px; background: ${C.blocked}; transform-origin: 0 50%; text-decoration: none; }
        #${id}-src { font-size: 28px; color: ${C.ink2}; margin-top: 18px; opacity: 0; }`,
      body: `<div id="${id}-b">${v.kicker ? `<div id="${id}-k" class="mono">${esc(v.kicker)}</div>` : ''}
        ${items.map((l, i) => `<div class="ln${l.dim ? ' dim' : ''}${l.mono ? ' mono' : ''}${l.blocked ? ' blocked' : ''}" id="${id}-l${i}">${esc(l.text)}${v.strike && !l.keep ? `<s id="${id}-s${i}"></s>` : ''}</div>`).join('')}
        ${v.source ? `<div id="${id}-src" class="mono">${esc(v.source)}</div>` : ''}</div>`,
      js: items.map((l, i) => { const t = ctx.t(l, 0.3 + i * 0.5); return `tl.fromTo("#${id}-l${i}", { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.45, ease: "power3.out" }, ${r3(t)});` +
        (v.strike && !l.keep ? `tl.fromTo("#${id}-s${i}", { scaleX: 0 }, { scaleX: 1, duration: 0.35, ease: "power2.inOut" }, ${r3(t + 0.7)});` : ''); }).join('\n') +
        (v.source ? `tl.fromTo("#${id}-src", { opacity: 0 }, { opacity: 1, duration: 0.5 }, ${r3(ctx.t(v.sourceAt ?? {}, 0.6))});` : ''),
    });
  },

  // Numbers that count up on their words, each with a label; one source line under them.
  stats(id, v, dur, ctx) {
    return scene(id, dur, { hills: true,
      css: `#${id}-b { position: absolute; left: 300px; right: 150px; top: 150px; display: grid; grid-template-columns: repeat(${v.cols ?? v.items.length}, 1fr); gap: 40px; }
        #root .st { opacity: 0; } #root .st b { display: block; font-size: ${v.size ?? 112}px; font-weight: 700; line-height: 1; font-variant-numeric: tabular-nums; }
        #root .st span { display: block; font-size: 34px; color: ${C.ink2}; margin-top: 14px; line-height: 1.2; }
        #${id}-src { position: absolute; left: 300px; right: 150px; top: ${v.srcTop ?? 470}px; font-size: 28px; color: ${C.ink2}; line-height: 1.5; opacity: 0; }`,
      body: `<div id="${id}-b">${v.items.map((s, i) => `<div class="st" id="${id}-s${i}"><b id="${id}-n${i}">${esc(s.n)}</b><span>${esc(s.label)}</span></div>`).join('')}</div>
        ${v.source ? `<div id="${id}-src" class="mono">${esc(v.source)}</div>` : ''}`,
      js: v.items.map((s, i) => {
        const t = ctx.t(s, 0.3 + i * 0.6), num = Number(String(s.n).replace(/,/g, ''));
        const count = Number.isFinite(num) && num > 20 ? `{ const o = { v: 0 }, el = $("#${id}-n${i}"); tl.to(o, { v: ${num}, duration: 0.9, ease: "power2.out", onUpdate: () => { el.textContent = Math.round(o.v).toLocaleString("en-US"); } }, ${r3(t)}); }` : '';
        return `tl.fromTo("#${id}-s${i}", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.45, ease: "power3.out" }, ${r3(t)});${count}`;
      }).join('\n') + (v.source ? `tl.fromTo("#${id}-src", { opacity: 0 }, { opacity: 1, duration: 0.5 }, ${r3(ctx.t(v.sourceAt ?? {}, 1.2))});` : ''),
    });
  },

  // A screen recording in a window frame, cropped, with camera moves, a footnote and a lower third.
  clip(id, v, dur, ctx) {
    const [sw, sh] = dims(ctx.file(v.src));
    const crop = v.crop ?? { x: 0, y: 0, w: sw, h: sh };
    const f = fit(crop.w, crop.h, v.box ?? FRAME), k = f.w / crop.w;
    const lt = lowerThird(id, v.lt, ctx.edition, f.x, f.y), nt = note(id, v.note, f.x + 24, f.y + f.h * 0.86);
    const mv = (v.moves ?? []).map((m) => ({ ...m, t: ctx.t(m, 0) }));
    return scene(id, dur, {
      css: `#${id}-f { position: absolute; left: ${f.x}px; top: ${f.y}px; width: ${f.w}px; height: ${f.h}px; border-radius: ${v.radius ?? 15}px; overflow: hidden; border: 2px solid rgba(242,239,232,0.14); box-shadow: 0 30px 80px rgba(0,0,0,0.45); background: #000; }
        #${id}-p { position: absolute; left: 0; top: 0; width: ${f.w}px; height: ${f.h}px; }
        #${id}-v { position: absolute; left: ${r3(-crop.x * k)}px; top: ${r3(-crop.y * k)}px; width: ${r3(sw * k)}px; height: ${r3(sh * k)}px; }
        ${lt.css} ${nt.css}`,
      body: `<div id="${id}-f" data-layout-allow-overflow><div id="${id}-p" data-layout-allow-overflow>
        <video id="${id}-v" class="clip" src="${ctx.media(v.src)}" data-start="0" data-duration="${r3(dur)}" data-media-start="${v.from ?? 0}"${v.rate ? ` data-playback-rate="${v.rate}"` : ''} data-track-index="2" muted playsinline></video>
        </div></div>${lt.body}${nt.body}`,
      js: `tl.fromTo("#${id}-f", { opacity: 0, scale: 0.97 }, { opacity: 1, scale: 1, duration: 0.45, ease: "power3.out" }, 0);
        ${moves(`#${id}-p`, f.w, f.h, mv, v.drift !== false, dur)} ${lt.js} ${nt.js}`,
    });
  },

  // Two crops of one recording side by side (the box screen and the phone, recorded together in sync).
  split(id, v, dur, ctx) {
    const [sw, sh] = dims(ctx.file(v.src));
    const parts = v.crops.map((c, i) => {
      const box = { cx: c.cx, cy: FRAME.cy, w: c.bw, h: FRAME.h }, f = fit(c.w, c.h, box), k = f.w / c.w;
      return { i, c, f, k };
    });
    const lt = lowerThird(id, v.lt, ctx.edition, parts[0].f.x, parts[0].f.y), nt = note(id, v.note, parts[0].f.x + 24, parts[0].f.y + parts[0].f.h * 0.86);
    return scene(id, dur, {
      css: parts.map(({ i, c, f, k }) => `#${id}-f${i} { position: absolute; left: ${f.x}px; top: ${f.y}px; width: ${f.w}px; height: ${f.h}px; border-radius: ${c.radius ?? 15}px; overflow: hidden; border: 2px solid rgba(242,239,232,0.14); box-shadow: 0 30px 80px rgba(0,0,0,0.45); }
        #${id}-v${i} { position: absolute; left: ${r3(-c.x * k)}px; top: ${r3(-c.y * k)}px; width: ${r3(sw * k)}px; height: ${r3(sh * k)}px; }`).join('\n') + lt.css + nt.css,
      body: parts.map(({ i }) => `<div id="${id}-f${i}" data-layout-allow-overflow><video id="${id}-v${i}" class="clip" src="${ctx.media(v.src)}" data-start="0" data-duration="${r3(dur)}" data-media-start="${v.from ?? 0}" data-track-index="${2 + i}" muted playsinline></video></div>`).join('') + lt.body + nt.body,
      // enter: false starts the picture already in place (the video's first frame, which players show).
      js: (v.enter === false ? '' : parts.map(({ i }) => `tl.fromTo("#${id}-f${i}", { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.5, ease: "power3.out" }, ${0.1 * i});`).join('\n')) + lt.js + nt.js,
    });
  },

  // Real screenshots, one or several in a row, each arriving on its word. device: window | phone | watch | bare.
  stills(id, v, dur, ctx) {
    const items = v.items ?? [v];
    const gap = 56, maxH = v.h ?? FRAME.h - (items.some((s) => s.label) ? 60 : 0);
    const sized = items.map((s) => { const [w, h] = dims(ctx.file(s.src)); return { ...s, w, h }; });
    const scaleFor = (s) => (s.hf ?? (s.device === 'watch' ? 0.55 : 1)) * maxH / s.h; // hf: a share of the row height, so small screenshots stay near their own size
    let total = sized.reduce((a, s) => a + s.w * scaleFor(s), 0) + gap * (sized.length - 1);
    const shrink = Math.min(1, (v.maxW ?? FRAME.w) / total);
    total *= shrink;
    let x = FRAME.cx - total / 2;
    const placed = sized.map((s, i) => {
      const k = scaleFor(s) * shrink, w = Math.round(s.w * k), h = Math.round(s.h * k);
      const p = { ...s, i, x: Math.round(x), y: Math.round(FRAME.cy - h / 2 - (s.label ? 26 : 0)), w, h };
      x += w + gap * shrink;
      return p;
    });
    const radius = (s) => ({ phone: Math.round(s.w * 0.12), watch: Math.round(s.w * 0.22), bare: 10 }[s.device] ?? 15);
    const one = placed.length === 1 ? placed[0] : null;
    const lt = lowerThird(id, v.lt, ctx.edition, (one ?? placed[0]).x, (one ?? placed[0]).y);
    const nt = one ? note(id, v.note, one.x + 24, one.y + one.h - 24) : note(id, v.note, FRAME.cx - FRAME.w / 2, 86);
    return scene(id, dur, { hills: v.hills,
      css: placed.map((p) => `#${id}-i${p.i} { position: absolute; left: ${p.x}px; top: ${p.y}px; width: ${p.w}px; height: ${p.h}px; opacity: 0; }
        #${id}-m${p.i} { position: absolute; inset: 0; border-radius: ${radius(p)}px; overflow: hidden; border: 2px solid rgba(242,239,232,0.16); box-shadow: 0 30px 80px rgba(0,0,0,0.45); }
        #${id}-p${p.i} { position: absolute; left: 0; top: 0; width: ${p.w}px; height: ${p.h}px; }
        #${id}-p${p.i} img { width: ${p.w}px; height: ${p.h}px; display: block; }
        #${id}-c${p.i} { position: absolute; left: -40px; right: -40px; top: ${p.h + 16}px; text-align: center; font-size: 28px; font-weight: 600; color: ${C.ink2}; }`).join('\n') + lt.css + nt.css,
      body: placed.map((p) => `<div id="${id}-i${p.i}"><div id="${id}-m${p.i}" data-layout-allow-overflow><div id="${id}-p${p.i}" data-layout-allow-overflow><img src="${ctx.media(p.src)}" alt="${esc(p.alt ?? '')}" /></div></div>${p.label ? `<div id="${id}-c${p.i}">${esc(p.label)}</div>` : ''}</div>`).join('') + lt.body + nt.body,
      js: placed.map((p) => `tl.fromTo("#${id}-i${p.i}", { opacity: 0, y: 26 }, { opacity: 1, y: 0, duration: 0.5, ease: "power3.out" }, ${r3(ctx.t(p, 0.1 + p.i * 0.35))});` +
        (one ? moves(`#${id}-p${p.i}`, p.w, p.h, (v.moves ?? []).map((m) => ({ ...m, t: ctx.t(m, 0) })), v.drift !== false, dur) : '')).join('\n') + lt.js + nt.js,
    });
  },

  // The filesystem: your files at the bottom, each task a thin copy-on-write layer on top; undo lifts one out.
  layers(id, v, dur, ctx) {
    const L = v.layers;
    return scene(id, dur, { hills: false,
      css: `#${id}-k { position: absolute; left: 0; right: 0; top: 96px; text-align: center; font-size: 30px; color: ${C.ink2}; }
        #${id}-base { position: absolute; left: 460px; width: 1000px; top: 690px; height: 120px; border-radius: 14px; background: ${C.sunken}; border: 2px solid ${C.rule}; display: flex; align-items: center; justify-content: center; font-size: 40px; font-weight: 700; }
        #root .ly { position: absolute; left: 460px; width: 1000px; height: 96px; border-radius: 14px; background: ${C.accentBg}; border: 2px solid ${C.accent}; display: flex; align-items: center; gap: 28px; padding: 0 30px; font-size: 32px; opacity: 0; }
        #root .ly .u { font-size: 28px; color: ${C.accent}; } #root .ly .f { margin-left: auto; font-size: 28px; color: ${C.ink2}; }
        #${id}-cap { position: absolute; left: 0; right: 0; top: 836px; text-align: center; font-size: 30px; color: ${C.ink2}; opacity: 0; }`,
      body: `<div id="${id}-k" class="mono">${esc(v.kicker ?? 'One folder, three tasks at once')}</div>
        ${L.map((l, i) => `<div class="ly" id="${id}-l${i}" style="top:${574 - i * 112}px"><span class="u mono">${esc(l.user)}</span><span>${esc(l.task)}</span><span class="f mono">${esc(l.files)}</span></div>`).join('')}
        <div id="${id}-base">${esc(v.base ?? 'Your files')}</div>${v.caption ? `<div id="${id}-cap">${esc(v.caption)}</div>` : ''}`,
      js: `tl.fromTo("#${id}-base", { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.5, ease: "power3.out" }, 0.2);
        ${L.map((l, i) => `tl.fromTo("#${id}-l${i}", { opacity: 0, y: -120 }, { opacity: 1, y: 0, duration: 0.55, ease: "power3.out" }, ${r3(ctx.t(l, 0.8 + i * 0.6))});`).join('\n')}
        ${v.undo != null ? `tl.to("#${id}-l${v.undo}", { x: 1200, opacity: 0, duration: 0.7, ease: "power3.in" }, ${r3(ctx.t(v.undoAt ?? {}, dur - 2))});` : ''}
        ${v.caption ? `tl.fromTo("#${id}-cap", { opacity: 0 }, { opacity: 1, duration: 0.5 }, ${r3(ctx.t(v.captionAt ?? {}, 2.5))});` : ''}`,
    });
  },

  // The attack scoreboard: rows fill in, each with its result.
  board(id, v, dur, ctx) {
    const rows = v.rows, half = Math.ceil(rows.length / 2);
    const tag = (r) => r.ok ? `<b style="color:${C.done};background:${C.doneBg}">Caught</b>` : `<b style="color:${C.blocked};background:${C.blockedBg}">Not covered</b>`;
    const t0 = ctx.t(v, 0.3), step = v.step ?? Math.min(0.28, (dur - 3) / rows.length);
    return scene(id, dur, {
      css: `#${id}-h { position: absolute; left: 120px; right: 120px; top: 70px; display: flex; align-items: baseline; gap: 40px; }
        #${id}-h .t { font-size: 52px; font-weight: 700; } #${id}-h .n { font-size: 34px; color: ${C.ink2}; }
        #${id}-g { position: absolute; left: 120px; right: 120px; top: 172px; display: grid; grid-template-columns: 1fr 1fr; column-gap: 40px; row-gap: 12px; grid-auto-flow: column; grid-template-rows: repeat(${half}, 68px); }
        #root .rw { display: flex; align-items: center; gap: 18px; padding: 0 20px; border-radius: 12px; background: ${C.surface}; font-size: 29px; line-height: 1.15; opacity: 0; }
        #root .rw b { margin-left: auto; flex: none; font-size: 28px; padding: 4px 16px; border-radius: 999px; }
        #${id}-src { position: absolute; left: 120px; right: 120px; top: ${172 + half * 80 + 8}px; font-size: 28px; color: ${C.ink2}; opacity: 0; }`,
      body: `<div id="${id}-h"><span class="t">${esc(v.title)}</span><span class="n" id="${id}-n">${esc(v.summary ?? '')}</span></div>
        <div id="${id}-g">${rows.map((r, i) => `<div class="rw" id="${id}-r${i}"><span>${esc(r.label)}</span>${tag(r)}</div>`).join('')}</div>
        ${v.source ? `<div id="${id}-src" class="mono">${esc(v.source)}</div>` : ''}`,
      js: rows.map((r, i) => `tl.fromTo("#${id}-r${i}", { opacity: 0, x: -16 }, { opacity: 1, x: 0, duration: 0.3, ease: "power2.out" }, ${r3(t0 + i * step)});`).join('\n') +
        `tl.fromTo("#${id}-n", { opacity: 0 }, { opacity: 1, duration: 0.4 }, ${r3(t0 + rows.length * step)});` +
        (v.source ? `tl.fromTo("#${id}-src", { opacity: 0 }, { opacity: 1, duration: 0.5 }, ${r3(t0 + rows.length * step + 0.3)});` : ''),
    });
  },

  // The suite: the core in the middle, what is built on it around it.
  suite(id, v, dur, ctx) {
    const ring = v.items, n = ring.length;
    const pos = ring.map((_, i) => { const a = (-90 + (360 / n) * i) * Math.PI / 180; return { x: 960 + Math.cos(a) * 640, y: 470 + Math.sin(a) * 330 }; });
    return scene(id, dur, { hills: true,
      css: `#${id}-core { position: absolute; left: 760px; top: 380px; width: 400px; height: 180px; border-radius: 24px; background: ${C.accentBg}; border: 3px solid ${C.accent}; display: flex; align-items: center; justify-content: center; gap: 20px; font-size: 48px; font-weight: 700; opacity: 0; }
        #${id}-core img { width: 78px; height: 78px; }
        #root .it { position: absolute; transform: translate(-50%, -50%); padding: 14px 26px; border-radius: 14px; background: rgba(34,44,54,0.92); border: 2px solid ${C.rule}; font-size: 30px; font-weight: 600; white-space: nowrap; opacity: 0; }`,
      body: `<div id="${id}-core"><img src="assets/brand/logo.svg" alt="" />${esc(v.core ?? 'GurtOS')}</div>
        ${ring.map((it, i) => `<div class="it" id="${id}-i${i}" style="left:${Math.round(pos[i].x)}px;top:${Math.round(pos[i].y)}px">${esc(it.text ?? it)}</div>`).join('')}`,
      js: `tl.fromTo("#${id}-core", { opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1, duration: 0.5, ease: "back.out(1.5)" }, 0.2);` +
        ring.map((it, i) => `tl.fromTo("#${id}-i${i}", { opacity: 0, scale: 0.85 }, { opacity: 1, scale: 1, duration: 0.4, ease: "power3.out" }, ${r3(ctx.t(typeof it === 'object' ? it : {}, 0.7 + i * 0.22))});`).join('\n'),
    });
  },

  end(id, v, dur, ctx) {
    const lines = v.lines ?? ['gurtos.com', 'github.com/benz16107/gurtos', 'Open source, Apache-2.0'];
    return scene(id, dur, { hills: true,
      css: `#${id}-b { position: absolute; left: 0; right: 0; top: 200px; display: flex; flex-direction: column; align-items: center; gap: 26px; }
        #${id}-lock { display: flex; align-items: center; gap: 30px; } #${id}-logo { width: 130px; height: 130px; } #${id}-word { font-size: 124px; font-weight: 700; }
        #${id}-sub { font-size: 44px; color: ${C.ink2}; } #root .el { font-size: 34px; opacity: 0; } #root .el.mono { font-size: 30px; }`,
      body: `<div id="${id}-b"><div id="${id}-lock"><img id="${id}-logo" src="assets/brand/logo.svg" alt="GurtOS" /><div id="${id}-word">GurtOS</div></div>
        <div id="${id}-sub">${esc(v.subtitle ?? 'Operating systems built for AI agents')}</div>
        ${lines.map((l, i) => `<div class="el${/\./.test(l) && !/ /.test(l) ? ' mono' : ''}" id="${id}-e${i}">${esc(l)}</div>`).join('')}</div>`,
      js: `tl.fromTo("#${id}-logo", { opacity: 0, scale: 0.6, rotation: -8 }, { opacity: 1, scale: 1, rotation: 0, duration: 0.7, ease: "back.out(1.7)" }, 0.15);
        tl.fromTo("#${id}-word", { clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0% 0 0)", duration: 0.7, ease: "power3.inOut" }, 0.45);
        tl.fromTo("#${id}-sub", { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.5 }, 0.95);
        ${lines.map((_, i) => `tl.fromTo("#${id}-e${i}", { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.45 }, ${r3(1.3 + i * 0.25)});`).join('\n')}`,
    });
  },
};

// The track formats (kit.mjs): shot, pair, caseboard, dossier, exhibit, timeline, scoreboard, terminal, chat, ledger.
Object.assign(V, kit({ C, W, H, FRAME, esc, r3, scene, fit, dims, lowerThird, note, moves }));

function captionsScene(groups, dur) {
  const body = groups.map((g, i) => `<div id="cap-${i}" class="cap clip" data-start="${g.start}" data-duration="${r3(g.end - g.start)}" data-track-index="0"><span class="pill">${g.words.map((w) => `<b>${esc(w.text)}</b>`).join(' ')}</span></div>`).join('\n    ');
  const times = JSON.stringify(groups.map((g) => g.words.map((w) => r3(w.start))));
  return `<template>
  <style>${FONTS}
    #root { position: absolute; inset: 0; pointer-events: none; }
    .cap { position: absolute; left: 0; right: 0; bottom: 112px; display: flex; justify-content: center; opacity: 0; overflow: visible; }
    .cap span.pill { padding: 8px 24px 12px; border-radius: 12px; background: rgba(23, 30, 37, 0.84); font-family: "Atkinson Hyperlegible Next", sans-serif; font-weight: 600; font-size: 52px; line-height: 1.2; color: rgba(242, 239, 232, 0.6); white-space: nowrap; }
    .cap b { font-weight: 600; }
  </style>
  <div id="root" data-composition-id="captions" data-width="${W}" data-height="${H}" data-layout-allow-caption-zone>
    ${body}
  </div>
  <script>
    (function () {
      const times = ${times};
      const tl = gsap.timeline({ paused: true });
      document.querySelectorAll("#root .cap").forEach((cap, gi) => {
        const start = parseFloat(cap.dataset.start), end = start + parseFloat(cap.dataset.duration);
        tl.fromTo(cap, { opacity: 0 }, { opacity: 1, duration: 0.12, ease: "power2.out" }, start);
        cap.querySelectorAll("b").forEach((b, wi) => tl.fromTo(b, { color: "rgba(242, 239, 232, 0.6)" }, { color: "#f2efe8", duration: 0.06 }, times[gi][wi]));
        tl.to(cap, { opacity: 0, duration: 0.1, ease: "power2.in" }, Math.max(start, end - 0.1));
        tl.set(cap, { opacity: 0, visibility: "hidden" }, end);
      });
      window.__timelines["captions"] = tl;
    })();
  </script>
</template>
`;
}

// ---------- the film ----------

export async function build(id, { noMusic = false } = {}) {
  const spec = { ...(await import(path.join(HERE, 'films', `${id}.mjs`))).default };
  if (noMusic) spec.music = null;
  const out = path.join(HERE, 'build', noMusic ? `${id}-no-music` : id), comp = path.join(out, 'compositions'), media = path.join(out, 'media');
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(comp, { recursive: true });
  fs.mkdirSync(media, { recursive: true });
  fs.symlinkSync(path.relative(out, path.join(STUDIO, 'assets')), path.join(out, 'assets'));

  const file = (src) => { const [kind, p] = [src.slice(0, src.indexOf(':')), src.slice(src.indexOf(':') + 1)];
    const f = { repo: path.join(REPO, p), cap: path.join(STUDIO, 'assets/capture', p), brand: path.join(STUDIO, 'assets/brand', p) }[kind];
    if (!f || !fs.existsSync(f)) throw new Error(`${id}: no media ${src}`);
    return f; };
  const media_ = (src) => { const f = file(src), name = src.replace(/[^a-zA-Z0-9.]+/g, '-').replace(/^-+/, ''), dst = path.join(media, name);
    if (!fs.existsSync(dst)) { try { fs.linkSync(f, dst); } catch { fs.copyFileSync(f, dst); } }
    return `media/${name}`; };

  const voDir = path.join(STUDIO, 'assets/vo', spec.vo ?? id);
  // Standout features go in only once they are merged and recorded: slots.json lists the ones that are ready.
  const SLOTS = JSON.parse(fs.readFileSync(path.join(HERE, 'slots.json'), 'utf8'));
  const on = (sid) => sid in SLOTS;
  const fill = (o) => JSON.parse(JSON.stringify(o).replace(/\{url\}/g, (s) => SLOTS['try-live']?.url ?? s).replace(/"slot:([a-z-]+)"/g, (_, k) => JSON.stringify(SLOTS[k]?.media ?? `slot:${k}`)));
  let t = 0, para = 0;
  const hosts = [], audio = [], allWords = [], voWindows = [], deadWindows = [], used = [];
  // The title card: 2.6 s, or 3 s when the track name is long enough that 2.6 s is too short to read it.
  const cardDur = spec.card && spec.card.track.split(/\s+/).length > 5 ? 3.0 : 2.6;
  const beats = [...(spec.card ? [{ dur: cardDur, v: { type: 'trackcard', ...spec.card } }] : []), ...spec.beats].filter((x) => !x.insert || on(x.insert));
  for (const [bi, beat0] of beats.entries()) {
    let beat = beat0, voName = null;
    if (beat.insert) { voName = `slot-${beat.insert}`; used.push(beat.insert); }
    else if (beat.slot && on(beat.slot.id)) { para++; voName = beat.slot.vo ?? `slot-${beat.slot.id}`; used.push(beat.slot.id); beat = { ...beat, ...beat.slot, slot: undefined }; }
    beat = fill(beat);
    if (beat.lines) beat.lines = beat.lines.filter((l) => typeof l === 'string' || on(l.slot)).map((l) => (typeof l === 'string' ? l : l.text));
    const b = beat.parts ? beat : { ...beat, parts: [{ v: beat.v, ...beat }] };
    b.parts = b.parts.filter((p) => !p.slot || on(p.slot)).map((p) => (p.v?.lines ? { ...p, v: { ...p.v, lines: p.v.lines.filter((l) => typeof l === 'string' || !l.slot || on(l.slot)).map((l) => (typeof l === 'object' && l.slot ? l.text : l)) } } : p));
    let vo = null, words = [];
    if (b.dur == null) {
      if (!voName) para++;
      const base = path.join(voDir, voName ?? String(para).padStart(2, '0'));
      if (!fs.existsSync(base + '.json')) throw new Error(`${id}: no narration ${base}.json (run narration/say.py${voName ? ' --slots' : ''})`);
      const { alignment } = JSON.parse(fs.readFileSync(base + '.json', 'utf8'));
      const len = probe(base + '.wav'), pre = b.pre ?? (bi === 0 ? 0.6 : 0.3);
      vo = { start: t + pre, len, wav: base + '.wav', gap: 0 };
      words = wordsOf(alignment, vo.start);
      // gap: { after: word, dur }: hold silence inside the line after that word (main's power cut); later words move.
      if (b.gap) {
        const i = words.findIndex((w) => w.text.toLowerCase().replace(/[^a-z0-9]/g, '') === b.gap.after);
        if (i < 0 || i + 1 >= words.length) throw new Error(`${id} beat ${bi + 1}: no spoken word "${b.gap.after}" to hold after`);
        vo.split = r3((words[i].end + words[i + 1].start) / 2 - vo.start);
        vo.gap = b.gap.dur;
        for (const w of words.slice(i + 1)) { w.start += vo.gap; w.end += vo.gap; }
        deadWindows.push([vo.start + vo.split, vo.start + vo.split + vo.gap]);
      }
      allWords.push(...words);
      voWindows.push([vo.start, vo.start + len + vo.gap]);
    }
    const dur = r3(b.dur ?? (vo.start - t) + vo.len + vo.gap + (b.post ?? 0.45) + (b.hold ?? 0));
    // Resolve a visual's time: `at` (seconds into the part) or `cue` (the first spoken word starting with it, after `after`).
    const cueAbs = (o) => {
      if (o.cue == null) return null;
      const want = o.cue.toLowerCase(), from = o.after ? words.findIndex((w) => w.text.toLowerCase().replace(/[^a-z0-9$]/g, '').startsWith(o.after.toLowerCase())) : 0;
      const w = words.slice(Math.max(0, from)).find((x) => x.text.toLowerCase().replace(/[^a-z0-9$,.]/g, '').startsWith(want));
      if (!w) throw new Error(`${id} beat ${bi + 1}: no spoken word "${o.cue}"`);
      return w.start + (o.off ?? 0);
    };
    const starts = b.parts.map((p, pi) => (pi === 0 ? t : (cueAbs(p) ?? t + p.at)));
    b.parts.forEach((p, pi) => {
      const s = starts[pi], e = pi + 1 < b.parts.length ? starts[pi + 1] : t + dur, sid = `b${String(bi + 1).padStart(2, '0')}${String.fromCharCode(97 + pi)}`;
      const ctx = { edition: spec.edition, style: spec.style, file, media: media_, t: (o, def) => { const a = cueAbs(o ?? {}); return Math.max(0, a != null ? a - s : (o?.at ?? def)); } };
      const fn = V[p.v.type];
      if (!fn) throw new Error(`${id}: no visual type ${p.v.type}`);
      fs.writeFileSync(path.join(comp, `${sid}.html`), fn(sid, p.v, e - s, ctx));
      hosts.push(`<div id="${sid}" data-composition-id="${sid}" data-composition-src="compositions/${sid}.html" data-start="${r3(s)}" data-duration="${r3(e - s)}" data-track-index="1" data-track-kind="graphics" data-width="${W}" data-height="${H}"></div>`);
    });
    if (vo) {
      const src = media_('cap:' + path.relative(path.join(STUDIO, 'assets/capture'), vo.wav)), cut = vo.gap ? vo.split : vo.len;
      audio.push(`<audio id="vo-${bi + 1}" class="clip" src="${src}" data-start="${r3(vo.start)}" data-duration="${r3(cut)}" data-track-index="3" data-volume="1"></audio>`);
      if (vo.gap) audio.push(`<audio id="vo-${bi + 1}b" class="clip" src="${src}" data-start="${r3(vo.start + cut + vo.gap)}" data-duration="${r3(vo.len - cut)}" data-media-start="${cut}" data-track-index="3" data-volume="1"></audio>`);
    }
    t = r3(t + dur);
  }
  const total = r3(t);
  if (spec.maxDur && total > spec.maxDur) throw new Error(`${id}: ${total} s is over its ${spec.maxDur} s limit with slots [${used}]: cut the beat each slot names`);
  if (used.length) console.log(`${id}: slots in: ${used.join(', ')}`);
  const groups = groupsOf(forDisplay(allWords));
  fs.writeFileSync(path.join(comp, 'captions.html'), captionsScene(groups, total));
  fs.writeFileSync(path.join(out, `${id}.srt`), srtOf(groups));

  // Music: a quiet bed that dips under the voice and comes up a little between lines.
  let music = '';
  if (spec.music && !fs.existsSync(path.join(STUDIO, 'assets/music', spec.music))) console.warn(`${id}: WARNING no music file ${spec.music}; building without a bed`);
  else if (spec.music) {
    const under = spec.musicUnder ?? 0.14, open = spec.musicOpen ?? 0.3, // 3 dB under the first mix (Ben, Oct 25)
    pts = [{ t: 0, v: open }];
    for (const [a, b] of voWindows) {
      if (a - 0.4 > (pts.at(-1)?.t ?? 0) + 0.4) pts.push({ t: r3(a - 0.45), v: open });
      pts.push({ t: r3(Math.max(0.01, a - 0.15)), v: under }, { t: r3(b + 0.2), v: under });
    }
    pts.push({ t: r3(Math.min(total, voWindows.at(-1)[1] + 0.9)), v: open });
    // A held silence is a dead moment: the bed nearly drops out, then comes back with the voice.
    for (const [a, b] of deadWindows) pts.push({ t: r3(a + 0.05), v: under }, { t: r3(a + 0.35), v: 0.04 }, { t: r3(b - 0.5), v: 0.04 }, { t: r3(b - 0.05), v: under });
    pts.sort((x, y) => x.t - y.t);
    const auto = JSON.stringify({ version: 1, lanes: [{ target: 'volume', points: pts.filter((p, i) => i === 0 || p.t > pts[i - 1].t) }] });
    music = `<audio id="music" class="clip" src="${media_('brand:../music/' + spec.music)}" data-start="0" data-duration="${total}" data-media-start="${spec.musicFrom ?? 0}" data-track-index="4" data-volume="1" data-fade-in="1.5" data-fade-out="3" data-automation='${auto}'></audio>`;
  }

  fs.writeFileSync(path.join(out, 'index.html'), `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${W}, height=${H}" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <style>* { margin: 0; padding: 0; box-sizing: border-box; } html, body { width: ${W}px; height: ${H}px; overflow: hidden; background: ${C.ground}; }
      #root { position: relative; width: 100%; height: 100%; }</style>
  </head>
  <body>
    <!-- ${esc(spec.title)}. Generated by docs/video/build.mjs from films/${id}.mjs: edit the spec and rebuild, or edit here in Studio. -->
    <div id="root" data-composition-id="main" data-start="0" data-duration="${total}" data-width="${W}" data-height="${H}">
      ${hosts.join('\n      ')}
      <div id="captions" data-composition-id="captions" data-composition-src="compositions/captions.html" data-start="0" data-duration="${total}" data-track-index="2" data-track-kind="captions" data-width="${W}" data-height="${H}"></div>
      ${audio.join('\n      ')}
      ${music}
    </div>
    <script>window.__timelines = window.__timelines || {}; window.__timelines["main"] = gsap.timeline({ paused: true });</script>
  </body>
</html>
`);
  fs.writeFileSync(path.join(out, 'hyperframes.json'), fs.readFileSync(path.join(STUDIO, 'hyperframes.json')));
  fs.writeFileSync(path.join(out, 'meta.json'), JSON.stringify({ id, name: spec.title }, null, 2));
  return { out, total, groups, spec };
}

function selftest() {
  const al = { characters: [...'Gurt O.S. is open, so go.'], character_start_times_seconds: [], character_end_times_seconds: [] };
  al.characters.forEach((_, i) => { al.character_start_times_seconds.push(i * 0.1); al.character_end_times_seconds.push(i * 0.1 + 0.08); });
  const w = forDisplay(wordsOf(al));
  if (w.map((x) => x.text).join(' ') !== 'GurtOS is open, so go.') throw new Error('display words: ' + w.map((x) => x.text).join(' '));
  const g = groupsOf(w);
  if (!(g.length >= 1 && g[0].start >= 0 && g.at(-1).end > g.at(-1).start)) throw new Error('groups');
  if (!/00:00:00,000 --> /.test(srtOf(g))) throw new Error('srt');
  const m = moves('#x', 1000, 500, [{ t: 1, s: 2, px: 1, py: 1 }], false);
  if (!/x: -1000, y: -500/.test(m)) throw new Error('moves clamp: ' + m);
  console.log('selftest ok');
}

const [id, ...flags] = process.argv.slice(2);
if (id === '--selftest') selftest();
else if (id) {
  const noMusic = flags.includes('--no-music'), name = noMusic ? `${id}-no-music` : id;
  const { out, total, groups, spec } = await build(id, { noMusic });
  console.log(`${id}: ${out} (${total.toFixed(1)} s, ${groups.length} caption groups)`);
  if (flags.includes('--render')) {
    const dst = path.join(HERE, 'out');
    fs.mkdirSync(dst, { recursive: true });
    const raw = path.join(out, `${name}.raw.mp4`), fin = path.join(dst, `${name}.mp4`);
    // One render or check at a time on this machine (spec writers share it): the lock in /tmp.
    execFileSync('flock', ['/tmp/gurtos-hf.lock', 'npx', '--yes', HF, 'render', '--workers', '2', '--output', raw], { cwd: out, stdio: 'inherit' }); // 2 Chrome workers keep a shared build machine from running out of memory
    // One linear gain to about -16 LUFS, never past -1.5 dBTP; the picture is copied untouched.
    const probeLoud = execFileSync('bash', ['-c', `ffmpeg -hide_banner -nostats -i "${raw}" -af loudnorm=I=-16:TP=-1.5:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p'`]).toString();
    const { input_i, input_tp } = JSON.parse(probeLoud);
    const gain = Math.min(-16 - Number(input_i), -1.5 - Number(input_tp));
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', raw, '-c:v', 'copy', '-af', `volume=${gain.toFixed(2)}dB`, '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', fin]);
    fs.rmSync(raw);
    console.log(`${name}: loudness ${input_i} LUFS, peak ${input_tp} dBTP, gain ${gain.toFixed(2)} dB`);
    if (spec.card && !noMusic) execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', '1.9', '-i', fin, '-frames:v', '1', '-vf', 'scale=1280:-1', '-q:v', '2', path.join(dst, `${id}-thumb.jpg`)]);
    fs.copyFileSync(path.join(out, `${id}.srt`), path.join(dst, `${id}.srt`));
    console.log(`${id}: rendered ${path.join(dst, `${name}.mp4`)} (${spec.title})`);
  }
}
