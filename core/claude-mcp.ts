// The GurtOS MCP server for Claude Code and Claude Desktop: Claude on your own computer starts and watches tasks on a
// box, answers its approvals, and undoes or keeps its work. It speaks MCP over stdio and calls the box's API with a
// paired device's token, so it goes through the same approvals, budgets and log as a phone, and never sees a vault key.
//   BOX_URL    the box: https://<name>.box.gurtos.com, or http://127.0.0.1:7700 on the box itself
//   BOX_TOKEN  a paired device's token (pair a device named "Claude" from the box's screen); not needed on the box
// claude mcp add gurtos --env BOX_URL=https://<name>.box.gurtos.com --env BOX_TOKEN=<token> -- node <repo>/core/claude-mcp.ts
import readline from 'node:readline';

const URL_ = (process.env.BOX_URL ?? 'http://127.0.0.1:7700').replace(/\/$/, '');
const TOKEN = process.env.BOX_TOKEN ?? '';

async function api(method: string, path: string, body?: unknown) {
  const r = await fetch(`${URL_}/api${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(TOKEN ? { authorization: `Bearer ${TOKEN}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await r.json().catch(() => undefined);
  if (!r.ok) throw new Error(data?.error ?? `HTTP ${r.status}`);
  return data;
}

const str = { type: 'string' };
const tools: { name: string; description: string; inputSchema: object; run: (a: any) => Promise<unknown> }[] = [
  {
    name: 'box_start_task',
    description: 'Start a task on the box: an agent works on it in its own copy of the files, with its own budget and network.',
    inputSchema: { type: 'object', properties: { title: str, prompt: str, workspace: str, budgetCents: { type: 'number' }, hosts: { type: 'array', items: str } }, required: ['title', 'prompt'] },
    run: (a) => api('POST', '/tasks', a),
  },
  {
    name: 'box_list_tasks',
    description: 'List the tasks on the box with their state, step, cost and budget.',
    inputSchema: { type: 'object', properties: { state: str } },
    run: async (a) =>
      ((await api('GET', '/tasks')) as any[])
        .filter((t) => !a.state || t.state === a.state)
        .map(({ id, title, state, step, costCents, budgetCents, workspace, source }) => ({ id, title, state, step, costCents, budgetCents, workspace, source })),
  },
  {
    name: 'box_task_log',
    description: "Read one task's action log: every step, tool call, network refusal and approval, in order.",
    inputSchema: { type: 'object', properties: { id: str }, required: ['id'] },
    run: (a) => api('GET', `/tasks/${encodeURIComponent(a.id)}`),
  },
  {
    name: 'box_task_diff',
    description: 'See what a task changed in its copy of the files.',
    inputSchema: { type: 'object', properties: { id: str }, required: ['id'] },
    run: (a) => api('GET', `/tasks/${encodeURIComponent(a.id)}/diff`),
  },
  {
    name: 'box_pending_approvals',
    description: 'List the questions tasks are waiting on: spends over budget, risky steps, an agent asking for an OK.',
    inputSchema: { type: 'object', properties: {} },
    run: () => api('GET', '/approvals?state=pending'),
  },
  {
    name: 'box_answer_approval',
    description: "Approve or deny a waiting question. Only do this when the person you're working with has said which.",
    inputSchema: { type: 'object', properties: { id: str, approved: { type: 'boolean' } }, required: ['id', 'approved'] },
    run: (a) => api('POST', `/approvals/${encodeURIComponent(a.id)}`, { approved: a.approved === true }),
  },
  {
    name: 'box_undo_task',
    description: "Undo one task: its changes are gone, every other task's stay.",
    inputSchema: { type: 'object', properties: { id: str }, required: ['id'] },
    run: (a) => api('POST', `/tasks/${encodeURIComponent(a.id)}/undo`),
  },
  {
    name: 'box_keep_task',
    description: "GurtOS Personal: copy a finished task's changes into the owner's real folder. Needs an owner-paired device.",
    inputSchema: { type: 'object', properties: { id: str }, required: ['id'] },
    run: (a) => api('POST', `/tasks/${encodeURIComponent(a.id)}/keep`),
  },
];

async function handle(method: string, params: any) {
  switch (method) {
    case 'initialize':
      return { protocolVersion: params?.protocolVersion ?? '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'gurtos', version: '1' } };
    case 'ping':
      return {};
    case 'tools/list':
      return { tools: tools.map(({ run, ...t }) => t) };
    case 'tools/call': {
      const tool = tools.find((t) => t.name === params?.name);
      if (!tool) throw Object.assign(new Error(`unknown tool ${params?.name}`), { code: -32602 });
      try {
        return { content: [{ type: 'text', text: JSON.stringify(await tool.run(params.arguments ?? {}), null, 1) }] };
      } catch (e) {
        return { content: [{ type: 'text', text: (e as Error).message }], isError: true };
      }
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
