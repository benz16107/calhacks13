// Formats for the track videos. Ben, Oct 25: "too many of the same animation, the zoom-in effect" and "different
// sponsor tracks should get very different taste, style and format". GurtOS's fonts, colours, title card and end card
// stay the same; framing, layout, motion and devices change per track. A spec opts in with `style` and these types.
//
//   shot       one recording or screenshot: frame full | window | paper | tilt | bare, an entrance, hand-drawn marks,
//              stamps, a picture-in-picture inset, a spotlight. No camera move unless `moves` asks for one.
//   pair       two sources side by side, the second wiping in on its word.
//   caseboard  an evidence board: cards, pinned photos (stills or live clips), notes, strings drawn between them.
//   dossier    a case file card: fields typed in, a pinned photo, stamps.
//   exhibit    a paper document: lines typed, the key one highlighted.
//   timeline   dated dots landing on an axis, with a count.
//   scoreboard tiles whose digits roll to their values.
//   terminal   typed commands and their output; an alarm flash on a word.
//   chat       message bubbles arriving on their words.
//   ledger     rows of payments building, with a running total.
export function kit({ C, W, H, FRAME, esc, r3, scene, fit, dims, lowerThird, note, moves }) {
  const tone = (c) => ({ amber: C.amber, blocked: C.blocked, done: C.done, accent: C.accent, ink: C.ink, dim: C.ink2 }[c ?? 'amber'] ?? c);
  const isImg = (src) => /\.(png|jpe?g|webp|svg)$/i.test(src);
  const PAPER = C.ink, PAPER_INK = C.ground, PAPER_DIM = '#5b6672';

  // Grounds, all from the palette: plain, hills (the GurtOS look), board (a dark pin board), grid, desk.
  function ground(id, kind) {
    const base = `#${id}-c { font-size: 30px; }`;
    if (!kind || kind === 'plain') return { css: base, body: '' };
    if (kind === 'hills') return { css: base + `#${id}-bg { position: absolute; inset: 0; }`, body: `<img id="${id}-bg" src="assets/brand/hills-dark.svg" alt="" />` };
    const tex = {
      board: `background-color: #1b232b; background-image: radial-gradient(rgba(242,239,232,0.05) 1px, transparent 1.4px), radial-gradient(ellipse at 50% 40%, rgba(141,180,221,0.07), transparent 70%); background-size: 9px 9px, 100% 100%;`,
      grid: `background-color: ${C.ground}; background-image: linear-gradient(rgba(242,239,232,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(242,239,232,0.045) 1px, transparent 1px); background-size: 64px 64px;`,
      desk: `background: radial-gradient(ellipse at 50% 35%, #26313c, ${C.ground} 75%);`,
      night: `background: linear-gradient(180deg, #121820, ${C.ground} 60%, #1d2731);`,
    }[kind];
    return { css: base + `#${id}-bg { position: absolute; inset: 0; ${tex} }`, body: `<div id="${id}-bg"></div>` };
  }

  // How a thing arrives. `rot` is its resting rotation.
  function enter(sel, kind, t, rot = 0) {
    const at = r3(Math.max(0, t));
    switch (kind ?? 'fade') {
      case 'cut': return `tl.fromTo("${sel}", { autoAlpha: 0, rotation: ${rot} }, { autoAlpha: 1, rotation: ${rot}, duration: 0.01 }, ${at});`;
      case 'whip-l': return `tl.fromTo("${sel}", { x: 420, autoAlpha: 0, filter: "blur(22px)", rotation: ${rot} }, { x: 0, autoAlpha: 1, filter: "blur(0px)", rotation: ${rot}, duration: 0.34, ease: "power3.out" }, ${at});`;
      case 'whip-r': return `tl.fromTo("${sel}", { x: -420, autoAlpha: 0, filter: "blur(22px)", rotation: ${rot} }, { x: 0, autoAlpha: 1, filter: "blur(0px)", rotation: ${rot}, duration: 0.34, ease: "power3.out" }, ${at});`;
      case 'wipe': return `tl.fromTo("${sel}", { autoAlpha: 1, clipPath: "inset(0% 100% 0% 0%)", rotation: ${rot} }, { autoAlpha: 1, clipPath: "inset(0% 0% 0% 0%)", rotation: ${rot}, duration: 0.55, ease: "power3.inOut" }, ${at});`;
      case 'wipe-down': return `tl.fromTo("${sel}", { autoAlpha: 1, clipPath: "inset(0% 0% 100% 0%)", rotation: ${rot} }, { autoAlpha: 1, clipPath: "inset(0% 0% 0% 0%)", rotation: ${rot}, duration: 0.55, ease: "power3.inOut" }, ${at});`;
      case 'iris': return `tl.fromTo("${sel}", { autoAlpha: 1, clipPath: "circle(0% at 50% 50%)", rotation: ${rot} }, { autoAlpha: 1, clipPath: "circle(75% at 50% 50%)", rotation: ${rot}, duration: 0.6, ease: "power2.inOut" }, ${at});`;
      case 'drop': return `tl.fromTo("${sel}", { y: -110, autoAlpha: 0, rotation: ${rot - 7}, scale: 1.06 }, { y: 0, autoAlpha: 1, rotation: ${rot}, scale: 1, duration: 0.5, ease: "back.out(1.5)" }, ${at});`;
      case 'slide-up': return `tl.fromTo("${sel}", { y: 140, autoAlpha: 0, rotation: ${rot} }, { y: 0, autoAlpha: 1, rotation: ${rot}, duration: 0.5, ease: "power3.out" }, ${at});`;
      case 'flip': return `tl.fromTo("${sel}", { rotationY: -80, autoAlpha: 0, transformPerspective: 1600, rotation: ${rot} }, { rotationY: 0, autoAlpha: 1, rotation: ${rot}, duration: 0.6, ease: "power3.out" }, ${at});`;
      default: return `tl.fromTo("${sel}", { autoAlpha: 0, scale: 0.97, rotation: ${rot} }, { autoAlpha: 1, scale: 1, rotation: ${rot}, duration: 0.45, ease: "power3.out" }, ${at});`;
    }
  }

  // Hand-drawn callouts on a recording or screenshot. x, y, w, h are fractions of the crop, so the marks stay on
  // their spot if the shot moves. kind: circle | box | underline | arrow | spot (dims the rest of the frame).
  function marks(id, list = [], fw, fh, ctx) {
    if (!list.length) return { svg: '', html: '', css: '', js: '' };
    let svg = '', html = '', css = '', js = '';
    list.forEach((m, i) => {
      const x = m.x * fw, y = m.y * fh, w = (m.w ?? 0.1) * fw, h = (m.h ?? 0.05) * fh, col = tone(m.color), t = ctx.t(m, 0.4);
      const mid = `${id}-k${i}`;
      if (m.kind === 'spot') {
        const cx = x + w / 2, cy = y + h / 2, rx = w / 2 + 40, ry = h / 2 + 34;
        svg += `<path id="${mid}" d="M0,0 H${r3(fw)} V${r3(fh)} H0 Z M${r3(cx - rx)},${r3(cy)} a${r3(rx)},${r3(ry)} 0 1,0 ${r3(2 * rx)},0 a${r3(rx)},${r3(ry)} 0 1,0 ${r3(-2 * rx)},0 Z" fill="rgba(12,16,20,0.66)" fill-rule="evenodd" opacity="0" />`;
        js += `tl.fromTo("#${mid}", { opacity: 0 }, { opacity: 1, duration: 0.45, ease: "power2.out" }, ${r3(t)});`;
        if (m.until) js += `tl.to("#${mid}", { opacity: 0, duration: 0.35 }, ${r3(ctx.t(m.until, t + 2))});`;
      } else {
        let d;
        if (m.kind === 'circle' || !m.kind) {
          const cx = x + w / 2, cy = y + h / 2, rx = w / 2 + 22, ry = h / 2 + 16, pts = [];
          for (let j = 0; j <= 60; j++) {
            const a = -1.95 + (j / 60) * (2 * Math.PI + 0.55), wob = 1 + 0.03 * Math.sin(a * 3 + i * 1.7);
            pts.push(`${r3(cx + Math.cos(a) * rx * wob)},${r3(cy + Math.sin(a) * ry * wob)}`);
          }
          d = 'M' + pts.join(' L');
        } else if (m.kind === 'box') {
          d = `M${r3(x - 12)},${r3(y - 9)} L${r3(x + w + 14)},${r3(y - 12)} L${r3(x + w + 11)},${r3(y + h + 10)} L${r3(x - 14)},${r3(y + h + 13)} Z`;
        } else if (m.kind === 'underline') {
          d = `M${r3(x - 4)},${r3(y + h + 8)} Q${r3(x + w / 2)},${r3(y + h + 20)} ${r3(x + w + 6)},${r3(y + h + 5)}`;
        } else if (m.kind === 'arrow') {
          const ex = x + w / 2, ey = y + h / 2, sx = ex + (m.dx ?? 220), sy = ey + (m.dy ?? -140), ang = Math.atan2(ey - sy, ex - sx);
          const hx1 = ex - 34 * Math.cos(ang - 0.45), hy1 = ey - 34 * Math.sin(ang - 0.45), hx2 = ex - 34 * Math.cos(ang + 0.45), hy2 = ey - 34 * Math.sin(ang + 0.45);
          d = `M${r3(sx)},${r3(sy)} Q${r3((sx + ex) / 2 + 30)},${r3((sy + ey) / 2 - 30)} ${r3(ex)},${r3(ey)} M${r3(hx1)},${r3(hy1)} L${r3(ex)},${r3(ey)} L${r3(hx2)},${r3(hy2)}`;
        }
        svg += `<path id="${mid}" d="${d}" pathLength="1" fill="none" stroke="${col}" stroke-width="${m.weight ?? 7}" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="1" stroke-dashoffset="1" />`;
        js += `tl.fromTo("#${mid}", { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: ${m.kind === 'underline' ? 0.35 : 0.55}, ease: "power2.inOut" }, ${r3(t)});`;
        if (m.until) js += `tl.to("#${mid}", { opacity: 0, duration: 0.3 }, ${r3(ctx.t(m.until, t + 2))});`;
      }
      if (m.label) {
        const side = m.side ?? 'right', lw = m.labelW ?? 520;
        const pos = { right: `left:${r3(x + w + 42)}px; top:${r3(y + h / 2 - 26)}px;`, left: `left:${r3(x - 42 - lw)}px; top:${r3(y + h / 2 - 26)}px; text-align:right;`,
          above: `left:${r3(x + w / 2 - lw / 2)}px; top:${r3(y - 88)}px; text-align:center;`, below: `left:${r3(x + w / 2 - lw / 2)}px; top:${r3(y + h + 34)}px; text-align:center;` }[side];
        css += `#${mid}-l { position: absolute; ${pos} width: ${lw}px; opacity: 0; } #${mid}-l span { display: inline-block; padding: 8px 18px; border-radius: 10px; background: ${col}; color: ${C.ground}; font-size: ${m.size ?? 32}px; font-weight: 700; line-height: 1.15; box-shadow: 0 10px 30px rgba(0,0,0,0.35); }`;
        html += `<div id="${mid}-l"><span>${esc(m.label)}</span></div>`;
        js += `tl.fromTo("#${mid}-l", { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.3, ease: "power3.out" }, ${r3(t + 0.35)});`;
        if (m.until) js += `tl.to("#${mid}-l", { opacity: 0, duration: 0.3 }, ${r3(ctx.t(m.until, t + 2))});`;
      }
    });
    return { svg: `<svg id="${id}-mk" width="${r3(fw)}" height="${r3(fh)}" viewBox="0 0 ${r3(fw)} ${r3(fh)}" style="position:absolute;left:0;top:0;overflow:visible">${svg}</svg>`, html, css, js };
  }

  // A rubber stamp that slams onto the frame on its word. box: where x, y (fractions) are measured.
  function stamp(sid, s, ctx, box, shake) {
    const col = tone(s.color ?? 'blocked'), t = ctx.t(s, 1), rot = s.rot ?? -8;
    const x = box.x + (s.x ?? 0.68) * box.w, y = box.y + (s.y ?? 0.32) * box.h;
    return {
      css: `#${sid} { position: absolute; left: ${r3(x)}px; top: ${r3(y)}px; padding: 12px 34px 14px; border: 8px solid ${col}; outline: 3px solid ${col}; outline-offset: 7px; border-radius: 12px; color: ${col}; font-size: ${s.size ?? 88}px; font-weight: 700; letter-spacing: 0.06em; white-space: nowrap; background: rgba(23,30,37,0.55); opacity: 0; }`,
      body: `<div id="${sid}">${esc(s.text)}</div>`,
      js: `tl.fromTo("#${sid}", { opacity: 0, scale: 2.3, xPercent: -50, yPercent: -50, rotation: ${rot - 5} }, { opacity: 0.96, scale: 1, xPercent: -50, yPercent: -50, rotation: ${rot}, duration: 0.2, ease: "power4.in" }, ${r3(t)});` +
        (shake ? `tl.fromTo("${shake}", { x: 0 }, { keyframes: [{ x: -9, duration: 0.04 }, { x: 7, duration: 0.04 }, { x: -4, duration: 0.04 }, { x: 0, duration: 0.05 }] }, ${r3(t + 0.2)});` : '') +
        (s.until ? `tl.to("#${sid}", { opacity: 0, duration: 0.3 }, ${r3(ctx.t(s.until, t + 2))});` : ''),
    };
  }

  // One recording or screenshot in `area` ({cx, cy, w, h}). Returns its pieces and where the media landed (f).
  function pane(id, v, dur, ctx, area, track = 2) {
    const [sw, sh] = dims(ctx.file(v.src)), crop = v.crop ?? { x: 0, y: 0, w: sw, h: sh }, frame = v.frame ?? 'window';
    const full = frame === 'full';
    const f = full ? (() => { const k = Math.max(area.w / crop.w, area.h / crop.h); return { x: area.cx - crop.w * k / 2, y: area.cy - crop.h * k / 2, w: crop.w * k, h: crop.h * k }; })() : fit(crop.w, crop.h, area);
    const k = f.w / crop.w, t0 = ctx.t(v, 0), rot = v.rot ?? (frame === 'paper' ? -1.6 : 0);
    const box = full ? { x: area.cx - area.w / 2, y: area.cy - area.h / 2, w: area.w, h: area.h } : f;
    const look = { window: `border-radius: 15px; border: 2px solid rgba(242,239,232,0.14); box-shadow: 0 30px 80px rgba(0,0,0,0.45); background: #000;`,
      full: '', bare: 'border-radius: 10px;',
      paper: `border-radius: 3px; box-shadow: 0 0 0 16px ${PAPER}, 0 0 0 17px rgba(0,0,0,0.12), 0 34px 70px rgba(0,0,0,0.6);`,
      tilt: `border-radius: 18px; border: 2px solid rgba(242,239,232,0.16); box-shadow: 0 50px 90px rgba(0,0,0,0.55); transform: perspective(1800px) rotateY(${v.tiltY ?? -14}deg) rotateX(${v.tiltX ?? 5}deg);` }[frame];
    const mk = marks(`${id}`, v.marks, f.w, f.h, ctx);
    const media = isImg(v.src)
      ? `<img id="${id}-v" src="${ctx.media(v.src)}" alt="${esc(v.alt ?? '')}" />`
      : `<video id="${id}-v" class="clip" src="${ctx.media(v.src)}" data-start="${r3(t0)}" data-duration="${r3(Math.max(0.1, dur - t0))}" data-media-start="${v.from ?? 0}"${v.rate ? ` data-playback-rate="${v.rate}"` : ''} data-track-index="${track}" muted playsinline></video>`;
    const cap = v.caption ? `<div id="${id}-cap">${esc(v.caption)}</div>` : '';
    const mv = (v.moves ?? []).map((m) => ({ ...m, t: ctx.t(m, 0) }));
    return {
      f, box,
      css: `#${id}-g { position: absolute; left: ${r3(box.x)}px; top: ${r3(box.y)}px; width: ${r3(box.w)}px; height: ${r3(box.h)}px; opacity: 0; }
        #${id}-f { position: absolute; left: 0; top: 0; width: ${r3(box.w)}px; height: ${r3(box.h)}px; overflow: hidden; ${look} }
        #${id}-p { position: absolute; left: ${r3(f.x - box.x)}px; top: ${r3(f.y - box.y)}px; width: ${r3(f.w)}px; height: ${r3(f.h)}px; }
        #${id}-v { position: absolute; left: ${r3(-crop.x * k)}px; top: ${r3(-crop.y * k)}px; width: ${r3(sw * k)}px; height: ${r3(sh * k)}px; }
        #${id}-cap { position: absolute; left: 0; right: 0; top: ${r3(box.h + 4)}px; text-align: center; font-family: "Atkinson Hyperlegible Mono", monospace; font-size: 28px; color: ${frame === 'paper' ? PAPER_INK : C.ink2}; ${frame === 'paper' ? `background: ${PAPER}; padding: 8px 0 10px;` : ''} }
        ${mk.css}`,
      body: `<div id="${id}-g" data-layout-allow-overflow><div id="${id}-f" data-layout-allow-overflow><div id="${id}-p" data-layout-allow-overflow>${media}${mk.svg}${mk.html}</div></div>${cap}</div>`,
      js: enter(`#${id}-g`, v.enter, t0, rot) + (mv.length || v.drift ? moves(`#${id}-p`, f.w, f.h, mv, !!v.drift, dur) : '') + mk.js,
    };
  }

  // A small inset in a corner, arriving on its word.
  function pip(id, p, dur, ctx) {
    const w = p.w ?? 600, [sw, sh] = dims(ctx.file(p.src)), crop = p.crop ?? { x: 0, y: 0, w: sw, h: sh }, h = w * crop.h / crop.w;
    const corner = p.corner ?? 'br', cx = corner.includes('r') ? W - 70 - w / 2 : 70 + w / 2, cy = corner.includes('b') ? H - 250 - h / 2 : 70 + h / 2 + (p.label ? 50 : 0);
    const P = pane(id, { ...p, frame: p.frame ?? 'window', enter: p.enter ?? 'slide-up' }, dur, ctx, { cx, cy, w, h }, p.track ?? 5);
    const lab = p.label ? { css: `#${id}-lab { position: absolute; left: ${r3(P.f.x)}px; top: ${r3(P.f.y - 52)}px; font-size: 28px; font-weight: 700; padding: 4px 14px; border-radius: 8px; background: ${tone(p.color ?? 'accent')}; color: ${C.ground}; opacity: 0; }`,
      body: `<div id="${id}-lab">${esc(p.label)}</div>`, js: `tl.fromTo("#${id}-lab", { opacity: 0 }, { opacity: 1, duration: 0.3 }, ${r3(ctx.t(p, 0) + 0.25)});` } : { css: '', body: '', js: '' };
    return { css: P.css + lab.css, body: P.body + lab.body, js: P.js + lab.js };
  }

  function extras(id, v, dur, ctx, box) {
    const st = (v.stamps ?? (v.stamp ? [v.stamp] : [])).map((s, i) => stamp(`${id}-st${i}`, s, ctx, s.box === 'frame' ? { x: 0, y: 0, w: W, h: H } : box, `#${id}-c`));
    const pp = v.pip ? pip(`${id}-pip`, v.pip, dur, ctx) : { css: '', body: '', js: '' };
    return { css: st.map((s) => s.css).join('\n') + pp.css, body: pp.body + st.map((s) => s.body).join(''), js: pp.js + st.map((s) => s.js).join('') };
  }

  function chip(id, text, x, y, color, t) {
    return { css: `#${id} { position: absolute; left: ${r3(x)}px; top: ${r3(y)}px; font-size: 30px; font-weight: 700; padding: 6px 18px; border-radius: 10px; background: ${tone(color)}; color: ${C.ground}; opacity: 0; white-space: nowrap; }`,
      body: `<div id="${id}">${esc(text)}</div>`, js: `tl.fromTo("#${id}", { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.3, ease: "power3.out" }, ${r3(t)});` };
  }

  // Typed text: a reveal in character steps (deterministic, no timers).
  const typed = (sel, text, t, cps = 38) => `tl.fromTo("${sel}", { clipPath: "inset(-10% 100% -10% 0%)" }, { clipPath: "inset(-10% 0% -10% 0%)", duration: ${r3(Math.max(0.2, String(text).length / cps))}, ease: "steps(${Math.max(2, String(text).length)})" }, ${r3(t)});`;

  // Rolling digits: each digit is a reel that spins to its value.
  function reel(id, value, size) {
    const digits = String(value).split('');
    return {
      css: `#${id} { display: inline-flex; height: ${size}px; overflow: hidden; line-height: ${size}px; font-variant-numeric: tabular-nums; }
        #${id} .rl { display: flex; flex-direction: column; } #${id} .rl b { display: block; height: ${size}px; font-weight: 700; }`,
      body: `<span id="${id}">${digits.map((d, i) => /\d/.test(d) ? `<span class="rl" id="${id}-${i}" data-layout-ignore>${'0123456789'.split('').map((n) => `<b>${n}</b>`).join('')}</span>` : `<b>${esc(d)}</b>`).join('')}</span>`,
      js: (t) => digits.map((d, i) => /\d/.test(d) ? `tl.fromTo("#${id}-${i}", { y: 0 }, { y: ${-Number(d) * size}, duration: ${r3(0.9 + i * 0.15)}, ease: "power3.out" }, ${r3(t)});` : '').join(''),
    };
  }

  return {
    shot(id, v, dur, ctx) {
      const full = v.frame === 'full', area = full ? { cx: W / 2, cy: H / 2, w: W, h: H } : (v.box ?? FRAME);
      const g = ground(id, v.bg ?? (full ? 'plain' : ctx.style?.bg)), P = pane(id, v, dur, ctx, area);
      const lx = full ? 60 : Math.max(40, P.f.x), ly = full ? 48 : Math.max(30, P.f.y);
      const lt = lowerThird(id, v.lt, ctx.edition, lx, ly), nt = note(id, v.note, full ? 60 : Math.max(40, P.f.x) + 24, full ? H - 200 : Math.min(H - 200, P.f.y + P.f.h * 0.86));
      const ex = extras(id, v, dur, ctx, P.box);
      return scene(id, dur, { css: g.css + P.css + lt.css + nt.css + ex.css, body: g.body + P.body + ex.body + lt.body + nt.body, js: P.js + lt.js + nt.js + ex.js });
    },

    pair(id, v, dur, ctx) {
      const g = ground(id, v.bg ?? ctx.style?.bg ?? 'grid'), gap = 44, w = (FRAME.w - gap) / 2, h = FRAME.h - 70;
      const areas = [{ cx: FRAME.cx - (w + gap) / 2, cy: FRAME.cy + 35, w, h }, { cx: FRAME.cx + (w + gap) / 2, cy: FRAME.cy + 35, w, h }];
      const ps = v.items.map((it, i) => pane(`${id}-${i}`, { enter: i ? 'wipe' : 'fade', frame: 'window', ...it }, dur, ctx, areas[i], 2 + i));
      const labs = v.items.map((it, i) => it.label ? chip(`${id}-lab${i}`, it.label, ps[i].f.x, ps[i].f.y - 58, it.color ?? (i ? 'amber' : 'accent'), ctx.t(it, 0) + 0.2) : { css: '', body: '', js: '' });
      const ex = extras(id, v, dur, ctx, { x: FRAME.cx - FRAME.w / 2, y: FRAME.cy - FRAME.h / 2, w: FRAME.w, h: FRAME.h });
      const nt = note(id, v.note, ps[0].f.x + 24, Math.min(H - 200, ps[0].f.y + ps[0].f.h * 0.86));
      return scene(id, dur, { css: g.css + ps.map((p) => p.css).join('\n') + labs.map((l) => l.css).join('\n') + ex.css + nt.css,
        body: g.body + ps.map((p) => p.body).join('') + labs.map((l) => l.body).join('') + ex.body + nt.body,
        js: ps.map((p) => p.js).join('') + labs.map((l) => l.js).join('') + ex.js + nt.js });
    },

    // Evidence board. Items: { id, kind: card | photo | note, x, y (top centre, px, where the pin goes), w, rot, cue/at }.
    caseboard(id, v, dur, ctx) {
      const g = ground(id, v.bg ?? 'board'), pin = (x, y) => `<i class="pin" style="left:${r3(x - 13)}px;top:${r3(y - 13)}px"></i>`;
      let css = `#root .pin { position: absolute; width: 26px; height: 26px; border-radius: 50%; background: radial-gradient(circle at 35% 35%, #ffd2c6, ${C.blocked} 45%, #9c4f40); box-shadow: 0 4px 8px rgba(0,0,0,0.5); }
        #root .card { position: absolute; background: ${PAPER}; color: ${PAPER_INK}; border-radius: 4px; padding: 26px 30px 28px; box-shadow: 0 26px 50px rgba(0,0,0,0.55); opacity: 0; }
        #root .card h4 { margin: 0 0 12px; font-size: 40px; line-height: 1.1; } #root .card .k { font-family: "Atkinson Hyperlegible Mono", monospace; font-size: 28px; color: ${PAPER_DIM}; margin-bottom: 8px; }
        #root .card p { margin: 6px 0 0; font-size: 30px; line-height: 1.25; }
        #root .sticky { position: absolute; background: ${C.amber}; color: ${C.ground}; padding: 22px 26px; font-size: 34px; font-weight: 700; line-height: 1.2; box-shadow: 0 20px 40px rgba(0,0,0,0.5); opacity: 0; }
        #${id}-k { position: absolute; left: 70px; top: 46px; font-size: 30px; color: ${C.ink2}; letter-spacing: 0.04em; }`;
      let body = v.kicker ? `<div id="${id}-k" class="mono">${esc(v.kicker)}</div>` : '', js = '';
      const at = {};
      v.items.forEach((it, i) => {
        const iid = `${id}-i${i}`, t = ctx.t(it, 0.2 + i * 0.4), rot = it.rot ?? 0, w = it.w ?? 420;
        if (it.kind === 'photo') {
          const [sw, sh] = dims(ctx.file(it.src)), cr = it.crop ?? { x: 0, y: 0, w: sw, h: sh }, h = w * cr.h / cr.w;
          const P = pane(iid, { ...it, frame: it.frame ?? 'paper', enter: it.enter ?? 'drop', rot }, dur, ctx, { cx: it.x, cy: it.y + h / 2, w, h }, 2 + i);
          css += P.css; body += P.body.replace(/<\/div>$/, `${pin(P.f.w / 2, -2)}</div>`); js += P.js;
          at[it.id ?? i] = { x: it.x, y: it.y };
        } else {
          const cls = it.kind === 'note' ? 'sticky' : 'card';
          css += `#${iid} { left: ${r3(it.x - w / 2)}px; top: ${r3(it.y)}px; width: ${w}px; }`;
          const inner = it.kind === 'note' ? esc(it.text) : `${it.label ? `<div class="k">${esc(it.label)}</div>` : ''}<h4>${esc(it.title ?? '')}</h4>${(it.lines ?? []).map((l, j) => `<p id="${iid}-p${j}">${esc(l.text ?? l)}</p>`).join('')}`;
          body += `<div class="${cls}" id="${iid}">${inner}${pin(w / 2, -4)}</div>`;
          js += enter(`#${iid}`, it.enter ?? 'drop', t, rot);
          (it.lines ?? []).forEach((l, j) => { if (l.cue || l.at != null) js += `tl.fromTo("#${iid}-p${j}", { opacity: 0 }, { opacity: 1, duration: 0.3 }, ${r3(ctx.t(l, t + 0.4))});`; });
          at[it.id ?? i] = { x: it.x, y: it.y };
        }
        (it.stamps ?? []).forEach((s, j) => { const S = stamp(`${iid}-st${j}`, { size: 64, ...s }, ctx, { x: it.x - w / 2, y: it.y, w, h: it.stampH ?? 300 }, `#${id}-c`); css += S.css; body += S.body; js += S.js; });
      });
      // Strings: drawn pin to pin with a little sag.
      const strings = (v.strings ?? []).map((s, i) => {
        const a = at[s.from], b = at[s.to], sag = s.sag ?? 70;
        return `<path id="${id}-s${i}" d="M${r3(a.x)},${r3(a.y)} Q${r3((a.x + b.x) / 2)},${r3(Math.max(a.y, b.y) + sag)} ${r3(b.x)},${r3(b.y)}" pathLength="1" fill="none" stroke="${tone(s.color ?? 'blocked')}" stroke-width="5" stroke-linecap="round" stroke-dasharray="1" stroke-dashoffset="1" />`;
      });
      body += `<svg id="${id}-str" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="position:absolute;left:0;top:0;pointer-events:none">${strings.join('')}</svg>`;
      (v.strings ?? []).forEach((s, i) => { js += `tl.fromTo("#${id}-s${i}", { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.6, ease: "power2.inOut" }, ${r3(ctx.t(s, 1 + i * 0.5))});`; });
      (v.cam ?? []).forEach((m) => { js += `tl.to("#${id}-c", { x: ${r3((W / 2 - m.x) * (m.s ?? 1))}, y: ${r3((H / 2 - 60 - m.y) * (m.s ?? 1))}, scale: ${m.s ?? 1}, transformOrigin: "${r3(m.x)}px ${r3(m.y)}px", duration: ${m.d ?? 0.9}, ease: "power3.inOut" }, ${r3(ctx.t(m, 0))});`; });
      const lt = lowerThird(id, v.lt, ctx.edition, 60, 40), nt = note(id, v.note, 70, H - 200), ex = extras(id, v, dur, ctx, { x: 0, y: 0, w: W, h: H });
      return scene(id, dur, { css: g.css + css + lt.css + nt.css + ex.css, body: g.body + body + ex.body + lt.body + nt.body, js: js + lt.js + nt.js + ex.js });
    },

    // A case file: tab, title, fields typed in, an optional pinned photo, stamps.
    dossier(id, v, dur, ctx) {
      const g = ground(id, v.bg ?? 'board'), L = 210, T = 150, CW = v.photo ? 900 : 1500;
      let css = `#${id}-d { position: absolute; left: ${L}px; top: ${T}px; width: ${v.photo ? 1500 : 1500}px; height: 660px; background: ${PAPER}; color: ${PAPER_INK}; border-radius: 0 10px 10px 10px; box-shadow: 0 34px 70px rgba(0,0,0,0.6); opacity: 0; }
        #${id}-tab { position: absolute; left: 0; top: -58px; padding: 10px 30px; background: ${PAPER}; border-radius: 10px 10px 0 0; font-family: "Atkinson Hyperlegible Mono", monospace; font-size: 30px; color: ${PAPER_INK}; }
        #${id}-h { position: absolute; left: 56px; top: 44px; width: ${CW - 80}px; font-size: 54px; font-weight: 700; line-height: 1.1; }
        #${id}-sub { position: absolute; left: 56px; top: ${v.title && v.title.length > 30 ? 172 : 112}px; font-size: 30px; color: ${PAPER_DIM}; }
        #${id}-fl { position: absolute; left: 56px; top: 230px; width: ${CW - 80}px; display: grid; grid-template-columns: 300px 1fr; row-gap: 22px; column-gap: 28px; align-items: baseline; }
        #${id}-fl .k { font-size: 28px; color: ${PAPER_DIM}; font-family: "Atkinson Hyperlegible Mono", monospace; opacity: 0; }
        #${id}-fl .v { font-size: 42px; font-weight: 700; line-height: 1.1; }
        #${id}-fl .v.bad { color: #b24a36; } #${id}-fl .v.ok { color: #2f6b3a; }`;
      let body = `<div id="${id}-d" data-layout-allow-overflow><div id="${id}-tab">${esc(v.tab ?? 'CASE FILE')}</div><div id="${id}-h">${esc(v.title ?? '')}</div>${v.sub ? `<div id="${id}-sub">${esc(v.sub)}</div>` : ''}
        <div id="${id}-fl">${v.fields.map((f, i) => `<div class="k" id="${id}-k${i}">${esc(f.k)}</div><div class="v${f.flag ? ` ${f.flag}` : ''}" id="${id}-v${i}">${esc(f.v)}</div>`).join('')}</div></div>`;
      let js = enter(`#${id}-d`, v.enter ?? 'slide-up', ctx.t(v.enterAt ?? {}, 0), v.rot ?? -0.8);
      v.fields.forEach((f, i) => { const t = ctx.t(f, 0.5 + i * 0.5); js += `tl.fromTo("#${id}-k${i}", { opacity: 0 }, { opacity: 1, duration: 0.2 }, ${r3(t)});` + typed(`#${id}-v${i}`, f.v, t + 0.1); });
      if (v.photo) { const P = pane(`${id}-ph`, { frame: 'paper', enter: 'drop', rot: 2.2, ...v.photo }, dur, ctx, { cx: L + 1170, cy: T + 330, w: 520, h: 560 }, 2); css += P.css; body += P.body; js += P.js; }
      const ex = extras(id, v, dur, ctx, { x: L, y: T, w: 1500, h: 660 }), lt = lowerThird(id, v.lt, ctx.edition, 60, 40);
      return scene(id, dur, { css: g.css + css + ex.css + lt.css, body: g.body + body + ex.body + lt.body, js: js + ex.js + lt.js });
    },

    // A paper exhibit: a label, lines typed in, the key line highlighted with a marker.
    exhibit(id, v, dur, ctx) {
      const g = ground(id, v.bg ?? 'board');
      const css = `#${id}-d { position: absolute; left: 330px; top: 130px; width: 1260px; min-height: 560px; padding: 60px 70px; box-sizing: border-box; background: ${PAPER}; color: ${PAPER_INK}; border-radius: 4px; box-shadow: 0 34px 70px rgba(0,0,0,0.6); opacity: 0; }
        #${id}-lab { font-family: "Atkinson Hyperlegible Mono", monospace; font-size: 30px; color: ${PAPER_DIM}; margin-bottom: 30px; letter-spacing: 0.04em; }
        #${id}-d .ln { position: relative; font-size: ${v.size ?? 52}px; font-weight: 700; line-height: 1.2; margin-bottom: 22px; }
        #${id}-d .ln.dim { font-weight: 400; color: ${PAPER_DIM}; font-size: ${Math.round((v.size ?? 52) * 0.8)}px; }
        #${id}-d .ln em { position: absolute; left: -8px; right: -8px; top: 12%; bottom: 4%; background: rgba(242,181,68,0.55); transform-origin: 0 50%; z-index: -1; font-style: normal; }
        #${id}-d .ln span { position: relative; } #${id}-src { font-family: "Atkinson Hyperlegible Mono", monospace; font-size: 28px; color: ${PAPER_DIM}; margin-top: 30px; opacity: 0; }`;
      const body = `<div id="${id}-d" data-layout-allow-overflow><div id="${id}-lab">${esc(v.label ?? 'EXHIBIT')}</div>${v.lines.map((l, i) => `<div class="ln${l.dim ? ' dim' : ''}" id="${id}-l${i}" style="isolation:isolate">${l.mark ? `<em id="${id}-m${i}"></em>` : ''}<span id="${id}-t${i}">${esc(l.text)}</span></div>`).join('')}${v.source ? `<div id="${id}-src">${esc(v.source)}</div>` : ''}</div>`;
      let js = enter(`#${id}-d`, v.enter ?? 'drop', 0, v.rot ?? -1.2);
      v.lines.forEach((l, i) => { const t = ctx.t(l, 0.5 + i * 0.8); js += typed(`#${id}-t${i}`, l.text, t, 34); if (l.mark) js += `tl.fromTo("#${id}-m${i}", { scaleX: 0 }, { scaleX: 1, duration: 0.45, ease: "power2.inOut" }, ${r3(ctx.t(l.markAt ?? {}, t + l.text.length / 34 + 0.15))});`; });
      if (v.source) js += `tl.fromTo("#${id}-src", { opacity: 0 }, { opacity: 1, duration: 0.4 }, ${r3(ctx.t(v.sourceAt ?? {}, 1))});`;
      const ex = extras(id, v, dur, ctx, { x: 330, y: 130, w: 1260, h: 560 });
      return scene(id, dur, { css: g.css + css + ex.css, body: g.body + body + ex.body, js: js + ex.js });
    },

    // Dots landing on a dated axis, with a count.
    timeline(id, v, dur, ctx) {
      const g = ground(id, v.bg ?? ctx.style?.bg ?? 'grid'), x0 = 260, x1 = 1660, y = 560, n = v.dots.length, t0 = ctx.t(v, 0.4), cnt = reel(`${id}-cnt`, v.count ?? n, 190);
      const css = `#${id}-ax { position: absolute; left: ${x0}px; top: ${y}px; width: ${x1 - x0}px; height: 6px; border-radius: 3px; background: ${C.ink2}; transform-origin: 0 50%; }
        #root .dt { position: absolute; top: ${y - 19}px; width: 44px; height: 44px; margin-left: -22px; border-radius: 50%; background: ${tone(v.color ?? 'blocked')}; box-shadow: 0 0 0 8px rgba(240,164,147,0.18); opacity: 0; }
        #root .dl { position: absolute; top: ${y + 46}px; width: 260px; margin-left: -130px; text-align: center; font-family: "Atkinson Hyperlegible Mono", monospace; font-size: 30px; color: ${C.ink2}; opacity: 0; }
        #${id}-n { position: absolute; left: ${x0}px; top: 200px; display: flex; align-items: baseline; gap: 28px; opacity: 0; }
        #${id}-n .num { font-size: 190px; color: ${tone(v.color ?? 'blocked')}; } ${cnt.css} #${id}-n > span:last-child { font-size: 50px; font-weight: 700; max-width: 900px; line-height: 1.15; }
        #${id}-k { position: absolute; left: ${x0}px; top: 130px; font-size: 30px; color: ${C.ink2}; }
        #${id}-src { position: absolute; left: ${x0}px; top: ${y + 150}px; font-size: 28px; color: ${C.ink2}; opacity: 0; }`;
      const body = `${v.kicker ? `<div id="${id}-k" class="mono">${esc(v.kicker)}</div>` : ''}<div id="${id}-n"><span class="num">${cnt.body}</span><span>${esc(v.label ?? '')}</span></div><div id="${id}-ax"></div>
        ${v.dots.map((d, i) => `<i class="dt" id="${id}-d${i}" style="left:${r3(x0 + d * (x1 - x0))}px"></i>`).join('')}
        <div class="dl" id="${id}-a" style="left:${x0}px">${esc(v.from)}</div><div class="dl" id="${id}-b" style="left:${x1}px">${esc(v.to)}</div>${v.source ? `<div id="${id}-src" class="mono">${esc(v.source)}</div>` : ''}`;
      const step = v.step ?? 0.16;
      const js = `tl.fromTo("#${id}-ax", { scaleX: 0 }, { scaleX: 1, duration: 0.6, ease: "power3.inOut" }, ${r3(Math.max(0, t0 - 0.6))});
        tl.fromTo("#${id}-a", { opacity: 0 }, { opacity: 1, duration: 0.3 }, ${r3(t0 - 0.2)}); tl.fromTo("#${id}-b", { opacity: 0 }, { opacity: 1, duration: 0.3 }, ${r3(t0)});
        tl.fromTo("#${id}-n", { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.4 }, ${r3(t0)});
        ${v.dots.map((_, i) => `tl.fromTo("#${id}-d${i}", { opacity: 0, scale: 2.4 }, { opacity: 1, scale: 1, duration: 0.25, ease: "power3.out" }, ${r3(t0 + i * step)});`).join('\n')}
        ${cnt.js(t0)}
        ${v.source ? `tl.fromTo("#${id}-src", { opacity: 0 }, { opacity: 1, duration: 0.4 }, ${r3(t0 + n * step + 0.3)});` : ''}`;
      const ex = extras(id, v, dur, ctx, { x: 0, y: 0, w: W, h: H });
      return scene(id, dur, { css: g.css + css + ex.css, body: g.body + body + ex.body, js: js + ex.js });
    },

    // Score tiles with rolling digits.
    scoreboard(id, v, dur, ctx) {
      const g = ground(id, v.bg ?? ctx.style?.bg ?? 'grid'), n = v.items.length, size = v.size ?? 170;
      const reels = v.items.map((s, i) => reel(`${id}-r${i}`, s.n, size));
      const css = `#${id}-k { position: absolute; left: 160px; top: 110px; font-size: 32px; color: ${C.ink2}; }
        #${id}-g { position: absolute; left: 160px; right: 160px; top: 190px; display: grid; grid-template-columns: repeat(${n}, 1fr); gap: 36px; }
        #root .tile { background: ${C.surface}; border-radius: 16px; padding: 40px 40px 44px; border-top: 8px solid var(--c); opacity: 0; }
        #root .tile .num { display: flex; align-items: baseline; gap: 18px; font-size: ${size}px; } #root .tile .of { font-size: 56px; color: ${C.ink2}; font-weight: 700; }
        #root .tile .lb { font-size: 36px; margin-top: 20px; line-height: 1.2; color: ${C.ink}; }
        #${id}-src { position: absolute; left: 160px; right: 160px; top: ${v.srcTop ?? 650}px; font-size: 28px; color: ${C.ink2}; line-height: 1.5; opacity: 0; }` + reels.map((r) => r.css).join('\n');
      const body = `${v.kicker ? `<div id="${id}-k" class="mono">${esc(v.kicker)}</div>` : ''}<div id="${id}-g">${v.items.map((s, i) => `<div class="tile" id="${id}-t${i}" style="--c:${tone(s.color ?? 'done')}"><div class="num">${reels[i].body}${s.of ? `<span class="of">of ${esc(s.of)}</span>` : ''}</div><div class="lb">${esc(s.label)}</div></div>`).join('')}</div>${v.source ? `<div id="${id}-src" class="mono">${esc(v.source)}</div>` : ''}`;
      const js = v.items.map((s, i) => { const t = ctx.t(s, 0.3 + i * 0.6); return enter(`#${id}-t${i}`, 'slide-up', t) + reels[i].js(t + 0.1); }).join('\n') + (v.source ? `tl.fromTo("#${id}-src", { opacity: 0 }, { opacity: 1, duration: 0.4 }, ${r3(ctx.t(v.sourceAt ?? {}, 1.2))});` : '');
      const ex = extras(id, v, dur, ctx, { x: 0, y: 0, w: W, h: H });
      return scene(id, dur, { css: g.css + css + ex.css, body: g.body + body + ex.body, js: js + ex.js });
    },

    // A terminal: lines typed or printed on their words; `alarm` flashes the frame red on a word.
    terminal(id, v, dur, ctx) {
      const g = ground(id, v.bg ?? 'night'), lines = v.lines;
      const css = `#${id}-w { position: absolute; left: 200px; top: 90px; width: 1520px; height: 760px; border-radius: 16px; background: #0d1217; border: 2px solid rgba(242,239,232,0.14); box-shadow: 0 40px 90px rgba(0,0,0,0.6); overflow: hidden; opacity: 0; }
        #${id}-bar { height: 58px; display: flex; align-items: center; gap: 12px; padding: 0 22px; background: #161d24; font-family: "Atkinson Hyperlegible Mono", monospace; font-size: 28px; color: ${C.ink2}; }
        #${id}-bar i { width: 16px; height: 16px; border-radius: 50%; background: #3a4653; display: block; }
        #${id}-body { padding: 26px 34px; font-family: "Atkinson Hyperlegible Mono", monospace; font-size: ${v.size ?? 34}px; line-height: 1.5; }
        #${id}-body .tl { white-space: pre; opacity: 0; } #${id}-body .tl.cmd { color: ${C.ink}; } #${id}-body .tl.out { color: ${C.ink2}; }
        #${id}-body .tl.bad { color: ${C.blocked}; } #${id}-body .tl.ok { color: ${C.done}; } #${id}-body .tl.warn { color: ${C.amber}; }
        #${id}-al { position: absolute; inset: 0; border: 10px solid ${C.blocked}; box-shadow: inset 0 0 160px rgba(240,164,147,0.35); opacity: 0; pointer-events: none; }`;
      const body = `<div id="${id}-w" data-layout-allow-overflow><div id="${id}-bar"><i></i><i></i><i></i><span style="margin-left:16px">${esc(v.title ?? 'terminal')}</span></div><div id="${id}-body">
        ${lines.map((l, i) => `<div class="tl ${l.kind ?? (l.cmd ? 'cmd' : 'out')}" id="${id}-l${i}">${l.cmd ? '$ ' : ''}${esc(l.text)}</div>`).join('')}</div></div><div id="${id}-al"></div>`;
      let js = enter(`#${id}-w`, v.enter ?? 'fade', 0);
      lines.forEach((l, i) => { const t = ctx.t(l, 0.4 + i * 0.5); js += `tl.set("#${id}-l${i}", { opacity: 1 }, ${r3(t)});` + (l.cmd ? typed(`#${id}-l${i}`, '$ ' + l.text, t, 30) : `tl.fromTo("#${id}-l${i}", { x: -10 }, { x: 0, duration: 0.2 }, ${r3(t)});`); });
      (v.alarms ?? []).forEach((a) => { const t = ctx.t(a, 1); js += `tl.fromTo("#${id}-al", { opacity: 0 }, { keyframes: [{ opacity: 1, duration: 0.08 }, { opacity: 0.2, duration: 0.18 }, { opacity: 0.9, duration: 0.08 }, { opacity: 0, duration: 0.5 }] }, ${r3(t)});`; });
      const ex = extras(id, v, dur, ctx, { x: 200, y: 90, w: 1520, h: 760 }), lt = lowerThird(id, v.lt, ctx.edition, 230, 170);
      return scene(id, dur, { css: g.css + css + ex.css + lt.css, body: g.body + body + ex.body + lt.body, js: js + ex.js + lt.js });
    },

    // Chat bubbles: { from: 'me' | name, text, cue/at, kind: quote | card }.
    chat(id, v, dur, ctx) {
      const g = ground(id, v.bg ?? 'desk'), msgs = v.messages;
      const css = `#${id}-w { position: absolute; left: 360px; top: 70px; width: 1200px; height: 800px; display: flex; flex-direction: column; justify-content: flex-end; gap: 22px; overflow: hidden; }
        #root .mg { max-width: 900px; padding: 22px 30px; border-radius: 26px; font-size: 36px; line-height: 1.3; opacity: 0; }
        #root .mg.me { align-self: flex-end; background: ${C.accent}; color: ${C.ground}; border-bottom-right-radius: 8px; }
        #root .mg.them { align-self: flex-start; background: ${C.surface}; border-bottom-left-radius: 8px; }
        #root .mg .who { display: block; font-size: 28px; font-weight: 700; color: ${C.ink2}; margin-bottom: 6px; } #root .mg.me .who { color: rgba(23,30,37,0.7); }
        #root .mg.quote .q { border-left: 6px solid ${C.accent}; padding-left: 18px; font-style: italic; }
        #root .mg.bad { background: ${C.blockedBg}; border: 2px solid ${C.blocked}; } #root .mg.ok { background: ${C.doneBg}; border: 2px solid ${C.done}; }`;
      const body = `<div id="${id}-w">${msgs.map((m, i) => `<div class="mg ${m.from === 'me' ? 'me' : 'them'}${m.kind ? ` ${m.kind}` : ''}" id="${id}-m${i}">${m.who ? `<span class="who">${esc(m.who)}</span>` : ''}${m.kind === 'quote' ? `<div class="q">${esc(m.text)}</div>` : esc(m.text)}</div>`).join('')}</div>`;
      // Later messages push earlier ones up: each bubble takes no space until it arrives.
      const js = msgs.map((m, i) => { const t = ctx.t(m, 0.3 + i * 0.9); return `tl.set("#${id}-m${i}", { display: "none" }, 0); tl.set("#${id}-m${i}", { display: "block" }, ${r3(t)}); tl.fromTo("#${id}-m${i}", { opacity: 0, y: 30, scale: 0.92, transformOrigin: "${m.from === 'me' ? '100% 100%' : '0% 100%'}" }, { opacity: 1, y: 0, scale: 1, duration: 0.3, ease: "back.out(1.6)" }, ${r3(t)});`; }).join('\n');
      const ex = extras(id, v, dur, ctx, { x: 360, y: 70, w: 1200, h: 800 }), lt = lowerThird(id, v.lt, ctx.edition, 60, 40);
      return scene(id, dur, { css: g.css + css + ex.css + lt.css, body: g.body + body + ex.body + lt.body, js: js + ex.js + lt.js });
    },

    // Ledger rows building: { when, what, amount, status, cue/at }, with a running total.
    ledger(id, v, dur, ctx) {
      const g = ground(id, v.bg ?? 'grid'), rows = v.rows;
      const css = `#${id}-k { position: absolute; left: 200px; top: 90px; font-size: 32px; color: ${C.ink2}; }
        #${id}-tb { position: absolute; left: 200px; right: 200px; top: 160px; }
        #root .lr { display: grid; grid-template-columns: 210px 1fr 260px 220px; align-items: center; gap: 24px; padding: 20px 26px; border-bottom: 2px solid ${C.rule}; font-size: 34px; opacity: 0; }
        #root .lr .wh { font-family: "Atkinson Hyperlegible Mono", monospace; font-size: 28px; color: ${C.ink2}; } #root .lr .am { text-align: right; font-weight: 700; font-variant-numeric: tabular-nums; }
        #root .lr .stt { justify-self: end; font-size: 28px; font-weight: 700; padding: 4px 16px; border-radius: 999px; }
        #${id}-tot { position: absolute; right: 200px; top: ${180 + rows.length * 92}px; font-size: 44px; font-weight: 700; opacity: 0; }
        #${id}-src { position: absolute; left: 200px; right: 200px; top: ${260 + rows.length * 92}px; font-size: 28px; color: ${C.ink2}; opacity: 0; }`;
      const stc = (s) => s === 'blocked' || s === 'refused' ? `color:${C.blocked};background:${C.blockedBg}` : s === 'waiting' || s === 'asks' ? `color:${C.amber};background:#3a3020` : `color:${C.done};background:${C.doneBg}`;
      const body = `${v.kicker ? `<div id="${id}-k" class="mono">${esc(v.kicker)}</div>` : ''}<div id="${id}-tb">${rows.map((r, i) => `<div class="lr" id="${id}-r${i}"><span class="wh">${esc(r.when ?? '')}</span><span>${esc(r.what)}</span><span class="am">${esc(r.amount ?? '')}</span>${r.status ? `<span class="stt" style="${stc(r.statusKind ?? r.status.toLowerCase())}">${esc(r.status)}</span>` : '<span></span>'}</div>`).join('')}</div>
        ${v.total ? `<div id="${id}-tot">${esc(v.total)}</div>` : ''}${v.source ? `<div id="${id}-src" class="mono">${esc(v.source)}</div>` : ''}`;
      const js = rows.map((r, i) => `tl.fromTo("#${id}-r${i}", { opacity: 0, x: -30 }, { opacity: 1, x: 0, duration: 0.35, ease: "power3.out" }, ${r3(ctx.t(r, 0.3 + i * 0.6))});`).join('\n') +
        (v.total ? `tl.fromTo("#${id}-tot", { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.35 }, ${r3(ctx.t(v.totalAt ?? {}, 0.6 + rows.length * 0.6))});` : '') +
        (v.source ? `tl.fromTo("#${id}-src", { opacity: 0 }, { opacity: 1, duration: 0.4 }, ${r3(ctx.t(v.sourceAt ?? {}, 1.2))});` : '');
      const ex = extras(id, v, dur, ctx, { x: 0, y: 0, w: W, h: H });
      return scene(id, dur, { css: g.css + css + ex.css, body: g.body + body + ex.body, js: js + ex.js });
    },
  };
}
