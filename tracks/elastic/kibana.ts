// The Kibana side of the track, as code: the workflow behind the agent's "ask to undo" tool, the alert rules that watch
// the log for attacks, the connector those rules write requests through, and the dashboard. `install` in agent.ts
// creates or updates every one of them, so Kibana always matches this folder.
import type { Es } from './es.ts';
import { INDEX, REQUESTS } from './docs.ts';

export const CONNECTOR_ID = 'gurtos-requests';
export const WORKFLOW_ID = 'gurtos-undo-request';
export const DASHBOARD_ID = 'gurtos-overview';

const status = (e: unknown) => (e as { status?: number }).status;

// ---------- the agent's way to ask: a workflow that leaves a request ----------

/**
 * Elastic's agent never acts on a box. This workflow only writes a row to box-requests. The box reads its own rows,
 * turns each into a task whose only step is to ask, and the owner answers through the box's one approval path.
 */
export const WORKFLOW_YAML = `name: ${WORKFLOW_ID}
description: Ask the owner of a GurtOS box to undo a task. This only leaves a request. The box asks its owner, and nothing happens until they approve.
enabled: true
triggers:
  - type: manual
inputs:
  - name: task
    type: string
    required: true
  - name: box_machine
    type: string
    required: true
  - name: reason
    type: string
    required: true
steps:
  - name: leave_request
    type: elasticsearch.index
    with:
      index: ${REQUESTS}
      op_type: create
      id: "undo-{{ inputs.task }}-{{ execution.id }}"
      document:
        "@timestamp": "{{ \\"now\\" | date: \\"%Y-%m-%dT%H:%M:%SZ\\" }}"
        action: undo
        task: "{{ inputs.task }}"
        reason: "{{ inputs.reason }}"
        by: agent
        box:
          machine: "{{ inputs.box_machine }}"
`;

// ---------- alert rules: attacks on the agents, seen in the log ----------

const WINDOW = 'NOW() - 15 minutes';
const row = (f: string) => `{{context.hits.0._source.${f}}}`;

/** One ES|QL rule per attack. Each matching row is its own alert and leaves one request for the box that owns the task. */
const RULES = [
  {
    id: 'gurtos-injected-page',
    name: 'GurtOS: a task read a page, then tried to reach somewhere else',
    esql: `FROM ${INDEX} | WHERE event.type == "net.blocked" AND task.hosts IS NOT NULL AND @timestamp > ${WINDOW} | STATS attempts = COUNT(*), hosts = VALUES(net.host) BY task_id = task.id, machine = box.machine | LIMIT 20`,
    reason: `${row('attempts')} blocked connection(s) to ${row('hosts')} from a task that was allowed only its own hosts. A page may have told it to send data out.`,
  },
  {
    id: 'gurtos-secret-theft',
    name: 'GurtOS: a task went for a secret',
    esql: `FROM ${INDEX} | WHERE event.type IN ("task.step", "tool.call") AND @timestamp > ${WINDOW} AND (message LIKE "*vault.env*" OR message LIKE "*/etc/box*" OR message LIKE "*API_KEY*" OR message LIKE "*id_rsa*" OR message LIKE "*printenv*") | STATS attempts = COUNT(*) BY task_id = task.id, machine = box.machine | LIMIT 20`,
    reason: `${row('attempts')} step(s) that reach for the vault, a key or the environment. Agents never see secrets.`,
  },
  {
    id: 'gurtos-spending-spike',
    name: 'GurtOS: a task is spending fast',
    esql: `FROM ${INDEX} | WHERE cost_cents > 0 AND @timestamp > ${WINDOW} | STATS cents = SUM(cost_cents) BY task_id = task.id, machine = box.machine | WHERE cents >= 500 | LIMIT 20`,
    reason: `${row('cents')} cents spent in 15 minutes by one task.`,
  },
  {
    id: 'gurtos-new-destination',
    name: 'GurtOS: a destination no agent has tried before',
    esql: `FROM ${INDEX} | WHERE event.type == "net.blocked" | STATS first_seen = MIN(@timestamp), attempts = COUNT(*), task_id = MAX(task.id), machine = MAX(box.machine) BY host = net.domain | WHERE first_seen > ${WINDOW} | LIMIT 20`,
    reason: `First time any box has blocked a connection to ${row('host')}.`,
  },
];

const ruleBody = (r: (typeof RULES)[number]) => ({
  name: r.name,
  tags: ['gurtos'],
  schedule: { interval: '1m' },
  params: { searchType: 'esqlQuery', esqlQuery: { esql: r.esql }, timeField: '@timestamp', threshold: [0], thresholdComparator: '>', size: 20, timeWindowSize: 30, timeWindowUnit: 'd', groupBy: 'row', excludeHitsFromPreviousRun: false, sourceFields: [] },
  actions: [
    {
      group: 'query matched',
      id: CONNECTOR_ID,
      // Once when a row first matches, again only after it stops matching and returns. Not every minute.
      frequency: { summary: false, notify_when: 'onActionGroupChange', throttle: null },
      params: { documents: [{ action: 'alert', rule: r.id, task: row('task_id'), box: { machine: row('machine') }, reason: r.reason, by: 'rule' }] },
    },
  ],
});

