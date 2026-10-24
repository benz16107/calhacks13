// A stdio MCP server that Droid starts inside the task. It offers the task's broker tools, plus box_ask,
// and passes every call to the broker socket. It holds no secrets; the tools run in the core.
import { createHash } from 'node:crypto';
import readline from 'node:readline';
import { call } from '../client.ts';

const sock = process.env.BOX_SOCKET!;
// MCP tool names allow [a-zA-Z0-9_-]; box tools are '<track>.<verb>'.
const mcpName = (name: string) => name.replaceAll('.', '__');
const boxName = (name: string) => name.replaceAll('__', '.');
const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0, 12);
// Same tool and input again counts up, so a resumed session that repeats a call gets the logged result.
const seen = new Map<string, number>();

const ask = {
  name: 'box_ask',
  description: 'Ask the person who owns this box for an OK before doing something risky or costly. Returns approved or not.',
  inputSchema: { type: 'object', properties: { question: { type: 'string' } }, required: ['question'] },
};

async function handle(method: string, params: any) {
  switch (method) {
    case 'initialize':
      return { protocolVersion: params?.protocolVersion ?? '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'box', version: '1' } };
    case 'ping':
      return {};
    case 'tools/list': {
      const tools = await call<{ name: string; description: string; input: object }[]>(sock, 'GET', '/tools');
      return { tools: [ask, ...tools.map((t) => ({ name: mcpName(t.name), description: t.description, inputSchema: t.input }))] };
    }
    case 'tools/call': {
      const input = params.arguments ?? {};
      if (params.name === 'box_ask') {
        const r = await call(sock, 'POST', '/ask', { key: `mcp.ask.${hash(input.question)}`, question: String(input.question) });
        return { content: [{ type: 'text', text: r.approved ? 'approved' : 'not approved' }] };
      }
      const tool = boxName(params.name);
      const id = `${tool}.${hash(input)}`;
      seen.set(id, (seen.get(id) ?? 0) + 1);
      const r = await call(sock, 'POST', '/call', { key: `mcp.${id}.${seen.get(id)}`, tool, input });
      return { content: [{ type: 'text', text: JSON.stringify(r.ok ? r.output : r.error) }], isError: !r.ok };
    }
  }
  throw Object.assign(new Error(`unknown method ${method}`), { code: -32601 });
}

const send = (msg: object) => process.stdout.write(JSON.stringify({ jsonrpc: '2.0', ...msg }) + '\n');
for await (const line of readline.createInterface({ input: process.stdin })) {
  if (!line.trim()) continue;
  const msg = JSON.parse(line);
  if (msg.id === undefined) continue; // notifications need no answer
  handle(msg.method, msg.params).then(
    (result) => send({ id: msg.id, result }),
    (e) => send({ id: msg.id, error: { code: e.code ?? -32000, message: e.message } }),
  );
}
