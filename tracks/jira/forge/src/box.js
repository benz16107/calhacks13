// What every part of the app shares: the call to the box, and Jira's answers about who may do what. Only this
// back end holds the box's shared secret (BOX_SECRET, a Forge encrypted variable); no browser ever sees it.
import api, { fetch, route } from '@forge/api';

const BOX = process.env.BOX_URL; // the box's Jira routes, https://<box>/t/jira

/** Call the box. Errors come back as {error}; that message is what the person sees. */
export async function box(method, path, body) {
  if (!BOX) throw new Error('Set the Forge variable BOX_URL to the box\'s Jira routes, https://<box>/t/jira.');
  const r = await fetch(BOX + path, {
    method,
    headers: { authorization: `Bearer ${process.env.BOX_SECRET}`, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `the box answered ${r.status}`);
  return data;
}

/** A query string from the filters that are set. */
export const query = (o) => {
  const q = new URLSearchParams(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== ''));
  return q.size ? `?${q}` : '';
};

/** The signed-in user's name, for the box's log. The account id comes from Forge's context, never the browser. */
export async function myName() {
  const r = await api.asUser().requestJira(route`/rest/api/3/myself`);
  return r.ok ? (await r.json()).displayName : 'someone';
}

/** Any user's name, read as the app. For product events, where there is no signed-in user. */
export async function nameOf(accountId) {
  if (!accountId) return 'someone';
  const r = await api.asApp().requestJira(route`/rest/api/3/user?accountId=${accountId}`);
  return r.ok ? (await r.json()).displayName : 'someone';
}

/** Jira's own answer to "may this user edit this issue?". Approving or rolling back a task needs it. */
export async function mayEdit(key) {
  const r = await api.asUser().requestJira(route`/rest/api/3/mypermissions?issueKey=${key}&permissions=EDIT_ISSUES`);
  return r.ok && (await r.json()).permissions?.EDIT_ISSUES?.havePermission === true;
}

/** Pausing every agent is a Jira admin's call. */
export async function isAdmin() {
  const r = await api.asUser().requestJira(route`/rest/api/3/mypermissions?permissions=ADMINISTER`);
  return r.ok && (await r.json()).permissions?.ADMINISTER?.havePermission === true;
}

const KEY = /^[A-Z][A-Z0-9_]*-\d+$/;
/** Issue keys from a list or a comma separated string, cleaned and capped. */
export const keysOf = (v) =>
  [...new Set((Array.isArray(v) ? v : String(v ?? '').split(/[\s,]+/)).map((k) => String(k).trim().toUpperCase()).filter((k) => KEY.test(k)))].slice(0, 50);

/** The issues among `keys` that the user can see, with their summary and box.task property (undefined on a
 *  plain issue). The task id always comes from here, from Jira, never from a browser or a model. */
export async function issuesWithTasks(keys) {
  if (!keys.length) return [];
  const r = await api.asUser().requestJira(route`/rest/api/3/search/jql`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jql: `key in (${keys.join(',')})`, fields: ['summary'], properties: ['box.task'], maxResults: 50 }),
  });
  if (!r.ok) throw new Error(`Jira answered ${r.status} searching those issues`);
  const { issues = [] } = await r.json();
  return issues.map((i) => ({ key: i.key, summary: i.fields?.summary, task: i.properties?.['box.task'] }));
}

/** Of the box's tasks, the ones whose issue this user can see in Jira. Tasks with no issue stay hidden. */
export async function visible(tasks) {
  const keys = [...new Set(tasks.map((t) => t.issue).filter(Boolean))];
  const seen = new Set();
  for (let i = 0; i < keys.length; i += 50) for (const x of await issuesWithTasks(keys.slice(i, i + 50))) seen.add(x.key);
  return tasks.filter((t) => t.issue && seen.has(t.issue));
}

/** Roll back the tasks behind these issues, for the signed-in user. Each issue must carry a box task and the
 *  user must be able to edit it; the rest are reported as skipped, not sent. Returns one line per issue. */
export async function rollbackIssues(keys, accountId) {
  const found = await issuesWithTasks(keys);
  const report = keys.filter((k) => !found.some((f) => f.key === k)).map((k) => ({ issue: k, ok: false, error: 'not found, or you cannot see it' }));
  const send = [];
  for (const f of found) {
    if (!f.task?.id) report.push({ issue: f.key, title: f.summary, ok: false, error: 'not a GurtOS task' });
    else if (!(await mayEdit(f.key))) report.push({ issue: f.key, title: f.summary, task: f.task.id, ok: false, error: 'you cannot edit this issue' });
    else send.push(f);
  }
  if (send.length) {
    const { results } = await box('POST', '/undo-many', { tasks: send.map((f) => f.task.id), by: await myName(), account: accountId });
    for (const r of results) report.push({ ...r, issue: r.issue ?? send.find((f) => f.task.id === r.task)?.key });
  }
  return report;
}

/** Plain text from Atlassian Document Format, for a task's prompt. */
export const adfText = (n) =>
  !n ? '' : typeof n === 'string' ? n : n.type === 'text' ? n.text
    : (n.content ?? []).map(adfText).join('') + (['paragraph', 'heading', 'listItem', 'codeBlock'].includes(n.type) ? '\n' : '');

/** Start a box task from an issue, read as the app (a product event has no user) or as the user. */
export async function startFrom(key, as, by, accountId) {
  const r = await as.requestJira(route`/rest/api/3/issue/${key}?fields=summary,description,project&properties=box.task`);
  if (!r.ok) throw new Error(`Jira answered ${r.status} reading ${key}`);
  const issue = await r.json();
  // A task is still going for this issue. The box dedupes too; this saves the call. A finished one may run again.
  const t = issue.properties?.['box.task'];
  if (t?.id && ['queued', 'running', 'waiting'].includes(t.state)) return { task: { id: issue.properties['box.task'].id, state: issue.properties['box.task'].state }, already: true };
  return box('POST', '/start', {
    issue: { key: issue.key, summary: issue.fields.summary, description: adfText(issue.fields.description).trim(), project: issue.fields.project.key },
    by,
    account: accountId,
  });
}
