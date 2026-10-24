// The Elastic Agent Builder agent and its tools, as code: `install` creates or updates them through Kibana's
// Agent Builder API, so the agent in Kibana always matches this file.
//   node tracks/elastic/agent.ts install            create or update the tools and the agent
//   node tracks/elastic/agent.ts ask "question"     ask the agent, print its answer and the tools it used
// Both read KIBANA_URL, ELASTIC_URL and ELASTIC_API_KEY from the environment. On a box they live in the vault;
// run by hand, export them first. They never go in the repo.
import { client, ensureIndex, INDEX } from './track.ts';

export const AGENT_ID = 'gurtos-log';

const days = { type: 'integer', description: 'How many days back to look. 7 for "this week", 1 for "today".', optional: true, defaultValue: 7 };
const run = { type: 'string', description: 'Whose log to read: "installed" (the real GurtOS boxes, the default) or a demo run id the user names.', optional: true, defaultValue: 'installed' };
const recent = `box.run == ?run AND DATE_DIFF("day", @timestamp, NOW()) < ?days`;
const esql = (id: string, description: string, query: string, params: object = { days, run }) => ({
  id,
  type: 'esql',
  description,
  tags: ['box'],
  configuration: { query, params },
});

export const TOOLS = [
  esql(
    'box.changes',
    'Tasks that finished (done), were undone, or failed, newest first, with the files each done task added, modified or deleted. Use for "what did my agents change".',
    `FROM ${INDEX}
| WHERE event.type == "task.state" AND task.state IN ("done", "undone", "failed") AND ${recent}
| KEEP @timestamp, box.name, box.machine, app, task.id, task.title, task.state, files.count, files.added, files.modified, files.deleted, error, summary
| SORT @timestamp DESC
| LIMIT 100`,
  ),
  esql(
    'box.costs_by_app',
    'Spending per app (the app or track that started the task), in US dollars: total, model (Claude tokens) and tools (paid tool calls).',
    `FROM ${INDEX}
| WHERE cost_cents > 0 AND ${recent}
| EVAL model_cents = CASE(event.type == "cost", cost_cents, 0.0), tool_cents = CASE(event.type == "tool.result", cost_cents, 0.0)
| STATS total_usd = ROUND(SUM(cost_cents) / 100.0, 2), model_usd = ROUND(SUM(model_cents) / 100.0, 2), tools_usd = ROUND(SUM(tool_cents) / 100.0, 2), tasks = COUNT_DISTINCT(task.id) BY app
| SORT total_usd DESC`,
  ),
  esql(
    'box.costs_by_task',
    'Spending per task, in US dollars, with the paid tools it used. Most expensive first.',
    `FROM ${INDEX}
| WHERE cost_cents > 0 AND ${recent}
| EVAL model_cents = CASE(event.type == "cost", cost_cents, 0.0), tool_cents = CASE(event.type == "tool.result", cost_cents, 0.0)
| STATS total_usd = ROUND(SUM(cost_cents) / 100.0, 2), model_usd = ROUND(SUM(model_cents) / 100.0, 2), tools_usd = ROUND(SUM(tool_cents) / 100.0, 2), paid_tools = VALUES(tool.name) BY app, task.title, task.id
| SORT total_usd DESC
| LIMIT 50`,
  ),
  esql(
    'box.failures',
    'Tasks that failed, newest first, with the error the box recorded. Find the task the user names here, then read its story with box.task_timeline.',
    `FROM ${INDEX}
| WHERE task.state == "failed" AND ${recent}
| KEEP @timestamp, box.name, box.machine, app, task.id, task.title, error
| SORT @timestamp DESC
| LIMIT 50`,
  ),
  esql(
    'box.task_timeline',
    "Everything one task did, in order: created, steps, tool calls and results, approvals, costs, blocked connections, state changes. Use it to explain why a task failed or what it did.",
    `FROM ${INDEX}
| WHERE task.id == ?task_id
| SORT event.seq ASC
| KEEP @timestamp, event.type, message, tool.name, tool.ok, tool.error, net.host, approval.question, approval.state, cost_cents, error
| LIMIT 300`,
    { task_id: { type: 'string', description: 'The task id, like tlsr4bk9851. Get it from box.failures, box.changes or box.search.' } },
  ),
  esql(
    'box.blocked',
    'Connections the box refused, by host and by the task and app that tried, with how many times, when, and the hosts that task was allowed to reach.',
    `FROM ${INDEX}
| WHERE event.type == "net.blocked" AND ${recent}
| STATS attempts = COUNT(*), first_seen = MIN(@timestamp), last_seen = MAX(@timestamp), allowed_hosts = VALUES(task.hosts) BY net.host, app, task.title, task.id
| SORT last_seen DESC
| LIMIT 100`,
  ),
  {
    id: 'box.search',
    type: 'index_search',
    description: "Free-text search over the box's action log, for anything the other box tools do not cover, such as finding a task by a word in its title or steps.",
    tags: ['box'],
    configuration: { pattern: INDEX },
  },
];

