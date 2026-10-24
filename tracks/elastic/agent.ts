// The Elastic Agent Builder agent and its tools, as code: `install` creates or updates them through Kibana's
// Agent Builder API, so the agent in Kibana always matches this file. This is the admin side: it needs a key that can
// manage Kibana, which never lives on a box.
//   node tracks/elastic/agent.ts install            create or update the indexes, tools, workflow, alert rules, dashboard and agent
//   node tracks/elastic/agent.ts ask "question"     ask the agent, print its answer and the tools it used
//   node tracks/elastic/agent.ts keys <machine id>...   print the request bodies for the box keys and the people's keys
//   node tracks/elastic/agent.ts verify <log.jsonl> <machine id> [run]   check a copy of a box's log against Elastic, without trusting the box
// All of them read KIBANA_URL, ELASTIC_URL and ELASTIC_API_KEY from the environment. ask works with a person's own
// key and verify with a box's own key. Keys never go in the repo.
import { compareChains, first, localChain, remoteHashes } from './chain.ts';
import { INDEX, MAPPING, REQUESTS, REQUESTS_MAPPING } from './docs.ts';
import { client, type Es } from './es.ts';
import { installKibana, WORKFLOW_ID } from './kibana.ts';
import { askKey, boxKey, PEOPLE } from './keys.ts';

export const AGENT_ID = 'gurtos-log';

const days = { type: 'integer', description: 'How many days back to look. 7 for "this week", 1 for "today".', optional: true, defaultValue: 7 };
const run = { type: 'string', description: 'Whose log to read: "installed" (the real GurtOS boxes, the default) or a demo run id the user names.', optional: true, defaultValue: 'installed' };
const recent = `box.run == ?run AND DATE_DIFF("day", @timestamp, NOW()) < ?days`;
const esql = (id: string, description: string, query: string, params: object = { days, run }) => ({
  id,
  type: 'esql',
  description,
  tags: ['gurtos'],
  configuration: { query, params },
});
const split = `EVAL model_cents = CASE(event.type == "cost", cost_cents, 0.0), tool_cents = CASE(event.type == "tool.result", cost_cents, 0.0)`;

