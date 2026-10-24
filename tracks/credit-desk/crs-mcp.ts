// CRS's own MCP server (@crscreditapi/crs-calhacks-mcp-server) behind the broker. The core starts it as a child process
// with the CRS login from the vault in its environment, so the login never reaches a task. A task cannot talk to the MCP
// server directly: it gets two broker tools, and each seat's tool list says which it may use.
//
//   credit-desk.crs_docs    CRS's product guides and API schemas. Read-only text, no login used. Every seat.
//   credit-desk.crs_lookup  CRS's debug_request: re-open the raw record behind a CRS request id. The analyst only, and only for an
//                   id a pull in this run returned, so it cannot be used to fetch a report nobody pulled for a reason.
//
// Why a wrapper and not the MCP server handed to the seat: the server takes its login from its environment, which the core
// can set, so no change to it is needed. But it exposes personas with SSNs and a lookup of any request id, with no
// purpose, no limit and no seat. The wrapper keeps the server and drops those. The server's own docs tools for test
// data and personas are not exposed.
import { spawn, type ChildProcess } from 'node:child_process';
import { createRequire } from 'node:module';
import type { Tool } from '../../core/contract.ts';
import { CRS_HOST } from './crs.ts';
import { readLog, runOf, toolUses } from './desk.ts';

const ENTRY = createRequire(import.meta.url).resolve('@crscreditapi/crs-calhacks-mcp-server');
export const DOCS = ['get_product_guide', 'get_api_schema', 'get_use_cases', 'get_auth_info'];
export const LOOKUPS_PER_TASK = 6;
const MAX_TEXT = 4000;

export class Mcp {
  private child: ChildProcess;
  private id = 0;
  private waiting = new Map<number, (r: any) => void>();
  private buf = '';
  exited = false;

  constructor(env: Record<string, string>) {
    this.child = spawn(process.execPath, [ENTRY], { env: { PATH: process.env.PATH ?? '', ...env }, stdio: ['pipe', 'pipe', 'ignore'] });
    this.child.stdout!.on('data', (d: Buffer) => {
      this.buf += d;
      for (let i; (i = this.buf.indexOf('\n')) >= 0; ) {
        const line = this.buf.slice(0, i);
        this.buf = this.buf.slice(i + 1);
        try {
          const m = JSON.parse(line);
          this.waiting.get(m.id)?.(m);
          this.waiting.delete(m.id);
        } catch {}
      }
    });
    this.child.on('exit', () => {
      this.exited = true;
      for (const w of this.waiting.values()) w({ error: { message: 'the CRS MCP server stopped' } });
    });
  }

  async rpc(method: string, params?: object, ms = 30_000): Promise<any> {
    const id = ++this.id;
    const reply = new Promise<any>((res, rej) => {
      this.waiting.set(id, res);
      setTimeout(() => (this.waiting.delete(id), rej(new Error(`the CRS MCP server did not answer ${method} in time`))), ms).unref();
    });
    this.child.stdin!.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    const m = await reply;
    if (m.error) throw new Error(m.error.message);
    return m.result;
  }

  async init() {
    await this.rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'gurtos-box', version: '1' } });
    this.child.stdin!.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
    return this;
  }

  /** The text of a tool's answer. An isError answer throws, so the broker logs it as a failed call. */
  async tool(name: string, args: object): Promise<string> {
    const r = await this.rpc('tools/call', { name, arguments: args });
    const text = (r.content ?? []).map((c: { text?: string }) => c.text ?? '').join('\n');
    if (r.isError) throw new Error(text.slice(0, 300));
    return text;
  }

  stop() { this.child.kill(); }
}

let server: Promise<Mcp> | undefined;
let loginBroken = false;
/** One server per box process. Its login failure is never retried: repeated failed logins disable the CRS account. */
function mcp(user: string, pass: string): Promise<Mcp> {
  if (loginBroken) return Promise.reject(new Error('the CRS login failed earlier; not retrying. Fix the vault and restart the box.'));
  server ??= new Mcp({ CRS_USERNAME: user, CRS_PASSWORD: pass }).init().catch((e) => ((server = undefined), Promise.reject(e)));
  return server.then((s) => (s.exited ? ((server = undefined), mcp(user, pass)) : s));
}

