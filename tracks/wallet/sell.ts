// The box earns too. It sells three services over x402 in devnet USDC (test money), settled through Coinbase's
// CDP facilitator and declared for Coinbase's x402 Bazaar. The payment is the credential: these routes are open to
// strangers, so they check input before they ask for money, cap each day's sales, and never return anything private.
//   GET  /sell/audit   $0.01, exact  the box's latest action-log fingerprint
//   GET  /sell/search  up to $0.02, upto  text files the owner put in BOX_HOME/public, $0.002 per result returned
//   POST /sell/task    $0.25, exact  rent the box's agent: recorded, then started only after the owner approves
import fs from 'node:fs';
import path from 'node:path';
import { HTTPFacilitatorClient, x402HTTPResourceServer, x402ResourceServer } from '@x402/core/server';
import type { FacilitatorClient, HTTPAdapter, RoutesConfig } from '@x402/core/server';
import { declareDiscoveryExtension } from '@x402/extensions/bazaar';
import { ExactSvmScheme } from '@x402/svm/exact/server';
import { UptoSvmScheme } from '@x402/svm/upto/server';
import { DEVNET, USDC, atomic, explorer, signer, usdc, walletDir } from './lib.ts';
import type { Box, LogReader, Route } from '../../core/contract.ts';

export const SEARCH_CENTS_EACH = 0.2;
export const SEARCH_MAX_RESULTS = 10; // 10 x $0.002 = the $0.02 cap
const NO_REFUNDS = 'Devnet test money. There are no refunds in this test version.';
const MAX_QUERY = 100;
const MAX_PROMPT = 1000;
const MAX_FILE_BYTES = 200_000;
const MAX_FILES = 200;
const MAX_DEPTH = 4;
const MAX_OPEN_ORDERS = 5;
const FACILITATOR = 'https://x402.org/facilitator';

export type Sale = { at: string; product: string; cents: number; payer: string; tx: string; network: 'solana-devnet'; test: true };
export type SellOptions = {
  /** The latest action-log fingerprint record, from audit.ts. */
  latestAudit: () => Promise<object | undefined>;
  /** Stand-in facilitator for tests. Default: the CDP facilitator when the vault has CDP keys, else x402.org. */
  facilitator?: FacilitatorClient;
  /** Where the money goes. Default: the box wallet's own address. */
  payTo?: string;
  /** The box's public origin, such as https://box.example.com. Default: the Host header of the request. */
  publicUrl?: string;
  /** Sales stop for the day at either limit. */
  dailyMaxSales?: number;
  dailyMaxCents?: number;
};

// ---------- ledger ----------

const ledgerFile = () => path.join(walletDir(), 'earnings.jsonl');

/** Sales, newest first. */
export function earnings(): Sale[] {
  const file = ledgerFile();
  const lines = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n').filter(Boolean) : [];
  return lines.map((l) => JSON.parse(l) as Sale).reverse();
}

function soldToday(now = new Date()) {
  const today = now.toISOString().slice(0, 10);
  const list = earnings().filter((s) => s.at.slice(0, 10) === today);
  return { count: list.length, cents: list.reduce((n, s) => n + s.cents, 0) };
}

// ---------- search ----------

export type Hit = { file: string; line: number; text: string };

/** Case-insensitive search of the text files below `root`. Skips symlinks, big files and binaries. */
export function searchPublic(root: string, q: string, max = SEARCH_MAX_RESULTS): Hit[] {
  fs.mkdirSync(root, { recursive: true });
  const base = fs.realpathSync(root);
  const needle = q.toLowerCase();
  const hits: Hit[] = [];
  let seen = 0;
  const walk = (dir: string, depth: number) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (hits.length >= max || seen >= MAX_FILES) return;
      const full = path.join(dir, e.name);
      if (e.isSymbolicLink()) continue;
      if (e.isDirectory()) {
        if (depth < MAX_DEPTH) walk(full, depth + 1);
        continue;
      }
      if (!e.isFile() || e.name.startsWith('.')) continue;
      seen++;
      if (!fs.realpathSync(full).startsWith(base + path.sep) || fs.statSync(full).size > MAX_FILE_BYTES) continue;
      const text = fs.readFileSync(full, 'utf8');
      if (text.includes('\0')) continue;
      const lines = text.split('\n');
      const i = lines.findIndex((l) => l.toLowerCase().includes(needle));
      if (i >= 0) hits.push({ file: path.relative(base, full), line: i + 1, text: lines[i].trim().slice(0, 200) });
    }
  };
  walk(base, 0);
  return hits;
}