export const TOOLS = [
  esql(
    'box.changes',
    'Tasks that finished (done), were undone, or failed, newest first, with the box, who asked and the files each done task added, modified or deleted. Use for "what did my agents change".',
    `FROM ${INDEX}
| WHERE event.type == "task.state" AND task.state IN ("done", "undone", "failed") AND ${recent}
| KEEP @timestamp, box.name, box.machine, app, who.asked, task.id, task.title, task.state, files.count, files.added, files.modified, files.deleted, error, summary
| SORT @timestamp DESC
| LIMIT 100`,
  ),
  esql(
    'box.costs_by_app',
    'Spending per app (the app or track that started the task), in US dollars: total, model (Claude tokens) and tools (paid tool calls).',
    `FROM ${INDEX}
| WHERE cost_cents > 0 AND ${recent}
| ${split}
| STATS total_usd = ROUND(SUM(cost_cents) / 100.0, 2), model_usd = ROUND(SUM(model_cents) / 100.0, 2), tools_usd = ROUND(SUM(tool_cents) / 100.0, 2), tasks = COUNT_DISTINCT(task.id) BY app
| SORT total_usd DESC`,
  ),
  esql(
    'box.costs_by_task',
    'Spending per task, in US dollars, with the box, the person who asked and the paid tools it used. Most expensive first.',
    `FROM ${INDEX}
| WHERE cost_cents > 0 AND ${recent}
| ${split}
| STATS total_usd = ROUND(SUM(cost_cents) / 100.0, 2), model_usd = ROUND(SUM(model_cents) / 100.0, 2), tools_usd = ROUND(SUM(tool_cents) / 100.0, 2), paid_tools = VALUES(tool.name) BY app, task.title, task.id, box.name, asked_by = who.asked
| SORT total_usd DESC
| LIMIT 50`,
  ),
  esql(
    'box.failures',
    'Tasks that failed, newest first, with the box and the error it recorded. Find the task the user names here, then read its story with box.task_timeline.',
    `FROM ${INDEX}
| WHERE task.state == "failed" AND ${recent}
| KEEP @timestamp, box.name, box.machine, app, task.id, task.title, error
| SORT @timestamp DESC
| LIMIT 50`,
  ),
  esql(
    'box.task_timeline',
    'Everything one task did, in order: created, steps, tool calls and results, approvals, costs, blocked connections, state changes. Use it to explain why a task failed or what it did.',
    `FROM ${INDEX}
| WHERE task.id == ?task_id
| SORT event.seq ASC
| KEEP @timestamp, event.type, message, tool.name, tool.ok, tool.error, net.host, approval.question, approval.state, approval.person, cost_cents, error
| LIMIT 300`,
    { task_id: { type: 'string', description: 'The task id, like tlsr4bk9851. Get it from box.failures, box.changes or box.search_meaning.' } },
  ),
  esql(
    'box.blocked',
    'Connections the box refused, by host and by the task, app and box that tried, with how many times, when, and the hosts that task was allowed to reach.',
    `FROM ${INDEX}
| WHERE event.type == "net.blocked" AND ${recent}
| STATS attempts = COUNT(*), first_seen = MIN(@timestamp), last_seen = MAX(@timestamp), allowed_hosts = VALUES(task.hosts) BY net.host, app, task.title, task.id, box.name, box.machine
| SORT last_seen DESC
| LIMIT 100`,
  ),
  esql(
    'box.fleet',
    'One row per box: events, tasks, spending in US dollars, failed tasks, blocked connections and when the box last wrote to the log. Use it for "which box" and "is every box reporting".',
    `FROM ${INDEX}
| WHERE ${recent}
| EVAL spend = CASE(cost_cents > 0, cost_cents, 0.0)
| STATS events = COUNT(*), tasks = COUNT_DISTINCT(task.id), spent_usd = ROUND(SUM(spend) / 100.0, 2), failed_tasks = COUNT_DISTINCT(task.id) WHERE task.state == "failed", blocked = COUNT(*) WHERE event.type == "net.blocked", last_seen = MAX(@timestamp) BY box.name, box.machine
| SORT last_seen DESC`,
  ),
  esql(
    'box.by_requester',
    'Per person who asked for tasks (Business): tasks asked, US dollars spent, failed tasks and blocked connections, with the agent seat. Use it for "what did Sam ask the agents to do" and "who spends the most".',
    `FROM ${INDEX}
| WHERE who.asked IS NOT NULL AND ${recent}
| EVAL spend = CASE(cost_cents > 0, cost_cents, 0.0)
| STATS tasks = COUNT_DISTINCT(task.id), spent_usd = ROUND(SUM(spend) / 100.0, 2), failed_tasks = COUNT_DISTINCT(task.id) WHERE task.state == "failed", blocked = COUNT(*) WHERE event.type == "net.blocked", seats = VALUES(task.seat) BY person = who.asked
| SORT spent_usd DESC`,
  ),
  esql(
    'box.by_seat',
    'Per agent seat (Business, for example Credit analyst): tasks, US dollars spent, failures and blocked connections.',
    `FROM ${INDEX}
| WHERE task.seat IS NOT NULL AND ${recent}
| EVAL spend = CASE(cost_cents > 0, cost_cents, 0.0)
| STATS tasks = COUNT_DISTINCT(task.id), spent_usd = ROUND(SUM(spend) / 100.0, 2), failed_tasks = COUNT_DISTINCT(task.id) WHERE task.state == "failed", blocked = COUNT(*) WHERE event.type == "net.blocked" BY seat = task.seat
| SORT spent_usd DESC`,
  ),
  esql(
    'box.by_approver',
    'Per person who answered approvals: how many they approved and denied, and when they last answered. Use it for "who approved what" and "who is slow".',
    `FROM ${INDEX}
| WHERE event.type == "approval.answered" AND ${recent}
| STATS answered = COUNT(*), approved = COUNT(*) WHERE approval.approved == true, denied = COUNT(*) WHERE approval.approved == false, last_answer = MAX(@timestamp) BY person = approval.person, name = approval.\`by\`
| SORT answered DESC`,
  ),
  esql(
    'box.approvals',
    'Each approval answered, newest first: when, which box and task, who answered, from which screen or phone, and the sentence the log recorded. Use it to say who approved a specific thing.',
    `FROM ${INDEX}
| WHERE event.type == "approval.answered" AND ${recent}
| KEEP @timestamp, box.name, task.id, task.title, approval.id, approval.approved, approval.\`by\`, approval.person, approval.via, message
| SORT @timestamp DESC
| LIMIT 50`,
  ),
  esql(
    'box.verify_log',
    "Has any box's log been tampered with? One row per box: how many entries Elastic holds, entries missing from Elastic's own copy, how many integrity checks the box ran against that copy, how many failed, when it last checked and how many minutes ago. A failed check means the box's log no longer matches what Elastic stored; Elastic's copy is the one to trust.",
    `FROM ${INDEX}
| WHERE box.run == ?run
| EVAL is_check = CASE(note.kind == "integrity", 1, 0), failed = CASE(integrity.ok == false, 1, 0), check_time = CASE(note.kind == "integrity", @timestamp)
| STATS entries = COUNT(*), last_seq = MAX(event.seq), checks = SUM(is_check), failed_checks = SUM(failed), last_check = MAX(check_time) BY box.name, box.machine
| EVAL missing_from_elastic = last_seq - entries, minutes_since_check = DATE_DIFF("minute", last_check, NOW())
| KEEP box.name, box.machine, entries, missing_from_elastic, checks, failed_checks, last_check, minutes_since_check
| SORT failed_checks DESC`,
    { run },
  ),
  esql(
    'box.integrity_events',
    'The integrity checks that failed, newest first: which box, when, and how many entries were edited, missing, reordered or broken. note.data lists the entry numbers.',
    `FROM ${INDEX}
| WHERE integrity.ok == false AND box.run == ?run
| KEEP @timestamp, box.name, box.machine, integrity.checked, integrity.edited, integrity.missing, integrity.reordered, integrity.local_breaks, note.data, message
| SORT @timestamp DESC
| LIMIT 20`,
    { run },
  ),
  esql(
    'box.search_meaning',
    'Search by meaning, not by words: steps, tool calls, approvals, blocks and notes whose sentence means something like the question. Use it to find a task when the user describes it ("the one that tried to leak a key", "where Priya approved the release").',
    `FROM ${INDEX} METADATA _score
| WHERE box.run == ?run AND MATCH(semantic, ?q)
| SORT _score DESC
| KEEP @timestamp, box.name, task.id, task.title, event.type, message
| LIMIT 10`,
    { q: { type: 'string', description: 'What to look for, in plain words.' }, run },
  ),
  {
    id: 'box.request_undo',
    type: 'workflow',
    description:
      'Ask the owner of a box to undo a task (stop it and remove its file changes). This only leaves a request: the box asks its owner on their phone, and nothing happens unless they approve. Give the task id and the box machine id from box.failures, box.changes or box.blocked. Never say it was undone; say it was requested.',
    tags: ['gurtos'],
    configuration: { workflow_id: WORKFLOW_ID, wait_for_completion: true },
  },
  {
    id: 'box.search',
    type: 'index_search',
    description: "Free-text search over the box's action log, for anything the other box tools do not cover.",
    tags: ['gurtos'],
    configuration: { pattern: INDEX },
  },
];

