// Finds instructions aimed at AI agents in a web page, and returns the page's text without them.
// No dependencies: the Actor on Apify and the GurtOS box both import this one file.
// shortcut: a tolerant tokenizer, not a full HTML parser, and it reads inline styles only (not stylesheets).
// Upgrade to a real parser plus computed styles if a page hides text with a CSS class we cannot see.

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
const RAW = new Set(['script', 'style']);
const BLOCK = new Set(['p', 'div', 'br', 'li', 'ul', 'ol', 'tr', 'table', 'section', 'article', 'header', 'footer', 'nav', 'main', 'aside', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'pre', 'blockquote', 'form', 'hr']);
// Ways to hide text that real pages also use for good reasons: only reported when the text reads like an instruction.
const BENIGN = new Set(['aria-hidden', 'screen-reader-only']);

/** [id, pattern, weight 1 to 50, what it is] */
export const PATTERNS = [
  ['override', /\b(ignore|disregard|forget|override)\b[^.\n]{0,30}\b(previous|prior|above|earlier|all|any|your|the)\b[^.\n]{0,30}\b(instructions?|prompts?|messages?|rules|task|directions?)\b/i, 40, 'tells the agent to drop its instructions'],
  ['addressed-to-ai', /\b(ai|llm|gpt|assistant|agent|chatbot|language model|bot)s?\b\s*[,:;-]\s*(please\s+)?(you\s+(must|should|will|need)|ignore|disregard|forget|do not|don't|stop|instead|now)\b/i, 30, 'speaks to the AI agent'],
  ['new-role', /\b(you are now|from now on,? you|new instructions?|your new (task|goal|role)|act as (a|an|the))\b/i, 25, 'gives the agent a new role or task'],
  ['secrecy', /\b(do not|don't|never)\s+(tell|inform|mention|reveal|alert|notify|show)\b[^.\n]{0,30}\b(user|human|owner|operator|anyone)\b/i, 40, 'asks the agent to hide it from the user'],
  ['without-asking', /\bwithout\s+(asking|telling|informing|confirmation|the user'?s?\s+(knowledge|consent|permission|approval))\b/i, 25, 'asks for action without consent'],
  ['exfiltrate', /\b(send|post|upload|forward|email|exfiltrate|leak|transmit|copy|paste)\b[^.\n]{0,60}\b(api[ _-]?keys?|tokens?|passwords?|secrets?|credentials?|vault|\.env|cookies?|ssh|private keys?|seed phrase)\b/i, 45, 'asks the agent to send out a secret'],
  ['read-secrets', /\b(read|print|cat|reveal|output|show|dump|list)\b[^.\n]{0,30}(\.env|\bvault\b|api[ _-]?keys?|\bsecrets?\b|system prompt|credentials?)/i, 35, 'asks the agent to read a secret or its own prompt'],
  ['send-to-url', /\b(send|post|submit|forward|upload)\b[^.\n]{0,50}\bhttps?:\/\/\S+/i, 30, 'asks the agent to send data to an address'],
  ['jailbreak', /\b(developer mode|jailbreak|DAN mode|system prompt|reveal your (prompt|instructions))\b/i, 25, 'tries to unlock or read the agent\'s prompt'],
  ['pay-address', /\b(transfer|wire|send|pay)\b[^.\n]{0,60}\b(to|into)\s+(this|the|my)\s+(address|wallet|account|iban)\b/i, 30, 'tells the agent to send money to an address'],
];

const ZERO_WIDTH = /[​-‏⁠⁢-⁤﻿]{3,}/;
const TAG_CHARS = /[\u{E0000}-\u{E007F}]{2,}/u; // "ASCII smuggling": text readable by a model, invisible to a person

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '-', mdash: '-' };
const decode = (s) =>
  s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) && n < 0x110000 ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
const clean = (s) => decode(s).replace(/[ \t\f\r ]+/g, ' ');

function attrsOf(src) {
  const attrs = {};
  for (const m of src.matchAll(/([^\s=/>"']+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s>]*))?/g)) {
    attrs[m[1].toLowerCase()] = m[2] === undefined ? '' : m[2].replace(/^["']|["']$/g, '');
  }
  return attrs;
}

function styleReason(style) {
  const s = style.toLowerCase().replace(/\s+/g, '');
  if (/display:none/.test(s)) return 'display:none';
  if (/visibility:hidden/.test(s)) return 'visibility:hidden';
  if (/opacity:0(\.0+)?(;|$)/.test(s)) return 'opacity:0';
  if (/font-size:0(px|pt|em|rem|%)?(;|$)/.test(s) || /font-size:[01](\.\d+)?px/.test(s)) return 'zero-size text';
  if (/color:transparent/.test(s)) return 'transparent text';
  if (/(left|top|right|bottom|text-indent|margin-left):-?\d{4,}(px|em)?/.test(s) && /-\d{4,}/.test(s)) return 'moved off screen';
  if (/(height:0|width:0|max-height:0)(px)?;/.test(s + ';') && /overflow:hidden/.test(s)) return 'zero-size box';
  if (/clip(-path)?:(rect\(0|inset\(50%|inset\(100%)/.test(s)) return 'clipped to nothing';
  return null;
}

function hiddenReason(tag, attrs) {
  if (tag === 'template') return 'template';
  if (tag === 'noscript') return 'noscript';
  if ('hidden' in attrs) return 'hidden attribute';
  if (attrs.type === 'hidden' && tag === 'input') return 'hidden input';
  const st = attrs.style ? styleReason(attrs.style) : null;
  if (st) return st;
  if ((attrs['aria-hidden'] ?? '').toLowerCase() === 'true') return 'aria-hidden';
  if (/\b(sr-only|visually-hidden|screen-reader-text)\b/.test(attrs.class ?? '')) return 'screen-reader-only';
  return null;
}

const short = (s, n = 200) => (s.length > n ? s.slice(0, n) + '...' : s);
const sentences = (text) => text.split(/(?<=[.!?\n])\s+/).map((x) => x.trim()).filter(Boolean);

/** Which patterns a piece of text matches. */
export function matches(text) {
  const out = PATTERNS.filter(([, re]) => re.test(text)).map(([id, , weight, what]) => ({ id, weight, what }));
  if (TAG_CHARS.test(text)) out.push({ id: 'unicode-tags', weight: 40, what: 'hides text in invisible Unicode tag characters' });
  else if (ZERO_WIDTH.test(text)) out.push({ id: 'invisible-characters', weight: 15, what: 'contains runs of invisible characters' });
  return out;
}

/**
 * @param {string} html
 * @returns {{ title: string, text: string, risk: 'none'|'low'|'medium'|'high', score: number,
 *   findings: { type: string, where: string, hidden: boolean, severity: number, why: string, evidence: string }[],
 *   removed: number }}
 */
export function analyze(html) {
  const findings = [];
  const visible = [];
  const hiddenBits = [];
  const stack = []; // { tag, hidden }
  let title = '';
  const inHead = () => stack.some((e) => e.tag === 'head');
  const add = (type, where, hidden, text, ms) => {
    for (const m of ms) findings.push({ type, where, hidden, severity: Math.min(50, Math.round(m.weight * (hidden ? 1.5 : 1))), why: m.what, evidence: short(text.replace(/\s+/g, ' ').trim()) });
  };

  const lower = html.toLowerCase();
  const re = /<!--([\s\S]*?)-->|<![^>]*>|<\?[^>]*>|<(\/?)([a-zA-Z][\w:-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>|([^<]+|<)/g;
  let m;
  while ((m = re.exec(html))) {
    if (m[1] !== undefined) {
      const ms = matches(m[1]);
      if (ms.length) add('comment', 'HTML comment', true, m[1], ms);
    } else if (m[3] !== undefined) {
      const tag = m[3].toLowerCase();
      if (m[2]) {
        const i = stack.findLastIndex((e) => e.tag === tag);
        if (i >= 0) stack.length = i;
        if (BLOCK.has(tag)) visible.push('\n');
        continue;
      }
      const attrs = attrsOf(m[4]);
      if (BLOCK.has(tag)) visible.push('\n');
      // Text that attributes carry: what an agent reads from the accessibility tree or a tool's page dump.
      for (const k of ['alt', 'title', 'aria-label', 'aria-description', 'placeholder', 'value', 'content', 'data-prompt']) {
        if (attrs[k] && attrs[k].length > 8 && !(k === 'content' && tag === 'meta' && /^(width|viewport|text\/html)/i.test(attrs[k]))) {
          const ms = matches(clean(attrs[k]));
          if (ms.length) add('attribute', `${tag} ${k}`, true, clean(attrs[k]), ms);
        }
      }
      if (RAW.has(tag)) {
        const end = lower.indexOf('</' + tag, re.lastIndex);
        re.lastIndex = end >= 0 ? end : html.length;
        continue;
      }
      if (VOID.has(tag) || m[4].trim().endsWith('/')) continue;
      const parent = stack.findLast((e) => e.hidden);
      stack.push({ tag, hidden: parent?.hidden ?? hiddenReason(tag, attrs) });
    } else if (m[5] !== undefined) {
      const text = clean(m[5]);
      if (!text.trim()) continue;
      const top = stack.findLast((e) => e.hidden);
      if (inHead()) {
        if (stack.at(-1)?.tag === 'title') title += text;
      } else if (top) hiddenBits.push({ text, reason: top.hidden });
      else visible.push(text);
    }
  }

  // Hidden text, grouped by how it is hidden.
  const byReason = new Map();
  for (const h of hiddenBits) byReason.set(h.reason, (byReason.get(h.reason) ?? '') + ' ' + h.text);
  for (const [reason, joined] of byReason) {
    const text = joined.replace(/\s+/g, ' ').trim();
    const ms = matches(text);
    if (ms.length) add('hidden-instruction', reason, true, text, ms);
    else if (text.length >= 80 && !BENIGN.has(reason)) findings.push({ type: 'hidden-text', where: reason, hidden: true, severity: 12, why: 'long text a person cannot see', evidence: short(text) });
  }

  // Visible text: remove sentences that read like instructions to an AI agent, and say so.
  let removed = 0;
  const text = visible.join(' ').replace(/ ?\n ?/g, '\n').replace(/\n{2,}/g, '\n').trim();
  const kept = text.split('\n').map((line) =>
    sentences(line).map((s) => {
      const ms = matches(s).filter((x) => x.weight >= 25 || x.id === 'unicode-tags');
      if (!ms.length) return s;
      removed++;
      add('visible-instruction', 'page text', false, s, ms);
      return '[removed: instruction aimed at AI agents]';
    }).join(' '),
  ).join('\n').replace(/[​-‏⁠⁢-⁤﻿]/gu, '').replace(/[\u{E0000}-\u{E007F}]/gu, '');

  // One entry per place: a block that trips three patterns is one finding with three reasons.
  const merged = new Map();
  for (const f of findings) {
    const k = `${f.type}|${f.where}|${f.evidence}`;
    const o = merged.get(k);
    if (!o) merged.set(k, { ...f });
    else { o.severity = Math.min(100, Math.max(o.severity, f.severity) + Math.round(Math.min(o.severity, f.severity) / 2)); o.why += '; ' + f.why; }
  }
  findings.splice(0, findings.length, ...merged.values());

  // Several weak hits add up, but one strong hit decides: the score is the biggest hit plus half of the rest.
  const sev = findings.map((f) => f.severity).sort((a, b) => b - a);
  const score = Math.min(100, Math.round((sev[0] ?? 0) + sev.slice(1).reduce((a, b) => a + b, 0) / 2));
  const risk = score === 0 ? 'none' : score < 25 ? 'low' : score < 60 ? 'medium' : 'high';
  return { title: clean(title).trim(), text: kept, risk, score, findings, removed };
}
