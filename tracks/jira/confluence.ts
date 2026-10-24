// Confluence reports for the Jira track: a daily "What our agents did" page per space, and an incident page
// whenever a task is blocked. Pages are written in Confluence storage format (XHTML). Every string that came
// from an agent or a task is escaped, so it cannot add markup or macros. See README.md.

export type Api = (method: string, path: string, body?: unknown) => Promise<any>;
export type DayTask = {
  id: string; title: string; state: string; source: string; issue?: string; costCents: number;
  blocked: string[]; changes: { path: string; change: string }[]; approvals: { question: string; state: string; by?: string }[];
};
export type Incident = {
  task: string; title: string; issue?: string; source: string; at: string; host: string; worker: string; workspace: string;
  allowedHosts: string[]; prompt: string; steps: string[]; outcome: string;
};
type Space = { id: string; key: string };

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const clip = (s: string, max: number) => (s.length > max ? s.slice(0, max) + '...' : s);
const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const origin = (site: string) => (/^https?:\/\//.test(site) ? site : `https://${site}`).replace(/\/+$/, '');
// shortcut: payments by these sources are simulated, so the report says test money; add names as tools appear.
const TEST_MONEY = /wallet|coinbase|solana|visa|payment|credit/i;

const h = (n: number, s: string) => `<h${n}>${esc(s)}</h${n}>`;
const p = (s: string) => `<p>${esc(s)}</p>`;
const ul = (items: string[]) => (items.length ? `<ul>${items.map((i) => `<li>${esc(clip(i, 300))}</li>`).join('')}</ul>` : '');
const macro = (name: string, params: Record<string, string>, body = '') =>
  `<ac:structured-macro ac:name="${name}">${Object.entries(params).map(([k, v]) => `<ac:parameter ac:name="${k}">${esc(v)}</ac:parameter>`).join('')}${body}</ac:structured-macro>`;
const panel = (title: string, colour: string, inner: string) => macro('panel', { title, borderColor: colour, titleBGColor: colour, titleColor: '#FFFFFF' }, `<ac:rich-text-body>${inner}</ac:rich-text-body>`);
const status = (title: string, colour: 'Red' | 'Green' | 'Yellow' | 'Grey' | 'Blue') => macro('status', { title, colour });
const STATE_COLOUR: Record<string, 'Red' | 'Green' | 'Yellow' | 'Grey' | 'Blue'> = { done: 'Green', failed: 'Red', undone: 'Yellow', running: 'Blue', waiting: 'Yellow', queued: 'Grey' };
const stateLabel = (s: string) => status(s === 'undone' ? 'ROLLED BACK' : s.toUpperCase(), STATE_COLOUR[s] ?? 'Grey');
/** A link to the Jira issue when the key looks like one, else the text alone. */
const issueRef = (key: string | undefined, site: string) =>
  !key ? esc('none') : /^[A-Z][A-Z0-9]+-\d+$/.test(key) ? `<a href="${esc(origin(site))}/browse/${key}">${key}</a>` : esc(key);
const row = (cells: string[], head = false) => `<tr>${cells.map((c) => `<${head ? 'th' : 'td'}>${c}</${head ? 'th' : 'td'}>`).join('')}</tr>`;
const table = (head: string[], rows: string[][]) => `<table><tbody>${row(head.map(esc), true)}${rows.map((r) => row(r)).join('')}</tbody></table>`;

/** The space id for a key, creating the space if missing. */
export async function ensureSpace(api: Api, key: string, name: string): Promise<Space> {
  const find = async () => (await api('GET', `/wiki/api/v2/spaces?keys=${encodeURIComponent(key)}`))?.results?.[0];
  let s = await find();
  if (!s) {
    // Space creation exists only in v1. A second writer may win the race; then the lookup finds theirs.
    await api('POST', '/wiki/rest/api/space', { key, name }).catch((e) => {
      if (e?.status !== 400 && e?.status !== 409) throw e;
    });
    s = await find();
  }
  if (!s) throw new Error(`Confluence space ${key} could not be created or found`);
  return { id: String(s.id), key: s.key ?? key };
}

/** Create the page, or update it when one with this title is already in the space. */
async function upsert(api: Api, space: Space, title: string, value: string, site: string) {
  const found = (await api('GET', `/wiki/api/v2/pages?space-id=${space.id}&title=${encodeURIComponent(title)}&status=current`))?.results?.[0];
  const body = { representation: 'storage', value };
  const page = found
    ? await api('PUT', `/wiki/api/v2/pages/${found.id}`, { id: found.id, status: 'current', title, body, version: { number: (found.version?.number ?? 1) + 1 } })
    : await api('POST', '/wiki/api/v2/pages', { spaceId: space.id, status: 'current', title, body });
  const ui: string = page?._links?.webui ?? `/spaces/${space.key}/pages/${page.id}`;
  return { id: String(page.id), url: origin(site) + (ui.startsWith('/wiki') ? '' : '/wiki') + ui };
}

export const dailyTitle = (day: string) => `What our agents did, ${day}`;
export const incidentTitle = (i: Incident) => `Blocked: ${clip(i.title.replace(/\s+/g, ' '), 80)} tried to reach ${i.host} (${i.at.slice(0, 10)})`;

export async function dailyPage(api: Api, space: Space, day: string, tasks: DayTask[], site: string) {
  const count = (s: string) => tasks.filter((t) => t.state === s).length;
  const blocked = tasks.flatMap((t) => t.blocked.map((host) => ({ t, host })));
  const cost = tasks.reduce((n, t) => n + t.costCents, 0);
  const testMoney = tasks.some((t) => t.costCents > 0 && TEST_MONEY.test(t.source));
  const summary = `${tasks.length} tasks. ${count('done')} done, ${count('undone')} rolled back, ${count('failed')} failed. ${blocked.length} blocked attempts. ${dollars(cost)} spent${testMoney ? ' (payments from the wallet tools are test money)' : ''}.`;
  const approvals = tasks.flatMap((t) => t.approvals.map((a) => ({ t, a })));
  const value = [
    panel('Summary', '#0052CC', p(summary)),
    p(`GurtOS wrote this page from the box's action log. Day: ${day} (UTC).`),
    h(2, 'Tasks'),
    tasks.length
      ? table(
          ['Task', 'State', 'Started by', 'Jira issue', 'Cost', 'Files changed', 'Blocked hosts'],
          tasks.map((t) => [esc(clip(t.title.replace(/\s+/g, ' '), 120)), stateLabel(t.state), esc(t.source), issueRef(t.issue, site), esc(dollars(t.costCents)), String(t.changes.length), esc(t.blocked.join(', ') || 'none')]),
        )
      : p('No tasks ran this day.'),
    h(2, 'Blocked attempts'),
    blocked.length
      ? table(['Task', 'Host', 'What GurtOS did'], blocked.map(({ t, host }) => [esc(clip(t.title, 120)), esc(host), esc("Refused the connection at the box's proxy.")]))
      : p('None.'),
    h(2, 'Approvals'),
    approvals.length
      ? table(['Task', 'Question', 'Answer'], approvals.map(({ t, a }) => [esc(clip(t.title, 120)), esc(clip(a.question, 300)), esc(a.state === 'pending' ? 'Waiting for an answer' : `${a.state === 'approved' ? 'Approved' : 'Denied'}${a.by ? ` by ${a.by}` : ''}`)]))
      : p('None asked.'),
  ].join('');
  return upsert(api, space, dailyTitle(day), value, site);
}

export async function incidentPage(api: Api, space: Space, inc: Incident, site: string) {
  const value = [
    panel('Blocked', '#DE350B', p(`A task tried to reach ${inc.host}. That host is not on its allowed list, so GurtOS refused the connection.`)),
    h(2, 'What was tried'),
    table(['', ''], [
      ['Host', esc(inc.host)], ['When', esc(inc.at + ' UTC')], ['Task', esc(inc.title)], ['Task id', esc(inc.task)],
      ['Jira issue', issueRef(inc.issue, site)], ['Started by', esc(inc.source)], ['Worker', esc(inc.worker)], ['Workspace', esc(inc.workspace)],
    ]),
    h(2, 'What the task was allowed to reach'),
    inc.allowedHosts.length ? ul(inc.allowedHosts) : p('No hosts. The task could reach nothing outside the box.'),
    h(2, 'What it was asked'),
    `<pre>${esc(clip(inc.prompt, 2000))}</pre>`,
    h(2, 'What it did just before'),
    inc.steps.length ? ul(inc.steps.slice(-10)) : p('No earlier steps.'),
    h(2, 'What GurtOS did'),
    ul([
      "The connection was refused at the box's proxy. The request never left the box.",
      'The task never held any secrets. Keys stay in the vault, and the vault makes calls for the agent.',
      'The attempt is in the append-only action log.',
      inc.outcome,
    ]),
    h(2, 'What to do'),
    ul([
      'Open the task in Jira and read what it was asked and what it did.',
      'If the attempt looks wrong, roll the task back from the GurtOS panel on the Jira issue. Other tasks keep their changes.',
      `If ${inc.host} is fine, add it to the task's allowed hosts and run it again.`,
    ]),
  ].join('');
  return upsert(api, space, incidentTitle(inc), value, site);
}