const INSTRUCTIONS = `You answer questions about GurtOS boxes: always-on machines where AI agents do work. Each piece of work is a task: it runs as its own Linux user, on its own copy of the files, and reaches only the hosts it is allowed. Every action a box takes is one document in the Elasticsearch index ${INDEX}, one per line of the box's action log. Elastic keeps this copy with a key that can only add documents, so the box cannot rewrite it.

Fields: @timestamp; event.type (task.created, task.state, task.step, tool.call, tool.result, approval.asked, approval.answered, cost, net.blocked, note); message (one plain sentence about the event; read it first); task.id and task.title; task.seat (the agent seat, like "Credit analyst"); app (the app or track that started the task, such as shopper or credit-desk; "demo" is the box's own demo script, "schedule" a scheduled routine); who.asked (Business: the id of the person who asked for the task, like sam); who.approver; task.state on task.state events (running, waiting, done, failed, undone); files.added, files.modified, files.deleted on done events; cost_cents (US cents this event spent); tool.name; net.host (a host the box refused to connect to); task.hosts (the hosts a task may reach); approval.question, approval.state, approval.person (who answered), approval.to (who it was routed to); box.name and box.machine (which box; two boxes can share a name, never a machine); box.run ("installed" is a real box; anything else is a test run of the demo script).

People: Rosa Delgado (rosa, approver, Controller), Sam Chen (sam, requester, Sales), Priya Nair (priya, admin, IT), Owen Clarke (owen, auditor). You only see the documents the asking person's role allows. If something is missing, say what you cannot see rather than guessing.

How to answer:
- Use the box.* tools. Most take days: 7 for "this week", 1 for "today", 30 for "this month".
- The tools read the real boxes (run "installed") unless you pass run. Pass a demo run id only when the user names one.
- When more than one box shows up, say which box each item is from. box.fleet lists the boxes and whether each is still reporting.
- Changes: box.changes. A task that was undone later had all its file changes removed, and other tasks kept theirs; say so. A failed task's changes were never applied.
- Costs: box.costs_by_app and box.costs_by_task. Give US dollars with two decimals and split model and tool spending. Model spending is the list price of the Claude tokens a task used. Tool spending is test money (Stripe test mode, Solana devnet, the example tool), never a real payment; say so.
- People: box.by_requester for who asked for what, box.by_seat for agent seats, box.by_approver and box.approvals for who approved what.
- Why something failed: find the task the user means in box.failures (match the words in its title), then read box.task_timeline for its id. The recorded error is often only "worker exited with 1", so explain the cause from what happened just before: failed tool calls, denied approvals, blocked connections and the last step.
- Blocked: box.blocked. Say which host, which task and app tried, how many times, and which hosts that task was allowed.
- Finding a task from a description: box.search_meaning.
- Tampering: box.verify_log says, per box, whether its log still matches this copy. A failed check lists entry numbers in box.integrity_events. If a box has not checked for more than 30 minutes, say so: a silent box is not a clean one. Elastic's copy is the record to trust.
- Acting: you cannot undo, stop or change anything. box.request_undo only leaves a request. The box asks its owner on their phone through its normal approval, and nothing happens unless they approve. Offer it when a task looks like an attack or a runaway; say "I asked", never "I undid". Ask the user to confirm before you call it.
- Be short and specific: task titles, times in UTC, hosts, amounts. Never invent a fact; if the data does not say, say that.
- Format: put a blank line before every table and list, or the chat shows raw pipes.`;

