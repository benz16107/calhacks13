// A small Apify client for the track's tools. It runs inside the core and holds the token only for the length of a call.
import type { Ctx } from '../../core/contract.ts';

export const API = 'https://api.apify.com/v2';
// Every result goes into the action log, so one call returns at most this many characters of items.
const MAX_OUTPUT = 20_000;
const DONE = ['SUCCEEDED', 'FAILED', 'ABORTED', 'TIMED-OUT'];
type Query = Record<string, string | number>;

export const clamp = (v: unknown, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(Number(v)) || lo));
export const text = (v: unknown, what: string) => {
  const s = typeof v === 'string' ? v.trim() : '';
  if (!s) throw new Error(`${what} is required`);
  return s;
};
const qs = (q: Query = {}) => new URLSearchParams(Object.entries(q).map(([k, v]) => [k, String(v)])).toString();

/** One Apify API call. Errors carry Apify's message, never the token. */
export async function call(token: string, method: string, path: string, body?: unknown, ms = 60_000) {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(ms),
  });
  const out = await r.json().catch(() => undefined);
  if (!r.ok) throw new Error(`Apify ${r.status}: ${out?.error?.message ?? r.statusText}`);
  return out;
}

/** The token from the vault, trimmed. An empty value counts as none. */
export function token(ctx: Pick<Ctx, 'secret'>) {
  const t = ctx.secret('APIFY_TOKEN').trim();
  if (!t) throw new Error('the vault has no APIFY_TOKEN');
  return t;
}

/** How long to wait before reading a finished run's cost. Tests set it to 0. */
export const settle = { ms: 1500 };

export type Ran = { items: Record<string, any>[]; runId: string; usd?: number };

/**
 * Run an Actor, wait for it, and read its dataset. The run endpoint (not the run-and-wait one) is used so the
 * run's real cost comes back. `run` limits the run (timeout, memory, maxTotalChargeUsd); `items` shapes the results.
 */
export async function runActor(ctx: Ctx, actor: string, input: unknown, o: { run?: Query; items?: Query } = {}): Promise<Ran> {
  // Owner/name, owner~name or an Actor ID. No leading dots, so the name cannot walk to another API path.
  if (!/^[\w-][\w.-]*([/~][\w-][\w.-]*)?$/.test(actor)) throw new Error(`not an Actor name: ${actor}`);
  const t = token(ctx);
  const run = { timeout: 120, ...o.run };
  let r = (await call(t, 'POST', `/acts/${actor.replace('/', '~')}/runs?${qs(run)}`, input ?? {})).data;
  const deadline = Date.now() + (Number(run.timeout) + 60) * 1000;
  while (!DONE.includes(r.status)) {
    if (Date.now() > deadline) {
      await call(t, 'POST', `/actor-runs/${r.id}/abort`).catch(() => {});
      throw new Error('the Actor run took too long and was stopped');
    }
    r = (await call(t, 'GET', `/actor-runs/${r.id}?waitForFinish=25`, undefined, 40_000)).data;
  }
  if (r.status !== 'SUCCEEDED') throw new Error(`Apify run ${r.status}${r.statusMessage ? `: ${r.statusMessage}` : ''}`);
  // Apify finishes adding up a run's usage a moment after it reports SUCCEEDED, so read it once more.
  if (settle.ms) {
    await new Promise((res) => setTimeout(res, settle.ms));
    r = (await call(t, 'GET', `/actor-runs/${r.id}`)).data;
  }
  const items = await call(t, 'GET', `/datasets/${r.defaultDatasetId}/items?${qs(o.items)}`);
  if (!Array.isArray(items)) throw new Error('Apify returned no dataset items');
  if (JSON.stringify(items).includes(t)) throw new Error('the Actor returned the API token, so the result was withheld');
  return { items, runId: r.id, usd: typeof r.usageTotalUsd === 'number' ? r.usageTotalUsd : undefined };
}

/** What Apify reports for the runs, for the log and the portal. The box counts the call's estimate; this  is Apify's own number.  */
export function reportCost(ctx: Ctx, what: string, ...runs: Ran[]) {
  const usd = runs.reduce((a, r) => a + (r.usd ?? 0), 0);
  ctx.log(`Apify ${what}: ${runs.some((r) => r.usd !== undefined) ? `$${usd.toFixed(4)} reported` : 'usage not reported yet'}`, { apify: { what, runs: runs.map((r) => r.runId), usd } });
  return usd;
}

/** Cut every string in a value to `max` characters. */
export const shorten = (v: unknown, max: number): unknown =>
  typeof v === 'string' ? (v.length > max ? v.slice(0, max) + '...' : v)
  : Array.isArray(v) ? v.map((x) => shorten(x, max))
  : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shorten(x, max)]))
  : v;

/** Keep as many whole items as fit in MAX_OUTPUT characters. If not even the first fits, keep it with its long text cut. */
export function fit(items: unknown[]) {
  const kept: unknown[] = [];
  let size = 2;
  for (const item of items) {
    size += JSON.stringify(item).length + 1;
    if (size > MAX_OUTPUT) break;
    kept.push(item);
  }
  const cut = !kept.length && items.length > 0;
  if (cut) kept.push(shorten(items[0], 2000));
  return { count: items.length, items: kept, ...((cut || kept.length < items.length) && { truncated: true }) };
}

// ---------- Apify's MCP server ----------

const MCP = 'https://mcp.apify.com/';

/** One call to Apify's hosted MCP server (Streamable HTTP), limited to the Actors in `tools`. Opens and closes its own session. */
export async function mcp(t: string, tools: string[], method: 'tools/list' | 'tools/call', params: object = {}) {
  const url = `${MCP}?tools=${tools.join(',')}`;
  const headers: Record<string, string> = { authorization: `Bearer ${t}`, 'content-type': 'application/json', accept: 'application/json, text/event-stream' };
  const post = (body: object, session?: string) =>
    fetch(url, { method: 'POST', headers: { ...headers, ...(session && { 'mcp-session-id': session, 'mcp-protocol-version': '2025-06-18' }) }, body: JSON.stringify(body), signal: AbortSignal.timeout(180_000) });
  // A reply is plain JSON or an event stream whose "data:" lines hold JSON-RPC messages.
  const reply = async (res: Response, id: number) => {
    const body = await res.text();
    if (!res.ok) throw new Error(`Apify MCP ${res.status}: ${body.slice(0, 200)}`);
    const msgs = /event-stream/.test(res.headers.get('content-type') ?? '')
      ? body.split('\n').filter((l) => l.startsWith('data:')).map((l) => JSON.parse(l.slice(5)))
      : [JSON.parse(body)];
    const m = msgs.find((x) => x.id === id);
    if (!m) throw new Error('Apify MCP sent no answer');
    if (m.error) throw new Error(`Apify MCP: ${m.error.message}`);
    return m.result;
  };
  const init = await post({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'gurtos-box', version: '1' } } });
  const session = init.headers.get('mcp-session-id') ?? undefined;
  await reply(init, 1);
  try {
    await (await post({ jsonrpc: '2.0', method: 'notifications/initialized' }, session)).text();
    return await reply(await post({ jsonrpc: '2.0', id: 2, method, params }, session), 2);
  } finally {
    if (session) void fetch(url, { method: 'DELETE', headers: { ...headers, 'mcp-session-id': session } }).catch(() => {});
  }
}