// ---------- products ----------

type Out = { status?: number; body: object; /** Atomic units to settle, for upto. Default: the full price. */ settle?: string; after?: (s: { payer: string; tx: string }) => Promise<object | void> };
type Product = {
  key: string;
  scheme: 'exact' | 'upto';
  cents: number; // the price, or for upto the cap
  description: string;
  discovery: Record<string, unknown>;
  /** Validate the request before any payment is asked or accepted. Throws a message for a 400. */
  parse?: (url: URL, body: string) => unknown;
  run: (input: any, box: Box, o: SellOptions) => Promise<Out>;
};

const cleanLine = (s: string) => s.replace(/\s+/g, ' ').trim();

const products: Product[] = [
  {
    key: 'GET /sell/audit',
    scheme: 'exact',
    cents: 1,
    description: "Proof of what this box's agents did: the latest fingerprint of the GurtOS action log. Devnet test money.",
    discovery: declareDiscoveryExtension({
      output: { example: { fingerprint: { head: '9f2c…', events: 412 }, test: true }, schema: { type: 'object', properties: { fingerprint: { type: 'object' } } } },
    }),
    async run(_input, _box, o) {
      const fingerprint = await o.latestAudit();
      return fingerprint ? { body: { fingerprint, test: true } } : { status: 404, body: { error: 'this box has no audit fingerprint yet' } };
    },
  },
  {
    key: 'GET /sell/search',
    scheme: 'upto',
    cents: SEARCH_CENTS_EACH * SEARCH_MAX_RESULTS,
    description: `Search the text files this box's owner published. Pay $0.002 per result returned, at most $0.02 per call. Devnet test money.`,
    discovery: declareDiscoveryExtension({
      input: { q: 'invoice' },
      inputSchema: { properties: { q: { type: 'string', minLength: 1, maxLength: MAX_QUERY, description: 'Words to find' } }, required: ['q'] },
      output: { example: { results: [{ file: 'notes/plan.txt', line: 3, text: 'Send the invoice on Friday' }], charged_usdc: '0.002', test: true } },
    }),
    parse(url) {
      const q = cleanLine(url.searchParams.get('q') ?? '');
      if (!q || q.length > MAX_QUERY) throw new Error(`q must be 1 to ${MAX_QUERY} characters`);
      return { q };
    },
    async run({ q }: { q: string }) {
      const results = searchPublic(path.join(process.env.BOX_HOME ?? '/var/lib/box', 'public'), q);
      const settle = String(results.length * Math.round(SEARCH_CENTS_EACH * 10_000));
      return { body: { results, charged_usdc: usdc(settle), test: true }, settle };
    },
  },
  {
    key: 'POST /sell/task',
    scheme: 'exact',
    cents: 25,
    description: `Rent this box's agent. Your request is recorded and starts only after the box owner approves it. ${NO_REFUNDS}`,
    discovery: declareDiscoveryExtension({
      bodyType: 'json',
      input: { prompt: 'Summarize the public notes in one paragraph' },
      inputSchema: { properties: { prompt: { type: 'string', minLength: 1, maxLength: MAX_PROMPT } }, required: ['prompt'] },
      output: { example: { order: 'abc123', status: 'waiting for the owner to approve', refunds: false, test: true } },
    }),
    parse(_url, body) {
      let prompt: unknown;
      try {
        prompt = JSON.parse(body).prompt;
      } catch {
        throw new Error('the body must be JSON like {"prompt": "..."}');
      }
      if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > MAX_PROMPT) throw new Error(`prompt must be 1 to ${MAX_PROMPT} characters`);
      return { prompt: prompt.trim() };
    },
    async run({ prompt }: { prompt: string }, box) {
      const open = box.tasks().filter((t) => t.source.startsWith('x402:') && t.worker === 'fake' && ['queued', 'running', 'waiting'].includes(t.state));
      if (open.length >= MAX_OPEN_ORDERS) return { status: 503, body: { error: 'too many paid requests are waiting for the owner; try later' } };
      return {
        body: {
          status: 'recorded. Nothing runs until the box owner approves it',
          refunds: false,
          note: NO_REFUNDS,
          test: true,
        },
        // Create the order only once the payment settled, so a failed payment leaves nothing behind.
        async after({ payer, tx }) {
          const ask = await box.createTask({
            title: `Paid request from ${payer}`,
            prompt: `ask Approve a paid request from ${payer} ($0.25, devnet test money)? They ask: ${cleanLine(prompt)}`,
            worker: 'fake',
            source: `x402:${payer}`,
          });
          fs.appendFileSync(path.join(walletDir(), 'orders.jsonl'), JSON.stringify({ ask: ask.id, payer, tx, prompt }) + '\n');
          return { order: ask.id };
        },
      };
    },
  },
];

