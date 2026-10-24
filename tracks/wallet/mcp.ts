// The GurtOS wallet as a stdio MCP server, for any agent outside a box (Claude Code, Factory Droid, others).
// It runs the same tool objects as the box (exact price, host allowlist, never pay twice, devnet USDC only)
// and adds what the box normally does: a spending budget, a human OK above it, and an action log.
//
// Config (environment):
//   WALLET_SOLANA_KEY | WALLET_KEY_FILE   the devnet key, or a 0600 file holding it (default $WALLET_HOME/key)
//   WALLET_BUDGET_CENTS                   total the agent may spend without asking (default 10)
//   WALLET_HOSTS                          comma list of hosts the agent may pay, e.g. api.example.com,*.x.com
//   WALLET_HOME                           state dir with ledger.jsonl and actions.jsonl (default ~/.gurtos-wallet)
// All money is Solana devnet USDC (test money).
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import type { Approval, Ctx, Tool } from '../../core/contract.ts';
import wallet from './track.ts';

// MCP tool names allow [a-zA-Z0-9_-]; wallet tools are '<track>.<verb>'. Same mapping as core/workers/mcp.ts.
const mcpName = (name: string) => name.replaceAll('.', '__');
const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0, 12);
const lines = (file: string): any[] => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);

export type Config = { home: string; budgetCents: number; hosts: string[]; keyFile: string };

export function configFromEnv(env = process.env): Config {
  const home = env.WALLET_HOME || path.join(os.homedir(), '.gurtos-wallet');
  const budgetCents = env.WALLET_BUDGET_CENTS === undefined ? 10 : Number(env.WALLET_BUDGET_CENTS);
  if (!Number.isFinite(budgetCents) || budgetCents < 0) throw new Error('WALLET_BUDGET_CENTS must be a number of cents, 0 or more');
  const hosts = (env.WALLET_HOSTS ?? '').split(',').map((h) => h.trim()).filter(Boolean);
  return { home, budgetCents, hosts, keyFile: env.WALLET_KEY_FILE || path.join(home, 'key') };
}

/** The wallet key: from WALLET_SOLANA_KEY, else from a file only the owner can read. */
function readKey(cfg: Config, env = process.env): string {
  if (env.WALLET_SOLANA_KEY) return env.WALLET_SOLANA_KEY.trim();
  if (!fs.existsSync(cfg.keyFile)) throw new Error(`no wallet key: set WALLET_SOLANA_KEY, or put a devnet key in ${cfg.keyFile} (mode 0600). tracks/wallet/install.sh makes one.`);
  if (fs.statSync(cfg.keyFile).mode & 0o077) throw new Error(`${cfg.keyFile} is readable by other users; run: chmod 600 ${cfg.keyFile}`);
  return fs.readFileSync(cfg.keyFile, 'utf8').replace(/^WALLET_SOLANA_KEY=/, '').trim();
}

type Send = (msg: object) => void;

