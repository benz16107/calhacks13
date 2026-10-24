// The panel's back end. It runs in Atlassian's cloud and is the only thing that holds the box's shared secret
// (BOX_SECRET, a Forge encrypted variable). It never trusts the browser for which task to act on: the task id
// comes from the issue's box.task property, read as the signed-in user, and only users who may edit the issue
// can approve or roll back.
import Resolver from '@forge/resolver';
import api, { fetch, route } from '@forge/api';

const BOX = process.env.BOX_URL || 'https://45-32-140-213.sslip.io/t/jira';
const resolver = new Resolver();

/** The box task behind this issue, from the property the box wrote when it made the issue. */
async function taskOf(context) {
  const key = context.extension.issue.key;
  const r = await api.asUser().requestJira(route`/rest/api/3/issue/${key}/properties/box.task`);
  if (r.status === 404) return undefined;
  if (!r.ok) throw new Error(`Jira answered ${r.status} reading this issue`);
  return { key, id: (await r.json()).value.id };
}

/** Jira's own answer to "may this user edit this issue?". Approving or rolling back needs it. */
async function mayAct(key) {
  const r = await api.asUser().requestJira(route`/rest/api/3/mypermissions?issueKey=${key}&permissions=EDIT_ISSUES`);
  return r.ok && (await r.json()).permissions?.EDIT_ISSUES?.havePermission === true;
}

async function me() {
  const r = await api.asUser().requestJira(route`/rest/api/3/myself`);
  return r.ok ? (await r.json()).displayName : 'someone';
}

/** Call the box. Only Atlassian's servers hold the secret; the panel in the browser never sees it. */
async function box(method, path, body) {
  const r = await fetch(BOX + path, {
    method,
    headers: { authorization: `Bearer ${process.env.BOX_SECRET}`, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `the box answered ${r.status}`);
  return data;
}

resolver.define('load', async ({ context }) => {
  const t = await taskOf(context);
  if (!t) return { none: true };
  const [data, canAct] = await Promise.all([box('GET', `/task?id=${encodeURIComponent(t.id)}`), mayAct(t.key)]);
  return { ...data, canAct };
});

resolver.define('answer', async ({ payload, context }) => {
  const t = await taskOf(context);
  if (!t || !(await mayAct(t.key))) throw new Error('You need permission to edit this issue to answer for its task.');
  return box('POST', '/answer', { task: t.id, approval: String(payload.approval), approved: payload.approved === true, by: await me() });
});

resolver.define('rollback', async ({ context }) => {
  const t = await taskOf(context);
  if (!t || !(await mayAct(t.key))) throw new Error('You need permission to edit this issue to roll back its task.');
  return box('POST', '/undo', { task: t.id, by: await me() });
});

export const handler = resolver.getDefinitions();