export const AGENT = {
  id: AGENT_ID,
  name: 'GurtOS log',
  description: 'Answers questions about what the agents on your GurtOS boxes did: what they changed, what it cost, who asked and who approved, why a task failed, what was blocked, and whether the record was tampered with.',
  labels: ['gurtos', 'calhacks13'],
  avatar_color: '#2F6B4F',
  avatar_symbol: 'GL',
  configuration: {
    instructions: INSTRUCTIONS,
    enable_elastic_capabilities: false,
    tools: [{ tool_ids: [...TOOLS.map((t) => t.id), 'platform.core.execute_esql', 'platform.core.get_index_mapping'] }],
  },
};

const notFound = (e: unknown) => (e as { status?: number }).status === 404;

/** Make an index with its mapping, or add new fields to an existing one. Safe to repeat. */
async function ensureIndex(es: Es, index: string, mapping: object) {
  try {
    await es('PUT', `/${index}`, { mappings: mapping });
  } catch (e) {
    if (!/resource_already_exists/.test((e as Error).message)) throw e;
    await es('PUT', `/${index}/_mapping`, mapping);
  }
}

/** Create or update the indexes, every tool, the workflow, the alert rules, the dashboard and the agent. Safe to repeat. */
export async function install(kb: Es, es: Es) {
  await ensureIndex(es, INDEX, MAPPING);
  await ensureIndex(es, REQUESTS, REQUESTS_MAPPING);
  await installKibana(kb);
  for (const { id, type, ...rest } of TOOLS) {
    await kb('PUT', `/api/agent_builder/tools/${id}`, rest).catch((e) => (notFound(e) ? kb('POST', '/api/agent_builder/tools', { id, type, ...rest }) : Promise.reject(e)));
  }
  const { id, ...rest } = AGENT;
  await kb('PUT', `/api/agent_builder/agents/${id}`, rest).catch((e) => (notFound(e) ? kb('POST', '/api/agent_builder/agents', AGENT) : Promise.reject(e)));
}