const INSTRUCTIONS = `You answer questions about GurtOS boxes: always-on machines where AI agents do work. Each piece of work is a task: it runs as its own Linux user, on its own copy of the files, and reaches only the hosts it is allowed. Every action a box takes is one document in the Elasticsearch index ${INDEX}, one per line of the box's action log.

Fields: @timestamp; event.type (task.created, task.state, task.step, tool.call, tool.result, approval.asked, approval.answered, cost, net.blocked, note); message (one plain sentence about the event; read it first); task.id and task.title; app (the app or track that started the task, such as shopper or credit-desk; "demo" is the box's own demo script, "schedule" a scheduled routine); task.state on task.state events (running, waiting, done, failed, undone); files.added, files.modified, files.deleted on done events; cost_cents (US cents this event spent); tool.name; net.host (a host the box refused to connect to); task.hosts (the hosts a task may reach); approval.question and approval.state; box.name and box.machine (which box; two boxes can share a name, never a machine); box.run ("installed" is a real box; anything else is a test run of the demo script).

How to answer:
- Use the box.* tools. Most take days: 7 for "this week", 1 for "today", 30 for "this month".
- The tools read the real boxes (run "installed") unless you pass run. Pass a demo run id only when the user names one. If you use box.search or write ES|QL yourself, keep to box.run == "installed" the same way.
- When more than one box shows up, say which box each item is from.
- Changes: box.changes. A task that was undone later had all its file changes removed, and other tasks kept theirs; say so. A failed task's changes were never applied.
- Costs: box.costs_by_app and box.costs_by_task. Give US dollars with two decimals and split model and tool spending. Model spending is the list price of the Claude tokens a task used. Tool spending is test money (Stripe test mode, Solana devnet, the example tool), never a real payment; say so.
- Why something failed: find the task the user means in box.failures (match the words in its title), then read box.task_timeline for its id. The recorded error is often only "worker exited with 1", so explain the cause from what happened just before: failed tool calls, denied approvals, blocked connections and the last step.
- Blocked: box.blocked. Say which host, which task and app tried, how many times, and which hosts that task was allowed.
- Be short and specific: task titles, times in UTC, hosts, amounts. Never invent a fact; if the data does not say, say that.
- Format: put a blank line before every table and list, or the chat shows raw pipes.`;

export const AGENT = {
  id: AGENT_ID,
  name: 'GurtOS log',
  description: 'Answers questions about what the agents on your GurtOS boxes did: what they changed, what it cost, why a task failed, and what the box blocked.',
  labels: ['gurtos', 'calhacks13'],
  avatar_color: '#2F6B4F',
  avatar_symbol: 'GL',
  configuration: {
    instructions: INSTRUCTIONS,
    enable_elastic_capabilities: false,
    tools: [{ tool_ids: [...TOOLS.map((t) => t.id), 'platform.core.execute_esql', 'platform.core.generate_esql', 'platform.core.get_index_mapping'] }],
  },
};

type Kb = ReturnType<typeof client>;
const notFound = (e: unknown) => (e as { status?: number }).status === 404;

/** Create or update the index, every tool and the agent. Safe to repeat. */
export async function install(kb: Kb, es: Kb) {
  await ensureIndex(es);
  for (const { id, type, ...rest } of TOOLS) {
    await kb('PUT', `/api/agent_builder/tools/${id}`, rest).catch((e) => (notFound(e) ? kb('POST', '/api/agent_builder/tools', { id, type, ...rest }) : Promise.reject(e)));
  }
  const { id, ...rest } = AGENT;
  await kb('PUT', `/api/agent_builder/agents/${id}`, rest).catch((e) => (notFound(e) ? kb('POST', '/api/agent_builder/agents', AGENT) : Promise.reject(e)));
}

/** Ask the agent one question. Returns its answer and the tools it called. */
export async function ask(kb: Kb, input: string) {
  const r = await kb<{ response: { message: string }; steps?: { type: string; tool_id?: string }[] }>('POST', '/api/agent_builder/converse', { agent_id: AGENT_ID, input });
  return { answer: r.response.message, tools: (r.steps ?? []).flatMap((s) => (s.tool_id ? [s.tool_id] : [])) };
}

if (import.meta.main) {
  const { KIBANA_URL, ELASTIC_URL, ELASTIC_API_KEY } = process.env;
  if (!KIBANA_URL || !ELASTIC_URL || !ELASTIC_API_KEY) throw new Error('set KIBANA_URL, ELASTIC_URL and ELASTIC_API_KEY');
  const kb = client(KIBANA_URL, ELASTIC_API_KEY);
  const [cmd, ...words] = process.argv.slice(2);
  if (cmd === 'install') {
    await install(kb, client(ELASTIC_URL, ELASTIC_API_KEY));
    console.log(`installed ${TOOLS.length} tools and the agent: ${KIBANA_URL.replace(/\/$/, '')}/app/agent_builder/agents/${AGENT_ID}`);
  } else if (cmd === 'ask' && words.length) {
    const { answer, tools } = await ask(kb, words.join(' '));
    console.log(`${answer}\n\n(tools: ${tools.join(', ') || 'none'})`);
  } else {
    console.error('usage: node tracks/elastic/agent.ts install | ask "question"');
    process.exit(2);
  }
}