export const ROUTE_KEYS = ['GET /sell', ...products.map((p) => p.key)];

// ---------- paid task orders ----------

/** When the owner approves a paid request (its ask task finishes), start the real task. Register it in logReaders. */
export const orderReader: LogReader = {
  name: 'sell-orders',
  async read(e, box) {
    if (e.type !== 'task.state' || e.state !== 'done') return;
    const file = path.join(walletDir(), 'orders.jsonl');
    if (!fs.existsSync(file)) return;
    const order = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).find((o) => o.ask === e.task);
    if (!order) return;
    const title = `Paid request ${order.ask}`;
    const source = `x402:${order.payer}`;
    if (box.tasks().some((t) => t.title === title && t.source === source)) return; // replayed after a restart
    const workspace = `x402-${String(order.ask).replace(/[^\w-]/g, '')}`;
    box.workspace(workspace);
    await box.createTask({ title, prompt: order.prompt, worker: 'droid', tools: [], hosts: [], budgetCents: 0, source, workspace });
  },
};

// ---------- the x402 server ----------

function adapter(req: Request, path: string, url: string, body: unknown): HTTPAdapter {
  const query = Object.fromEntries(new URL(req.url).searchParams);
  return {
    getHeader: (n) => req.headers.get(n) ?? undefined,
    getMethod: () => req.method,
    getPath: () => path,
    getUrl: () => url,
    getAcceptHeader: () => req.headers.get('accept') ?? '',
    getUserAgent: () => req.headers.get('user-agent') ?? '',
    getQueryParams: () => query,
    getQueryParam: (n) => query[n],
    getBody: () => body,
  };
}

async function pickFacilitator(box: Box): Promise<FacilitatorClient> {
  try {
    const apiKeyId = box.secret('CDP_API_KEY_ID');
    const apiKeySecret = box.secret('CDP_API_KEY_SECRET');
    return (await import('@coinbase/cdp-sdk/x402')).createCdpFacilitatorClient({ apiKeyId, apiKeySecret });
  } catch {
    return new HTTPFacilitatorClient({ url: FACILITATOR });
  }
}

