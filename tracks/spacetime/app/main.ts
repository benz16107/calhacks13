// The Live window. Everything on it comes from SpacetimeDB subscriptions, so it changes the moment the box does:
// the meters, the agents on a shared queue, the requests and who has them open, and (with the owner's OK) every
// machine on Maincloud that granted this screen a view. Built with `node build.ts` into dist/.
import { DbConnection } from '../../../core/spacetime/bindings/index.ts';
import { DbConnection as Fleet } from '../fleet/bindings/index.ts';

type Where = { database: string; fleet: { host: string; database: string } };
type FleetStatus = { on: boolean; connected: boolean; database: string; identity: string | null; error: string | null };

const $ = (sel: string) => document.querySelector(sel) as HTMLElement;
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const dollars = (cents: number | bigint) => `$${(Number(cents) / 100).toFixed(2)}`;
const ago = (micros: bigint) => {
  const s = Math.max(0, Math.round((Date.now() - Number(micros / 1000n)) / 1000));
  return s < 60 ? `${s} s ago` : s < 3600 ? `${Math.round(s / 60)} min ago` : `${Math.round(s / 3600)} h ago`;
};
const token = new URLSearchParams(location.search).get('access_token') ?? '';
const api = async <T = any>(method: string, p: string, body?: unknown): Promise<T> => {
  const r = await fetch(p, {
    method,
    headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const out = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(out.error ?? `${r.status}`);
  return out as T;
};

let local: DbConnection | undefined;
let fleet: Fleet | undefined;
let view: 'agents' | 'requests' | 'machines' = (localStorage.getItem('gurtos.live.view') as any) || 'agents';
let queue = '';
let looking = '';
let fleetStatus: FleetStatus | undefined;
let state = 'connecting';
let direct = false; // connected straight to SpacetimeDB, not polling the box's API
let polling = false;

// ---------- rendering ----------

let queued = false;
const draw = () => {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => ((queued = false), render()));
};

function meters() {
  const m = local?.db.meter.id.find(0);
  const acts = local ? [...local.db.activity.iter()].sort((a, b) => a.minute.localeCompare(b.minute)) : [];
  const now = new Date();
  const minutes = Array.from({ length: 30 }, (_, i) => new Date(now.getTime() - (29 - i) * 60_000).toISOString().slice(0, 16));
  const by = new Map(acts.map((a) => [a.minute, a]));
  const steps = minutes.map((k) => (by.get(k)?.steps ?? 0) + (by.get(k)?.asked ?? 0) + (by.get(k)?.finished ?? 0) + (by.get(k)?.failed ?? 0));
  const max = Math.max(1, ...steps);
  const today = now.toISOString().slice(0, 10);
  const spentToday = acts.filter((a) => a.minute.startsWith(today)).reduce((s, a) => s + a.costCents, 0);
  const tile = (label: string, value: string, sub = '') =>
    `<div class="tile"><div class="t-caption t-secondary">${label}</div><div class="t-title2">${value}</div>${sub ? `<div class="t-caption t-secondary">${sub}</div>` : ''}</div>`;
  return `<div class="meters" aria-live="polite">
    ${tile('Running', String(m?.running ?? 0))}
    ${tile('Needs you', String(m?.waiting ?? 0))}
    ${tile('Done', String(m?.done ?? 0), m?.failed ? `${m.failed} failed` : '')}
    ${tile('Spent', dollars(m?.spentCents ?? 0n), `${dollars(spentToday)} in the last day`)}
    <div class="tile spark-tile"><div class="t-caption t-secondary">Activity, last 30 minutes</div>
      <svg class="spark" viewBox="0 0 300 40" preserveAspectRatio="none" role="img" aria-label="Steps, requests and finished tasks per minute; the busiest minute had ${max}">
        ${steps.map((v, i) => `<rect x="${i * 10 + 1}" y="${40 - (v / max) * 38}" width="8" height="${(v / max) * 38}" rx="1"></rect>`).join('')}
      </svg></div>
  </div>`;
}

const badge = (status: string) =>
  ({
    working: '<span class="g-badge g-badge-accent">Working</span>',
    idle: '<span class="g-badge g-badge-neutral">Idle</span>',
    waiting: '<span class="g-badge">Needs you</span>',
    gone: '<span class="g-badge g-badge-neutral">Finished</span>',
  })[status] ?? `<span class="g-badge g-badge-neutral">${esc(status)}</span>`;

function agents() {
  if (!local) return '';
  const jobs = [...local.db.job.iter()];
  const queues = [...new Set(jobs.map((j) => j.queue))].sort((a, b) => {
    const last = (q: string) => Math.max(...jobs.filter((j) => j.queue === q).map((j) => Number(j.updatedAt.microsSinceUnixEpoch)));
    return last(b) - last(a);
  });
  if (!queues.includes(queue)) queue = queues[0] ?? '';
  if (!queue)
    return `<div class="g-status"><g-icon name="system-run-symbolic" size="64"></g-icon><div class="g-status-title t-title2">No agents are running.</div>
      <div class="g-status-body t-body t-secondary">When agents share a job, each one's work shows here: what is waiting, who has it, and what is done.</div></div>`;
  const mine = jobs.filter((j) => j.queue === queue).sort((a, b) => Number(a.id - b.id));
  // An agent whose task ended without finishing anything adds nothing to the board.
  const team = [...local.db.agent.iter()].filter((a) => a.queue === queue && (a.status !== 'gone' || a.done > 0)).sort((a, b) => a.name.localeCompare(b.name));
  const col = (title: string, states: string[]) => {
    const list = mine.filter((j) => states.includes(j.state));
    return `<section class="col" aria-label="${title}"><h3 class="t-heading">${title} <span class="t-secondary">${list.length}</span></h3>
      ${list.map((j) => `<div class="g-card job ${j.state}"><div class="t-body-strong">${esc(j.title)}</div>
        <div class="t-caption t-secondary">${j.state === 'open' ? `posted ${ago(j.postedAt.microsSinceUnixEpoch)}` : `${esc(j.agentName)}${j.result ? `: ${esc(j.result)}` : ''}`}</div></div>`).join('') || '<div class="t-caption t-secondary empty">None</div>'}
    </section>`;
  };
  return `<div class="queue-head">
      <label class="t-body-strong" for="queue">Queue</label>
      <span class="g-combo-wrap"><select id="queue" class="g-combo">${queues.map((q) => `<option ${q === queue ? 'selected' : ''}>${esc(q)}</option>`).join('')}</select></span>
      <span class="t-caption t-secondary">Each job goes to one agent only.</span>
    </div>
    <div class="team">${team.map((a) => `<div class="g-card agent"><div class="t-body-strong">${esc(a.name)}</div>${badge(a.status)}
      <div class="t-caption t-secondary">${a.job ? `On ${esc(a.jobTitle)}` : a.status === 'gone' ? 'Its task ended' : 'Nothing in hand'} · ${a.done} done</div></div>`).join('') || '<span class="t-caption t-secondary">No agent has claimed from this queue yet.</span>'}</div>
    <div class="board">${col('Open', ['open'])}${col('In hand', ['claimed'])}${col('Done', ['done', 'failed'])}</div>`;
}

function requests() {
  if (!local) return '';
  const plain = [...local.db.approval.iter()].filter((a) => a.state === 'pending').map((a) => ({ ...a, routed: '', reminded: '', business: false }));
  const routed = [...local.db.myRequests.iter()].filter((r) => r.state === 'pending').map((r) => ({ ...r, routed: r.why, business: true }));
  const all = [...routed, ...plain];
  const viewers = [...local.db.viewers.iter()];
  if (!all.length && (local.db as { scoped?: boolean }).scoped)
    return `<div class="g-status"><g-icon name="emblem-ok-symbolic" size="64"></g-icon><div class="g-status-title t-title2">Your requests are on your home screen</div>
      <div class="g-status-body t-body t-secondary">On GurtOS Business each person sees only the requests sent to them, under Needs you.</div></div>`;
  if (!all.length)
    return `<div class="g-status"><g-icon name="emblem-ok-symbolic" size="64"></g-icon><div class="g-status-title t-title2">Nothing needs you.</div>
      <div class="g-status-body t-body t-secondary">A request shows here as soon as an agent asks. If two people open it, each sees who else is looking, and only the first answer counts.</div></div>`;
  return `<div class="g-list">${all
    .map((a) => {
      const who = viewers.filter((v) => v.id === a.id).map((v) => v.name);
      return `<div class="g-row req ${looking === a.id ? 'open' : ''}">
        <button class="g-row-text req-open" data-id="${esc(a.id)}" aria-expanded="${looking === a.id}">
          <span class="g-row-title t-body-strong">${esc(a.question)}</span>
          <span class="g-row-sub t-caption t-secondary">${a.costCents ? `${dollars(a.costCents)}${a.payee ? ` to ${esc(a.payee)}` : ''} · ` : ''}${a.routed ? esc(a.routed) : 'Any paired phone or this screen can answer.'}${a.reminded ? ` · Reminder sent to ${esc(a.reminded)}` : ''}</span>
          ${who.length ? `<span class="viewing t-caption-strong">${esc(who.join(', '))} ${who.length > 1 ? 'are' : 'is'} viewing</span>` : ''}
        </button>
        ${a.business ? '<span class="g-row-trail t-caption t-secondary">Routed by the policy</span>' : `<span class="g-row-trail">
          <button class="g-btn" data-answer="deny" data-id="${esc(a.id)}">Deny</button>
          <button class="g-btn g-btn-suggested" data-answer="approve" data-id="${esc(a.id)}">Approve${a.costCents ? ` ${dollars(a.costCents)}` : ''}</button></span>`}
      </div>`;
    })
    .join('')}</div>`;
}

function machines() {
  const s = fleetStatus;
  const rows = fleet ? [...fleet.db.myMachines.iter()].sort((a, b) => Number(b.online) - Number(a.online) || a.name.localeCompare(b.name)) : [];
  const toggle = `<section class="g-group"><div class="g-list"><label class="g-row">
      <span class="g-row-text"><span class="g-row-title t-body-strong">Show this computer on your other computers</span>
      <span class="g-row-sub t-caption t-secondary">Shares task counts, how many need you, today's spending and whether it is online. Never a prompt, a file or a key. Only screens you allow can see it. Turning it off removes this computer.</span></span>
      <input type="checkbox" role="switch" class="g-switch" id="fleet-on" ${s?.on ? 'checked' : ''}></label></div>
      ${s?.error ? `<div class="g-banner g-banner-destructive"><g-icon name="dialog-warning-symbolic"></g-icon><div>${esc(s.error)}</div></div>` : ''}</section>`;
  const list = rows.length
    ? `<div class="machines">${rows
        .map(
          (m) => `<div class="g-card machine"><div class="m-head"><span class="dot ${m.online ? 'on' : ''}" aria-hidden="true"></span><span class="t-heading">${esc(m.name)}</span>
          <span class="t-caption t-secondary">${m.online ? 'Online' : `Offline, last seen ${ago(m.lastSeen.microsSinceUnixEpoch)}`}</span></div>
          <div class="t-caption t-secondary">GurtOS ${esc(m.edition[0]?.toUpperCase() + m.edition.slice(1))}${m.version ? ` · ${esc(m.version)}` : ''}</div>
          <div class="m-stats"><span><b>${m.running}</b> running</span><span class="${m.waiting ? 't-attention' : ''}"><b>${m.waiting}</b> need you</span><span><b>${m.doneToday}</b> done today</span><span><b>${dollars(m.spentTodayCents)}</b> today</span></div></div>`,
        )
        .join('')}</div>`
    : `<p class="t-body t-secondary">${s?.on ? (fleet ? 'No computers have shared with this screen yet.' : "Can't reach the live board right now. This computer's own tasks are in Tasks.") : 'No other computers yet. Turn this on to see this one here and in the GurtOS app on your phone.'}</p>`;
  return toggle + list;
}

function render() {
  const live = state === 'live';
  // Nothing to show yet or the box can't be reached: say so once, instead of zeros and empty tabs.
  if (!local) {
    $('#app').innerHTML = state === 'connecting' ? '' : `<div class="g-status"><g-icon name="dialog-warning-symbolic" size="64"></g-icon><div class="g-status-title t-title2">Can't reach the live board right now.</div>
      <div class="g-status-body t-body t-secondary">This computer's own tasks are in Tasks. This page tries again every few seconds.</div></div>`;
    return;
  }
  $('#app').innerHTML = `
    <div class="bar"><span class="g-badge ${live ? 'g-badge-success' : ''}">${live ? 'Live' : 'Catching up'}</span>
      <span class="t-caption t-secondary">${live ? (direct ? 'Updates the moment something changes.' : 'Updates every 2 seconds. The computer\'s own screen updates instantly.') : ''}</span></div>
    ${meters()}
    <div class="g-toggle-group" role="radiogroup" aria-label="View">
      ${(['agents', 'requests', 'machines'] as const).map((v) => `<button class="g-toggle" role="radio" aria-checked="${view === v}" data-view="${v}">${{ agents: 'Agents', requests: 'Requests', machines: 'Computers' }[v]}</button>`).join('')}
    </div>
    <main>${view === 'agents' ? agents() : view === 'requests' ? requests() : machines()}</main>`;
}

// ---------- actions ----------

document.addEventListener('click', async (e) => {
  const el = (e.target as HTMLElement).closest('button') as HTMLButtonElement | null;
  if (!el) return;
  if (el.dataset.view) {
    view = el.dataset.view as typeof view;
    localStorage.setItem('gurtos.live.view', view);
    if (view === 'machines') void loadFleet();
    draw();
  } else if (el.classList.contains('req-open')) {
    looking = looking === el.dataset.id ? '' : el.dataset.id!;
    local?.reducers.look?.({ id: looking }).catch(() => {}); // only the box's own screen says what it is viewing
    draw();
  } else if (el.dataset.answer) {
    el.disabled = true;
    const approved = el.dataset.answer === 'approve';
    try {
      // The box's own screen answers in SpacetimeDB; any other screen through the box's API, like the phone app.
      if (local?.reducers.answer) await local.reducers.answer({ id: el.dataset.id!, approved, by: 'box screen' });
      else await api('POST', `/api/approvals/${encodeURIComponent(el.dataset.id!)}`, { approved, by: 'live window' });
    } catch (err) {
      // "already approved by Rosa's phone": the database's own sentence, which names only who answered first.
      const m = String((err as Error).message ?? err);
      alertText(/^already (approved|denied) by /i.test(m) ? m.replace(/^already/, 'Already') : 'That did not go through. Check the box is reachable and try again.');
    }
    draw();
  }
});
document.addEventListener('change', async (e) => {
  const el = e.target as HTMLInputElement;
  if (el.id === 'queue') ((queue = el.value), draw());
  if (el.id === 'fleet-on') {
    el.disabled = true;
    try {
      fleetStatus = await api('PUT', 'fleet', { on: el.checked });
      await loadFleet();
    } catch (err) {
      alertText((err as Error).message);
    }
    draw();
  }
});
const alertText = (text: string) => ((window as any).gurtos?.toast ? (window as any).gurtos.toast(text) : alert(text));

// ---------- connections ----------

const onBoxScreen = ['127.0.0.1', 'localhost', '[::1]'].includes(location.hostname);

async function connectLocal() {
  // SpacetimeDB listens on the box only. The box's own screen subscribes to it; any other screen (a paired phone or
  // laptop) is shown the same data from the box's API, refreshed every 2 seconds.
  if (!onBoxScreen) return;
  const where = await api<Where>('GET', 'where');
  DbConnection.builder()
    .withUri(`ws://${location.hostname}:3000`)
    .withDatabaseName(where.database)
    .withToken(localStorage.getItem('gurtos.live.token') ?? undefined)
    .onConnect((c, identity, tok) => {
      localStorage.setItem('gurtos.live.token', tok);
      local = c;
      for (const t of [c.db.job, c.db.agent, c.db.meter, c.db.activity, c.db.approval, c.db.myRequests, c.db.viewers] as any[]) {
        t.onInsert?.(draw);
        t.onUpdate?.(draw);
        t.onDelete?.(draw);
      }
      c.subscriptionBuilder()
        .onApplied(() => ((state = 'live'), (direct = true), draw()))
        .subscribe(['SELECT * FROM job', 'SELECT * FROM agent', 'SELECT * FROM meter', 'SELECT * FROM activity', 'SELECT * FROM approval', 'SELECT * FROM my_requests', 'SELECT * FROM viewers']);
      // The box vouches for this screen, so it may answer and its viewing shows to others.
      void api('POST', '/api/pair/identity', { identity: identity.toHexString() }).catch(() => {});
    })
    // A connection that never opened (port 3000 is another database, or out of reach) falls back to the box's API;
    // one that was open and dropped tries again.
    .onDisconnect(() => {
      if (!direct) return void poll();
      state = 'reconnecting';
      local = undefined;
      direct = false;
      poll(); // keep showing the box's data while it reconnects
      setTimeout(connectLocal, 2000);
    })
    // Port 3000 is out of reach (this page is a forwarded view of the box): show the same data from the box's API.
    .onConnectError(() => void poll())
    .build();
}

/** The snapshot as the pieces render() reads from the live connection (it only iterates and looks up the meter). */
function poll() {
  if (polling) return; // one loop at a time
  polling = true;
  void tick();
}
async function tick() {
  if (direct) return void (polling = false); // the direct connection took over
  try {
    const s = await api<any>('GET', 'snapshot');
    if (direct) return void (polling = false);
    const us = (v: string) => ({ microsSinceUnixEpoch: BigInt(v) });
    const list = <T>(rows: T[]) => ({ iter: () => rows[Symbol.iterator]() });
    local = {
      db: {
        job: list(s.jobs.map((j: any) => ({ ...j, id: BigInt(j.id), postedAt: us(j.postedAt), updatedAt: us(j.updatedAt) }))),
        agent: list(s.agents.map((a: any) => ({ ...a, job: BigInt(a.job), at: us(a.at) }))),
        activity: list(s.activity),
        approval: list(s.approvals),
        scoped: s.scoped,
        myRequests: list([]),
        viewers: list([]),
        meter: { id: { find: () => (s.meter ? { ...s.meter, spentCents: BigInt(s.meter.spentCents) } : undefined) } },
      },
      reducers: {},
    } as unknown as DbConnection;
    state = 'live';
  } catch {
    if (direct) return void (polling = false);
    local = undefined;
    state = 'unreachable';
  }
  draw();
  setTimeout(tick, 2000);
}

let fleetStarted = false;
async function loadFleet() {
  fleetStatus = await api<FleetStatus>('GET', 'fleet').catch(() => fleetStatus);
  draw();
  if (!fleetStatus?.on || fleetStarted) return;
  fleetStarted = true;
  const where = await api<Where>('GET', 'where');
  Fleet.builder()
    .withUri(where.fleet.host)
    .withDatabaseName(where.fleet.database)
    .withToken(localStorage.getItem('gurtos.fleet.token') ?? undefined)
    .onConnect((c, identity, tok) => {
      localStorage.setItem('gurtos.fleet.token', tok);
      fleet = c;
      c.db.myMachines.onInsert(draw);
      c.db.myMachines.onDelete(draw);
      c.subscriptionBuilder().onApplied(draw).subscribe(['SELECT * FROM my_machines']);
      // This screen asks its own box to let it see it. Other machines grant it from their own screens or the app.
      void api('POST', 'fleet/viewers', { identity: identity.toHexString(), label: 'box screen' }).catch(() => {});
    })
    .onDisconnect(() => ((fleet = undefined), (fleetStarted = false), draw()))
    .onConnectError(() => ((fleetStarted = false), draw()))
    .build();
}

setInterval(draw, 30_000); // "seen 2 min ago" and the activity chart move on even when nothing changes
render();
poll(); // show the box's data at once; a direct connection to SpacetimeDB replaces it when it opens
void connectLocal().catch((e) => ((state = `cannot start: ${e.message}`), draw()));
if (view === 'machines') void loadFleet();