/** SSNs and birth dates out of a raw record before it reaches the log. */
export function redact(text: string): string {
  return text
    .replace(/("(?:ssn|socialSecurityNumber|taxId|dob|dateOfBirth|birthDate)"\s*:\s*)"[^"]*"/gi, '$1"[redacted]"')
    .replace(/\b\d{3}-\d{2}-\d{4}\b|\b\d{9}\b/g, '[redacted]');
}

export const mcpTools: Tool[] = [
  {
    name: 'credit-desk.crs_docs',
    description: `CRS's own documentation, through CRS's MCP server: ${DOCS.join(', ')}. {guide: "get_product_guide", arguments: {product: "fraud_finder"}}. Read-only text.`,
    input: { type: 'object', properties: { guide: { type: 'string', enum: DOCS }, arguments: { type: 'object' } }, required: ['guide'] },
    secrets: ['CRS_USERNAME', 'CRS_PASSWORD'],
    hosts: [CRS_HOST],
    async run(input: { guide: string; arguments?: object }, ctx) {
      if (!DOCS.includes(input.guide)) throw new Error(`guide must be one of: ${DOCS.join(', ')}`);
      const s = await mcp(ctx.secret('CRS_USERNAME'), ctx.secret('CRS_PASSWORD'));
      return { guide: input.guide, text: (await s.tool(input.guide, input.arguments ?? {})).slice(0, MAX_TEXT) };
    },
  },
  {
    name: 'credit-desk.crs_lookup',
    description: "Re-open the raw CRS record behind a request id, through CRS's MCP server (debug_request). Only for a request id that a credit-desk.crs pull in this run returned. SSNs and birth dates are removed. A task has a few lookups.",
    input: { type: 'object', properties: { request_id: { type: 'string' } }, required: ['request_id'] },
    secrets: ['CRS_USERNAME', 'CRS_PASSWORD'],
    hosts: [CRS_HOST],
    async run(input: { request_id: string }, ctx) {
      const id = String(input.request_id ?? '');
      if (!/^[0-9a-f-]{32,40}$/i.test(id)) return { status: 'refused', why: 'that is not a CRS request id' };
      // Pulls by any seat of this run: the run is the unit that had a reason to pull.
      const run = runOf(ctx.task!.source);
      const all = toolUses(readLog(), new Set(ctx.box.tasks().filter((t) => runOf(t.source) === run).map((t) => t.id)));
      const mine = all.filter((u) => u.task === ctx.task!.id);
      const pull = all.find((u) => u.tool === 'credit-desk.crs' && u.ok && JSON.stringify(u.output).includes(`"request_id":"${id}"`));
      const subject = pull?.input.application_id ?? pull?.input.customer_id;
      if (!pull) {
        ctx.box.note({ kind: 'crs.refused', why: 'a request id this run did not pull', request_id: id, tool: 'credit-desk.crs_lookup' }, ctx.task!.id);
        return { status: 'refused', why: 'this run did not pull that request id. A lookup re-opens a record from a pull the desk made for a reason, for the same reason.' };
      }
      if (mine.filter((u) => u.tool === 'credit-desk.crs_lookup').length > LOOKUPS_PER_TASK) return { status: 'refused', why: `this task has used its ${LOOKUPS_PER_TASK} lookups` };
      const s = await mcp(ctx.secret('CRS_USERNAME'), ctx.secret('CRS_PASSWORD'));
      let text: string;
      try {
        text = await s.tool('debug_request', { requestId: id, product: 'credit_report' });
      } catch (e) {
        if (/^Authentication failed|Login failed/.test((e as Error).message)) loginBroken = true;
        throw e;
      }
      ctx.log(`CRS record ${id} re-opened for the pull on ${subject} (${pull.input.purpose})`);
      return { request_id: id, subject, purpose: `record-check of the ${pull.input.purpose} pull`, text: redact(text).slice(0, MAX_TEXT) };
    },
  },
];