/** One wallet server. `send` writes a JSON-RPC message to the client; `onMessage` takes each line the client sent. */
export function createServer(cfg: Config, send: Send) {
  fs.mkdirSync(cfg.home, { recursive: true, mode: 0o700 });
  // The tools keep their payment marks and ledger under $BOX_HOME/wallet.
  process.env.BOX_HOME = cfg.home;
  const ledgerFile = path.join(cfg.home, 'ledger.jsonl');
  const actionFile = path.join(cfg.home, 'actions.jsonl');
  const append = (file: string, row: object) => fs.appendFileSync(file, JSON.stringify({ at: new Date().toISOString(), ...row }) + '\n', { mode: 0o600 });
  const spent = () => lines(ledgerFile).reduce((sum, r) => sum + r.cents, 0);
  const tools = new Map((wallet.tools as Tool[]).map((t) => [mcpName(t.name), t]));
  const approvals: Approval[] = [];
  let nextId = 1;
  const waiting = new Map<number, (r: any) => void>();
  let canElicit = false;
  let queue: Promise<unknown> = Promise.resolve(); // one call at a time, so the budget check and the spend cannot race

  /** Ask the human through the client. Anything but an explicit yes is a no. */
  async function elicit(message: string): Promise<boolean> {
    const id = nextId++;
    const answer = new Promise<any>((res) => waiting.set(id, res));
    send({
      jsonrpc: '2.0', id, method: 'elicitation/create',
      params: { message, requestedSchema: { type: 'object', properties: { approve: { type: 'boolean', title: 'Pay this (test money)?' } }, required: ['approve'] } },
    });
    const r = await answer;
    return r?.action === 'accept' && r.content?.approve === true;
  }

  async function callTool(tool: Tool, input: any) {
    const ctx = (key: string): Ctx =>
      ({
        key,
        task: { id: 'mcp', hosts: cfg.hosts },
        box: { approvals: () => approvals },
        secret: (name: string) => {
          if (!tool.secrets?.includes(name)) throw new Error(`${tool.name} may not read ${name}`);
          if (name === 'WALLET_SOLANA_KEY') return readKey(cfg);
          const v = process.env[name];
          if (!v) throw new Error(`${name} is not set`);
          return v;
        },
        log: (text: string, data?: unknown) => append(actionFile, { type: 'log', tool: tool.name, text, data }),
        cost: (cents: number, what: string) => append(ledgerFile, { cents, what }),
      }) as unknown as Ctx;

    const h = hash([tool.name, input]);
    // Same call again gets a new key only once the earlier one has an answer. A crash mid-payment leaves no answer,
    // so the retry reuses the key and the payment mark refuses it instead of paying twice.
    const key = `mcp.${h}.${lines(actionFile).filter((r) => r.type === 'result' && r.hash === h).length}`;
    const cents = tool.cost ? tool.cost(input) : 0;
    const info = tool.approval?.(input) ?? {};
    append(actionFile, { type: 'call', tool: tool.name, hash: h, key, input, cents });
    const done = (ok: boolean, body: unknown) => (append(actionFile, { type: 'result', tool: tool.name, hash: h, ok, cents: ok ? cents : 0, output: ok ? body : undefined, error: ok ? undefined : (body as Error).message }), body);

    if (cents > 0) {
      const left = Math.max(0, cfg.budgetCents - spent());
      if (cents > left) {
        if (!canElicit) {
          throw done(false, new Error(`this costs ${cents} cents (test money) and the wallet has ${left} of ${cfg.budgetCents} cents left. This client cannot ask you to approve it. To allow it, set WALLET_BUDGET_CENTS higher in the server's config and restart. The agent cannot change this.`));
        }
        const ok = await elicit(`The agent wants to pay ${cents} cents (test money, Solana devnet USDC)\nTo: ${info.payee ?? 'unknown'}\nFor: ${info.purpose ?? tool.name}\nBudget left: ${left} of ${cfg.budgetCents} cents.`);
        if (!ok) throw done(false, new Error('not approved: the owner said no. Stop buying and report it.'));
        approvals.push({ task: 'mcp', state: 'approved', purpose: info.purpose, costCents: cents } as Approval);
      }
      append(ledgerFile, { cents, tool: tool.name, key, state: 'reserved' }); // counted before money moves; released below if the call fails
    }
    try {
      return done(true, await tool.run(input, ctx(key)));
    } catch (e) {
      if (cents > 0) append(ledgerFile, { cents: -cents, tool: tool.name, key, state: 'released' });
      const msg = (e as Error).message;
      throw done(false, new Error(cfg.hosts.length === 0 && /hosts/.test(msg) ? `${msg}. No hosts are allowed: set WALLET_HOSTS to the API hosts this agent may pay.` : msg));
    }
  }

  async function handle(method: string, params: any) {
    switch (method) {
      case 'initialize':
        canElicit = !!params?.capabilities?.elicitation;
        return { protocolVersion: params?.protocolVersion ?? '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'gurtos-wallet', version: '1' } };
      case 'ping':
        return {};
      case 'tools/list':
        return { tools: [...tools].map(([name, t]) => ({ name, description: t.description, inputSchema: t.input ?? { type: 'object' } })) };
      case 'tools/call': {
        const tool = tools.get(params?.name);
        if (!tool) throw Object.assign(new Error(`unknown tool ${params?.name}`), { code: -32602 });
        const run = queue.then(() => callTool(tool, params.arguments ?? {}));
        queue = run.catch(() => {});
        try {
          return { content: [{ type: 'text', text: JSON.stringify(await run) }] };
        } catch (e) {
          return { isError: true, content: [{ type: 'text', text: (e as Error).message }] };
        }
      }
      default:
        throw Object.assign(new Error(`method not found: ${method}`), { code: -32601 });
    }
  }

  return {
    async onMessage(line: string) {
      let msg: any;
      try {
        msg = JSON.parse(line);
      } catch {
        return send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'parse error' } });
      }
      if (msg.method === undefined) {
        // the client's answer to our request
        waiting.get(msg.id)?.(msg.result);
        waiting.delete(msg.id);
        return;
      }
      if (msg.id === undefined) return; // notifications need no reply
      try {
        send({ jsonrpc: '2.0', id: msg.id, result: await handle(msg.method, msg.params) });
      } catch (e) {
        send({ jsonrpc: '2.0', id: msg.id, error: { code: (e as any).code ?? -32603, message: (e as Error).message } });
      }
    },
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let cfg: Config;
  try {
    cfg = configFromEnv();
  } catch (e) {
    console.error((e as Error).message);
    process.exit(1);
  }
  const server = createServer(cfg, (m) => process.stdout.write(JSON.stringify(m) + '\n'));
  console.error(`gurtos-wallet: budget ${cfg.budgetCents} cents, hosts ${cfg.hosts.join(',') || '(none)'}, state ${cfg.home}, devnet test money`);
  // Not awaited: a call waiting on the human's answer must not block the answer from being read.
  readline.createInterface({ input: process.stdin }).on('line', (l) => void server.onMessage(l));
}
