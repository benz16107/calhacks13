// Agent-Safe Page Reader: fetch pages, return clean text for an AI agent, and report instructions hidden in them.
import { Actor } from 'apify';
import { analyze } from './detect.js';

const MAX_BYTES = 2_000_000;
const PRIVATE = /^(localhost|.*\.localhost|.*\.local|.*\.internal|0\.0\.0\.0|127\..*|10\..*|192\.168\..*|169\.254\..*|172\.(1[6-9]|2\d|3[01])\..*|\[?::1?\]?|\[?f[cd][0-9a-f]{2}:.*)$/i;

await Actor.init();
const input = (await Actor.getInput()) ?? {};
const urls = [...new Set((input.urls ?? []).map((u) => (typeof u === 'string' ? u : u?.url)).filter(Boolean))].slice(0, Math.min(Number(input.maxPages) || 20, 100));
if (!urls.length) throw new Error('Give at least one address in "urls".');

for (const url of urls) {
  const out = { url, ok: false };
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol)) throw new Error('only http and https addresses');
    if (PRIVATE.test(u.hostname)) throw new Error('private and local addresses are not fetched');
    const res = await fetch(u, { redirect: 'follow', signal: AbortSignal.timeout(30_000), headers: { 'user-agent': 'Mozilla/5.0 (compatible; AgentSafePageReader/1.0; +https://apify.com)', accept: 'text/html,text/plain;q=0.9,*/*;q=0.5' } });
    out.status = res.status;
    out.finalUrl = res.url;
    const body = (await res.text()).slice(0, MAX_BYTES);
    const kind = res.headers.get('content-type') ?? '';
    const a = /html|xml/i.test(kind) || /^\s*</.test(body) ? analyze(body) : analyze(`<pre>${body.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</pre>`);
    Object.assign(out, { ok: res.ok, title: a.title, text: input.includeText === false ? undefined : a.text, risk: a.risk, score: a.score, removedSentences: a.removed, findings: a.findings });
  } catch (e) {
    out.error = e.message;
  }
  await Actor.pushData(out);
}

// A one-line verdict for the run page.
const items = (await (await Actor.openDataset()).getData()).items;
const worst = items.reduce((a, b) => ((b.score ?? 0) > (a.score ?? 0) ? b : a), {});
await Actor.setStatusMessage(`${items.length} page(s). Highest risk: ${worst.risk ?? 'n/a'} (${worst.score ?? 0}/100)${worst.url ? ' at ' + worst.url : ''}`);
await Actor.exit();
