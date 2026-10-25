// The GurtOS MCP server for Claude Code and Claude Desktop: Claude on your own computer starts and watches tasks on a
// box, answers its approvals, and undoes or keeps its work. It speaks MCP over stdio and calls the box's API with a
// paired device's token, so it goes through the same approvals, budgets and log as a phone, and never sees a vault key.
//   BOX_URL    the box: https://<name>.box.gurtos.com, or http://127.0.0.1:7700 on the box itself
//   BOX_TOKEN  a paired device's token (pair a device named "Claude" from the box's screen); not needed on the box
// claude mcp add gurtos --env BOX_URL=https://<name>.box.gurtos.com --env BOX_TOKEN=<token> -- node <repo>/core/claude-mcp.ts
// Setup mode, for a new computer (AGENT-SETUP.md): BOX_SETUP_CODE=<the code on its screen> instead of BOX_TOKEN.
// The code is traded for a setup token on first use, and the setup tools appear.
import readline from 'node:readline';
import { connect, steps, type Api } from './setup-client.ts';

const URL_ = (process.env.BOX_URL ?? 'http://127.0.0.1:7700').replace(/\/$/, '');
let TOKEN = process.env.BOX_TOKEN ?? '';
const SETUP_CODE = !TOKEN ? (process.env.BOX_SETUP_CODE ?? '') : '';
let connecting: Promise<void> | undefined;
const ready = () => (SETUP_CODE && !TOKEN ? (connecting ??= connect(URL_, SETUP_CODE, process.env.BOX_SETUP_NAME ?? 'Claude (setup)').then((r) => void (TOKEN = r.token))) : Promise.resolve());

async function api(method: string, path: string, body?: unknown) {
  await ready();
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

const setupApi: Api = api;
if (SETUP_CODE) {
  const obj = (properties: object, required: string[] = []) => ({ type: 'object', properties, required });
  tools.push(
    { name: 'setup_status', description: "The new computer's setup: which steps are done, whether a model key is set, and the setup channel.", inputSchema: obj({}), run: () => steps.status(setupApi) },
    { name: 'setup_doctor', description: 'What is still missing before setup can finish (model key, owner, a paired phone). Clean means ready.', inputSchema: obj({}), run: () => steps.doctor(setupApi) },
    { name: 'setup_set_key', description: "Write a key into the computer's vault (ANTHROPIC_API_KEY or FACTORY_API_KEY first). It is checked, never shown again and never logged. Ask the owner for it; if they would rather not share it with you, they can paste it on the computer's screen instead.", inputSchema: obj({ name: str, value: str }, ['name', 'value']), run: (a) => steps.setKey(setupApi, a.name, a.value) },
    { name: 'setup_keys', description: 'The names of the keys already in the vault (never their values).', inputSchema: obj({}), run: () => steps.keys(setupApi) },
    { name: 'setup_owner', description: 'GurtOS Personal: the account that owns this computer.', inputSchema: obj({ user: str }, ['user']), run: (a) => steps.owner(setupApi, a.user) },
    { name: 'setup_folders', description: 'GurtOS Personal: the folders agents may be handed (absolute paths).', inputSchema: obj({ folders: { type: 'array', items: str } }, ['folders']), run: (a) => steps.folders(setupApi, a.folders) },
    { name: 'setup_settings', description: 'Change settings, for example {"approvalThresholdCents":500,"defaultBudgetCents":100}. The computer checks each one.', inputSchema: obj({ patch: { type: 'object' } }, ['patch']), run: (a) => steps.settings(setupApi, a.patch) },
    { name: 'setup_apps', description: 'Every app and whether it is on.', inputSchema: obj({}), run: () => steps.apps(setupApi) },
    { name: 'setup_app', description: 'Turn an app on or off.', inputSchema: obj({ id: str, on: { type: 'boolean' } }, ['id', 'on']), run: (a) => steps.app(setupApi, a.id, a.on === true) },
    { name: 'setup_remote', description: 'Turn on its https address at <name>.box.gurtos.com.', inputSchema: obj({ name: str }), run: (a) => steps.remote(setupApi, a.name) },
    { name: 'setup_pair_phone', description: "A link and code for the owner's phone. Give the link to the owner: scanning or opening it pairs their phone as the owner's.", inputSchema: obj({}), run: () => steps.pair(setupApi) },
    { name: 'setup_finish', description: 'Finish setup. This ends your setup access, so run setup_doctor first and finish only when it is clean.', inputSchema: obj({}), run: () => steps.finish(setupApi) },
  );
}

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