// ---------- the dashboard ----------

const xy = (title: string, esql: string, type: 'bar' | 'line', x: string, y: string, breakdown?: string, x0 = 0, y0 = 0) => ({
  type: 'vis',
  grid: { x: x0, y: y0, w: 24, h: 13 },
  config: { type: 'xy', title, layers: [{ type, data_source: { type: 'esql', query: esql }, x: { column: x }, y: [{ column: y }], ...(breakdown ? { breakdown_by: { column: breakdown } } : {}) }] },
});
const metric = (title: string, esql: string, column: string, x0: number) => ({
  type: 'vis',
  grid: { x: x0, y: 0, w: 12, h: 6 },
  config: { type: 'metric', title, data_source: { type: 'esql', query: esql }, metrics: [{ type: 'primary', column }] },
});

const RUN = `box.run == "installed"`;
export const DASHBOARD = {
  title: 'GurtOS: cost, blocks and approvals',
  time_range: { from: 'now-7d', to: 'now' },
  description: 'What the agents on every GurtOS box spent, what the box blocked and who approved what, from the log Elastic keeps.',
  panels: [
    metric('Spent this week (US$, test money)', `FROM ${INDEX} | WHERE ${RUN} AND cost_cents > 0 AND @timestamp > NOW() - 7 days | STATS usd = ROUND(SUM(cost_cents) / 100.0, 2)`, 'usd', 0),
    metric('Blocked connections this week', `FROM ${INDEX} | WHERE ${RUN} AND event.type == "net.blocked" AND @timestamp > NOW() - 7 days | STATS blocked = COUNT(*)`, 'blocked', 12),
    metric('Approvals answered this week', `FROM ${INDEX} | WHERE ${RUN} AND event.type == "approval.answered" AND @timestamp > NOW() - 7 days | STATS answered = COUNT(*)`, 'answered', 24),
    metric('Log checks that failed', `FROM ${INDEX} | WHERE ${RUN} AND integrity.ok == false | STATS failed = COUNT(*)`, 'failed', 36),
    xy('Spending by app (US$ per hour)', `FROM ${INDEX} | WHERE ${RUN} AND cost_cents > 0 | STATS usd = ROUND(SUM(cost_cents) / 100.0, 2) BY hour = BUCKET(@timestamp, 1 hour), app`, 'bar', 'hour', 'usd', 'app', 0, 6),
    xy('Blocked connections by host', `FROM ${INDEX} | WHERE ${RUN} AND event.type == "net.blocked" | STATS blocked = COUNT(*) BY hour = BUCKET(@timestamp, 1 hour), host = net.domain`, 'bar', 'hour', 'blocked', 'host', 24, 6),
    xy('Approvals asked and answered', `FROM ${INDEX} | WHERE ${RUN} AND event.type IN ("approval.asked", "approval.answered") | STATS n = COUNT(*) BY hour = BUCKET(@timestamp, 1 hour), kind = event.type`, 'bar', 'hour', 'n', 'kind', 0, 19),
    xy('Spending by box (US$ per hour)', `FROM ${INDEX} | WHERE ${RUN} AND cost_cents > 0 | STATS usd = ROUND(SUM(cost_cents) / 100.0, 2) BY hour = BUCKET(@timestamp, 1 hour), box = box.name`, 'line', 'hour', 'usd', 'box', 24, 19),
  ],
};

// ---------- install ----------

/** Create or update everything Kibana holds for this track. Safe to repeat. */
export async function installKibana(kb: Es) {
  await kb('POST', `/api/actions/connector/${CONNECTOR_ID}`, { name: 'GurtOS requests', connector_type_id: '.index', config: { index: REQUESTS, refresh: true, executionTimeField: '@timestamp' } }).catch((e) =>
    status(e) === 409 || status(e) === 400 ? kb('PUT', `/api/actions/connector/${CONNECTOR_ID}`, { name: 'GurtOS requests', config: { index: REQUESTS, refresh: true, executionTimeField: '@timestamp' } }) : Promise.reject(e),
  );
  await kb('PUT', `/api/workflows/workflow/${WORKFLOW_ID}`, { yaml: WORKFLOW_YAML }).catch((e) => (status(e) === 404 ? kb('POST', '/api/workflows', { workflows: [{ id: WORKFLOW_ID, yaml: WORKFLOW_YAML }] }) : Promise.reject(e)));
  for (const r of RULES) {
    const body = ruleBody(r);
    await kb('POST', `/api/alerting/rule/${r.id}`, { ...body, rule_type_id: '.es-query', consumer: 'stackAlerts' }).catch((e) => (status(e) === 409 ? kb('PUT', `/api/alerting/rule/${r.id}`, body) : Promise.reject(e)));
  }
  await kb('PUT', `/api/dashboards/${DASHBOARD_ID}`, DASHBOARD).catch((e) => (status(e) === 404 ? kb('POST', '/api/dashboards', { ...DASHBOARD, id: DASHBOARD_ID }) : Promise.reject(e)));
}

export const RULE_IDS = RULES.map((r) => r.id);