/** The routes to put in a track's `routes`, their keys for `openRoutes`, and the reader for `logReaders`. */
export function sellRoutes(o: SellOptions) {
  const maxSales = o.dailyMaxSales ?? 200;
  const maxCents = o.dailyMaxCents ?? 500;
  let inflight = 0; // cents that requests being paid right now may still settle
  let ready: Promise<{ http: x402HTTPResourceServer; payTo: string }> | undefined;

  const setup = (box: Box) =>
    (ready ??= (async () => {
      const payTo = o.payTo ?? (await signer({ secret: (n: string) => box.secret(n) } as any)).address;
      const server = new x402ResourceServer(o.facilitator ?? (await pickFacilitator(box)));
      server.register(DEVNET, new ExactSvmScheme()).register(DEVNET, new UptoSvmScheme());
      const { bazaarResourceServerExtension } = await import('@x402/extensions/bazaar');
      server.registerExtension(bazaarResourceServerExtension);
      const routes: RoutesConfig = {};
      for (const p of products) {
        routes[p.key] = {
          accepts: { scheme: p.scheme, network: DEVNET, payTo, price: { amount: atomic(p.cents), asset: USDC } },
          description: p.description,
          mimeType: 'application/json',
          serviceName: 'GurtOS box',
          tags: ['gurtos', 'agents', 'devnet', 'test'],
          extensions: p.discovery,
        };
      }
      const http = new x402HTTPResourceServer(server, routes);
      await http.initialize();
      return { http, payTo };
    })().catch((e) => ((ready = undefined), Promise.reject(e))));

  const route = (p: Product): Route => async (req, box) => {
    const url = new URL(req.url);
    const sold = soldToday();
    if (sold.count >= maxSales || sold.cents + inflight + p.cents > maxCents) {
      return Response.json({ error: "this box's sales limit for today is used up; try tomorrow", test: true }, { status: 503 });
    }
    const paymentHeader = req.headers.get('payment-signature') ?? req.headers.get('x-payment') ?? undefined;
    let input: unknown;
    let bodyText = '';
    if (paymentHeader) {
      // Strangers choose this input: check it before anything is verified or settled.
      try {
        bodyText = req.method === 'POST' ? await req.text() : '';
        if (bodyText.length > 4096) throw new Error('the body is too long');
        input = p.parse?.(url, bodyText);
      } catch (e) {
        return Response.json({ error: (e as Error).message }, { status: 400 });
      }
    }
    inflight += p.cents;
    try {
      const { http } = await setup(box);
      const proto = req.headers.get('x-forwarded-proto') ?? 'https';
      const publicUrl = (o.publicUrl ?? `${proto}://${req.headers.get('host') ?? 'box'}`).replace(/\/$/, '') + url.pathname + url.search;
      const sellPath = url.pathname.replace(/^\/t\/wallet/, '');
      const ctx = { adapter: adapter(req, sellPath, publicUrl, input), path: sellPath, decodedPath: sellPath, method: req.method, paymentHeader };
      const r = await http.processHTTPRequest(ctx);
      if (r.type === 'no-payment-required') return Response.json({ error: 'not a paid route' }, { status: 404 });
      if (r.type === 'payment-error') {
        const { status, headers, body, isHtml } = r.response;
        return new Response(isHtml ? String(body) : JSON.stringify(body ?? {}), { status, headers: { ...headers, ...(isHtml ? {} : { 'content-type': 'application/json' }) } });
      }
      const out = await p.run(input, box, o);
      if ((out.status ?? 200) >= 400 || out.settle === '0') {
        const cancelled = await r.cancellationDispatcher.cancel({ reason: 'handler_failed', responseStatus: out.status ?? 200 });
        const headers = http.createFailurePathSettlementHeaders(cancelled, r.beforeHandlerSettlement, r.paymentPayload, null);
        return Response.json({ ...out.body, charged_usdc: '0', ...(out.status ? {} : { note: 'nothing matched, so you were not charged' }) }, { status: out.status ?? 200, headers });
      }
      const settled = await http.processSettlement(r.paymentPayload, r.paymentRequirements, r.declaredExtensions, { request: ctx, responseBody: Buffer.from(JSON.stringify(out.body)), responseHeaders: {} }, out.settle ? { amount: out.settle } : undefined, r.beforeHandlerSettlement);
      if (!settled.success) {
        const { status, headers, body } = settled.response;
        return Response.json(body ?? {}, { status, headers });
      }
      const payer = settled.payer ?? 'unknown';
      const cents = Number(settled.amount ?? atomic(p.cents)) / 10_000;
      const extra = await out.after?.({ payer, tx: settled.transaction });
      const sale: Sale = { at: new Date().toISOString(), product: p.key.split(' ')[1], cents, payer, tx: settled.transaction, network: 'solana-devnet', test: true };
      fs.appendFileSync(ledgerFile(), JSON.stringify(sale) + '\n');
      box.note({ sale });
      return Response.json({ ...out.body, ...extra, explorer: explorer('tx', sale.tx) }, { headers: settled.headers });
    } catch (e) {
      const status = (e as { name?: string }).name?.startsWith('Facilitator') ? 502 : 500;
      return Response.json({ error: status === 502 ? 'the payment facilitator did not answer; you were not charged' : 'the box could not complete this sale' }, { status });
    } finally {
      inflight -= p.cents;
    }
  };

  const routes: Record<string, Route> = {
    'GET /sell': () =>
      Response.json({
        about: "GurtOS box services, paid with x402 in devnet USDC (test money). Request a path with no payment to see its price.",
        network: DEVNET,
        asset: USDC,
        services: products.map((p) => ({ route: p.key, scheme: p.scheme, [p.scheme === 'upto' ? 'max_usdc' : 'usdc']: usdc(atomic(p.cents)), description: p.description })),
        refunds: false,
        test: true,
      }),
  };
  for (const p of products) routes[p.key] = route(p);
  return { routes, openRoutes: ROUTE_KEYS, logReaders: [orderReader] };
}
