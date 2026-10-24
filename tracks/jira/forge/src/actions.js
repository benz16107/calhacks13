// The GurtOS Rovo agent's actions, the "Run in GurtOS" automation action, and the trigger that starts a task
// when someone hands an issue to the agent. Every answer comes from what the box's routes returned, so the agent
// can only report what the box's log says. Who acts comes from Forge's context or the Jira event, never from a
// model's inputs (Rovo inputs are written by the model and can be made up).
import api, { route } from '@forge/api';
import { box, isAdmin, keysOf, myName, nameOf, query, rollbackIssues, startFrom, visible } from './box';

const DAY = 24 * 3600 * 1000;
const dollars = (c) => `$${((c ?? 0) / 100).toFixed(2)}`;
const iso = (v) => (v && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : undefined);

/** Rovo: what agents did. GET, so Rovo runs it without asking. */
export async function activity(payload) {
  const days = Number(payload.days) > 0 ? Math.min(Number(payload.days), 90) : 7;
  const since = iso(payload.since) ?? new Date(Date.now() - days * DAY).toISOString();
  const data = await box('GET', `/activity${query({ since, until: iso(payload.until), project: payload.project?.toUpperCase(), source: payload.source, q: payload.q, state: payload.state })}`);
  const tasks = (await visible(data.tasks)).slice(0, 40).map((t) => ({
    issue: t.issue, title: t.title, state: t.state, startedBy: t.source, cost: dollars(t.costCents),
    blockedHosts: t.blocked, filesChanged: t.changes, updatedAt: t.updatedAt,
  }));
  return {
    period: { since, until: iso(payload.until) ?? 'now' },
    agentsPaused: data.paused,
    totals: { ...data.totals, cost: dollars(data.totals.costCents) },
    byProject: data.byProject.map((p) => ({ ...p, cost: dollars(p.costCents) })),
    tasks,
    note: tasks.length ? 'Only tasks whose Jira issue you can see are listed. Roll back takes the issue keys.' : 'The box logged no tasks you can see for this filter.',
  };
}

/** Rovo: roll back the tasks behind some issues. DELETE, so Rovo asks the user to confirm first. */
export async function rollback(payload, context) {
  const keys = keysOf(payload.issueKeys);
  if (!keys.length) throw new Error('Name the issues to roll back, by key, such as BOX-12. Find them with the activity action first.');
  const results = await rollbackIssues(keys, context.accountId);
  return {
    results: results.map((r) => ({ issue: r.issue, title: r.title, rolledBack: r.ok === true, alreadyRolledBack: r.alreadyUndone === true, error: r.error, filesRestored: (r.changes ?? []).map((c) => `${c.path} (${c.change})`) })),
    note: 'This is what the box reported for each task. Report it as is; do not say a task was rolled back unless rolledBack is true.',
  };
}

/** Rovo: pause or resume every agent on the box. UPDATE, so Rovo asks first. Jira admins only. */
export async function pause(payload, context) {
  if (!(await isAdmin())) throw new Error('Only a Jira admin can pause or resume every agent.');
  const paused = payload.paused !== false && payload.paused !== 'false';
  const r = await box('POST', '/pause', { paused, by: await myName(), account: context.accountId });
  return { paused: r.paused, note: r.paused ? 'The box reports every agent paused.' : 'The box reports agents running again.' };
}

/** Automation: start a box task from the rule's issue, as the rule's connection user. Errors show in the rule's
 *  audit log, so they are returned rather than thrown. */
export async function runInGurtos(payload, context) {
  const key = keysOf(payload.issueKey)[0];
  if (!key) return { errors: [{ message: `No issue to run: got "${payload.issueKey ?? ''}".` }] };
  try {
    const me = await (await api.asUser().requestJira(route`/rest/api/3/myself`)).json();
    const r = await startFrom(key, api.asUser(), me.displayName, me.accountId ?? context.accountId);
    return { task: r.task?.id ?? '', state: r.task?.state ?? '' };
  } catch (e) {
    return { errors: [{ message: e.message }] };
  }
}

/** Product trigger: an issue was handed to the GurtOS agent. That is the assignee becoming the agent's account
 *  (Forge variable GURTOS_AGENT_ACCOUNT), or with no agent account set, the label gurtos-agent being added.
 *  Only the change itself counts, so later edits to the same issue don't start it again. */
export async function onIssueChange(event) {
  const agent = process.env.GURTOS_AGENT_ACCOUNT;
  const items = event.changelog?.items ?? [];
  // Jira sends both an assigned and an updated event for one assignment; look at only one of them.
  const handed = agent
    ? event.eventType === 'avi:jira:assigned:issue' && items.some((i) => i.field === 'assignee' && i.to === agent && i.from !== agent)
    : event.eventType === 'avi:jira:updated:issue' && items.some((i) => i.field === 'labels' && /(^|\s)gurtos-agent(\s|$)/.test(i.toString ?? '') && !/(^|\s)gurtos-agent(\s|$)/.test(i.fromString ?? ''));
  if (!handed || !event.issue?.key) return;
  try {
    const r = await startFrom(event.issue.key, api.asApp(), await nameOf(event.atlassianId), event.atlassianId);
    console.log(`${event.issue.key}: ${r.already ? 'already has' : 'started'} GurtOS task ${r.task?.id}`);
  } catch (e) {
    console.error(`${event.issue.key}: could not start a GurtOS task: ${e.message}`);
  }
}
