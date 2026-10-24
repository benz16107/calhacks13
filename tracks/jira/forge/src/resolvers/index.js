// The back end of every screen in Jira: the issue panel, the GurtOS agent tasks page, the bulk roll back from the
// issue list and the dashboard gadget. It runs in Atlassian's cloud. It never trusts the browser for who is
// acting (Forge's context gives the account) or for which task an issue holds (Jira's box.task property does).
import Resolver from '@forge/resolver';
import api, { route } from '@forge/api';
import { box, isAdmin, issuesWithTasks, keysOf, keysOfJql, mayEdit, myName, query, rollbackIssues, visible } from '../box';

const resolver = new Resolver();
const DAY = 24 * 3600 * 1000;

/** The box task behind this issue, from the property the box wrote. */
async function taskOf(context) {
  const key = context.extension.issue.key;
  const r = await api.asUser().requestJira(route`/rest/api/3/issue/${key}/properties/box.task`);
  if (r.status === 404) return undefined;
  if (!r.ok) throw new Error(`Jira answered ${r.status} reading this issue`);
  return { key, id: (await r.json()).value.id };
}

// ---------- the issue panel ----------

resolver.define('load', async ({ context }) => {
  const t = await taskOf(context);
  if (!t) return { none: true };
  const [data, canAct] = await Promise.all([box('GET', `/task${query({ id: t.id, account: context.accountId })}`), mayEdit(t.key)]);
  return { ...data, canAct };
});

resolver.define('answer', async ({ payload, context }) => {
  const t = await taskOf(context);
  if (!t || !(await mayEdit(t.key))) throw new Error('You need permission to edit this issue to answer for its task.');
  return box('POST', '/answer', { task: t.id, approval: String(payload.approval), approved: payload.approved === true, by: await myName(), account: context.accountId });
});

resolver.define('rollback', async ({ context }) => {
  const t = await taskOf(context);
  if (!t || !(await mayEdit(t.key))) throw new Error('You need permission to edit this issue to roll back its task.');
  return box('POST', '/undo', { task: t.id, by: await myName(), account: context.accountId });
});

// ---------- the tasks page, the bulk action and the gadget ----------

/** Tasks from the box's log for a period, cut to the issues this user can see. The project comes from the page
 *  the user is on when there is one. */
resolver.define('activity', async ({ payload, context }) => {
  const days = Math.min(Math.max(Number(payload.days) || 7, 1), 90);
  const project = context.extension.project?.key ?? (payload.project || undefined);
  const data = await box('GET', `/activity${query({ since: new Date(Date.now() - days * DAY).toISOString(), project, q: payload.q, source: payload.source })}`);
  return { ...data, tasks: await visible(data.tasks), canPause: await isAdmin() };
});

/** The issues picked in the issue list, with their task and whether this user may roll it back. */
resolver.define('selected', async ({ context }) => {
  // The issues picked in the list; with none picked, the ones the search shows.
  let keys = keysOf(context.extension.issueKeys);
  if (!keys.length) keys = await keysOfJql(context.extension.jql);
  const found = await issuesWithTasks(keys);
  return Promise.all(found.map(async (f) => ({ ...f, canEdit: f.task?.id ? await mayEdit(f.key) : false })));
});

resolver.define('rollbackIssues', async ({ payload, context }) => ({ results: await rollbackIssues(keysOf(payload.issues), context.accountId) }));

resolver.define('pause', async ({ payload, context }) => {
  if (!(await isAdmin())) throw new Error('Only a Jira admin can pause or resume every agent.');
  return box('POST', '/pause', { paused: payload.paused === true, by: await myName(), account: context.accountId });
});

export const handler = resolver.getDefinitions();