/** Ask the agent one question. Returns its answer and the tools it called. */
export async function ask(kb: Es, input: string, conversation?: string) {
  const r = await kb<{ conversation_id?: string; response: { message: string }; steps?: { type: string; tool_id?: string }[] }>('POST', '/api/agent_builder/converse', { agent_id: AGENT_ID, input, ...(conversation ? { conversation_id: conversation } : {}) });
  return { answer: r.response.message, conversation: r.conversation_id, tools: (r.steps ?? []).flatMap((s) => (s.tool_id ? [s.tool_id] : [])) };
}

if (import.meta.main) {
  const { KIBANA_URL, ELASTIC_URL, ELASTIC_API_KEY } = process.env;
  const [cmd, ...words] = process.argv.slice(2);
  if (!KIBANA_URL || !ELASTIC_URL || !ELASTIC_API_KEY) throw new Error('set KIBANA_URL, ELASTIC_URL and ELASTIC_API_KEY');
  const kb = client(KIBANA_URL, ELASTIC_API_KEY);
  const es = client(ELASTIC_URL, ELASTIC_API_KEY);
  if (cmd === 'install') {
    await install(kb, es);
    console.log(`installed ${TOOLS.length} tools, the workflow, the alert rules, the dashboard and the agent: ${KIBANA_URL.replace(/\/$/, '')}/app/agent_builder/agents/${AGENT_ID}`);
  } else if (cmd === 'ask' && words.length) {
    const { answer, tools } = await ask(kb, words.join(' '));
    console.log(`${answer}\n\n(tools: ${tools.join(', ') || 'none'})`);
  } else if (cmd === 'keys') {
    // Request bodies for POST /_security/api_key, one per box and one per person. Make them as a person in Kibana, not with an API key.
    console.log(JSON.stringify({ box: words.map((m, i) => boxKey(m, `box${i + 1}-${m}`)), people: PEOPLE.map(askKey) }, null, 2));
  } else if (cmd === 'verify' && words.length >= 2) {
    // The box can lie about its own log. A copy of the file, taken any way you trust, cannot lie about itself.
    const [file, machine, runName = 'installed'] = words;
    const { hashes, breaks } = localChain(file);
    const v = compareChains(hashes, await remoteHashes(es, machine, runName), breaks);
    console.log(v.ok ? `OK: ${v.checked} entries match Elastic's copy${v.pending ? `, ${v.pending} not shipped yet` : ''}.` : `MISMATCH: edited ${first(v.edited) || 'none'}; missing ${first(v.missing) || 'none'}; reordered ${first(v.reordered) || 'none'}; broken links ${first(v.localBreaks) || 'none'}.`);
    process.exit(v.ok ? 0 : 1);
  } else {
    console.error('usage: node tracks/elastic/agent.ts install | ask "question" | keys <machine id>... | verify <log.jsonl> <machine id> [run]');
    process.exit(2);
  }
}
