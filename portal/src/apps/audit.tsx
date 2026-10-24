// Audit (docs/figma/business/4-audit.png): who asked, prepared, routed, answered and changed what. Read-only, with
// filters, a table and a CSV file. The rows come from GET /api/audit; the log in memory adds the ids, routes and
// phones the rows leave out.
import './audit.css';
import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { base, api, box, onEvent, pairing, signedIn, useBox, type Approval, type LogEvent, type Person } from '../live.ts';
import { AppIcon, Badge, Button, Icon, IconButton, Menu, Popover, StatusPage, ToggleGroup, type MenuItem } from '../kit/ui.tsx';
import { HeaderBar, phone, useWin } from '../wm.tsx';
import { hhmm, plural, zone } from '../util.ts';

interface AuditRow { seq: number; at: string; event: string; task: string; title: string; app: string; seat: string; asked: string; approver: string; by: string; what: string }
type Tone = 'attention' | 'accent' | 'neutral' | 'success' | 'destructive';
type Actor = 'person' | 'agent' | 'system';
interface Entry {
  row: AuditRow;
  kind: string;
  tone: Tone;
  actor: Actor;
  /** Who did it: a person's name, "Credit analyst agent", or "The box". */
  who: string;
  icon: string;
  bad: boolean;
  title: string;
  sub: string;
  approval?: Approval;
  note?: Record<string, any>;
  /** Everything a search can match, lower case. */
  text: string;
}
interface Ctx { roster: Map<string, Person>; names: Map<string, string>; people: Set<string> }
interface Range { from?: string; to?: string }

// shortcut: shows the newest 1,000 matching entries; narrow the dates or search for older ones.
const LIMIT = 1000;
/** Tool calls, tool results and costs are in the log, but the timeline leaves them out until asked. */
// 'Setting' is Settings' own record of a kill switch pull; the kill switch entry beside it says who and why.
const NOISE = new Set(['Tool', 'Spent', 'Setting']);
const CHANGED: Record<string, string> = { on: 'whether Business is on', company: 'the company name', policy: 'the rules', seats: 'the agent seats' };

const list = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`);
const usd = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: cents % 100 ? 2 : 0 })}`;
const dayKey = (t: string) => new Date(t).toLocaleDateString('en-CA', zone());
const today = () => dayKey(new Date().toISOString());
const shift = (day: string, n: number) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const short = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const dayLabel = (t: string) => new Date(t).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', ...zone() });
const whenOf = (t: string) => new Date(t).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', ...zone() }).replace(',', '');
const initials = (name: string) => name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
const TILES = ['shopper', 'credit-desk', 'tasks', 'time-machine', 'waiting', 'wallet', 'app-center', 'audit'];
const tile = (name: string) => `var(--color-app-${TILES[[...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % TILES.length]})`;

/** Map the ids in the log to the names in the rows, so the People filter can send an id. */
function learn(known: { people: Map<string, string>; seats: Set<string> }, rows: AuditRow[], events: LogEvent[]) {
  const bySeq = new Map(events.map((e) => [e.seq, e]));
  for (const r of rows) {
    if (r.seat) known.seats.add(r.seat);
    const e = bySeq.get(r.seq);
    if (!e) continue;
    if (e.who?.asked && r.asked) known.people.set(e.who.asked, r.asked);
    if (e.who?.approver && r.approver) known.people.set(e.who.approver, r.approver);
    if (e.type === 'approval.answered' && e.person) known.people.set(e.person, e.by);
    const by = e.who?.by ?? (e.type === 'note' ? (e.data as { by?: unknown } | null)?.by : undefined);
    if (typeof by === 'string' && r.by && by !== r.by) known.people.set(by, r.by);
  }
}

/** One audit row as a timeline entry: a kind, who did it, a title and a line of detail. */
function entryOf(r: AuditRow, ev: LogEvent | undefined, c: Ctx): Entry {
  const task = r.title ? `"${r.title}"` : 'a task';
  const agent = r.seat ? `${r.seat} agent` : 'The box';
  const role = (n: string) => (c.roster.get(n)?.title ? `${n} (${c.roster.get(n)!.title})` : n);
  const note = (ev?.type === 'note' ? ev.data : undefined) as Record<string, any> | undefined;
  const approval = ev?.type === 'approval.asked' ? ev.approval : ev?.type === 'approval.answered' ? box.approvals.get(ev.id) : undefined;
  const mk = (kind: string, tone: Tone, actor: Actor, who: string, icon: string, title: string, sub = '', bad = false) => ({ kind, tone, actor, who, icon, title, sub, bad });
  const m = (() => {
    switch (r.event) {
      case 'task.created': {
        const person = ev ? !!ev.who?.asked : c.people.has(r.asked);
        const seat = r.seat ? `Assigned to the ${r.seat} agent.` : '';
        return person
          ? mk('Asked', 'neutral', 'person', r.asked, 'avatar-default', `${role(r.asked)} asked for ${task}`, seat)
          : mk('Started', 'neutral', 'system', 'The box', 'media-playback-start', `Started ${task}`, [r.asked && `Triggered by ${r.asked}.`, seat].filter(Boolean).join(' '));
      }
      case 'task.state': {
        const s = ev?.type === 'task.state' ? ev.state : r.what.match(/^Task (\w+)/)?.[1];
        const summary = ev?.type === 'task.state' ? ev.summary : undefined;
        if (s === 'done') return mk('Done', 'neutral', 'system', agent, 'object-select', `${task} is done`, summary ?? box.tasks.get(r.task)?.summary ?? `Finished${r.seat ? ` by the ${r.seat} agent` : ''}.`);
        if (s === 'failed') return mk('Failed', 'destructive', 'system', agent, 'process-stop', `${task} failed`, r.what.replace(/^Task failed:?\s*/, ''), true);
        if (s === 'undone') return mk('Undone', 'neutral', 'system', agent, 'edit-undo', `${task} was undone`, 'Its file changes are gone. Other tasks keep theirs.');
        if (s === 'waiting') return mk('Waiting', 'neutral', 'system', agent, 'appointment-soon', `${task} waits for an answer`);
        return s === 'queued'
          ? mk('Queued', 'neutral', 'system', agent, 'appointment-soon', `${task} is queued`)
          : mk('Running', 'accent', 'system', agent, 'media-playback-start', `${task} is running`, r.seat && `The ${r.seat} agent works on it.`);
      }
      case 'task.step':
        return r.seat ? mk('Prepared', 'accent', 'agent', agent, 'applications-science', `${agent} prepared ${task}`, r.what) : mk('Step', 'neutral', 'system', agent, 'applications-science', `A step ran in ${task}`, r.what);
      case 'approval.asked': {
        const a = ev?.type === 'approval.asked' ? ev.approval : undefined;
        const to = a?.route?.people.map((p) => (c.roster.get(p.name)?.title ? `${p.name}, ${c.roster.get(p.name)!.title}` : p.name)) ?? [];
        const title = a?.route ? (to.length ? `Routed to ${list(to)}` : 'Routed to nobody') : 'Asked for an answer';
        return mk('Routed', 'attention', 'system', 'The rules', 'help-about', title, a?.route?.why ?? a?.question ?? r.what.replace(/^Asked: /, ''));
      }
      case 'approval.answered': {
        const ok = ev?.type === 'approval.answered' ? ev.approved : /^Approved/.test(r.what);
        const who = r.approver || (ev?.type === 'approval.answered' ? ev.by : '') || 'Someone';
        const via = ev?.type === 'approval.answered' && ev.via && ev.via !== who ? `On ${ev.via}. ` : '';
        return mk(ok ? 'Approved' : 'Denied', ok ? 'success' : 'destructive', 'person', who, 'avatar-default', `${ok ? 'Approved' : 'Denied'} by ${who}`, `${via}For ${task}.`);
      }
      case 'net.blocked':
        return mk('Blocked', 'destructive', 'system', 'The network rules', 'process-stop', r.what, `${task} asked for it and was not allowed.`, true);
      case 'keep':
        return mk('Kept', 'neutral', 'system', 'The box', 'object-select', r.what, `For ${task}.`);
      case 'cost':
        return mk('Spent', 'neutral', 'agent', agent, 'applications-science', r.what);
      case 'tool.call':
      case 'tool.result':
        return mk('Tool', 'neutral', 'agent', agent, 'applications-science', r.what, `In ${task}.`);
      case 'note': {
        const by = r.by || 'Someone';
        // The box's own screen acts without a person: show it as the box, not as initials.
        const act: Actor = c.people.has(by) ? 'person' : 'system';
        const glyph = act === 'person' ? 'avatar-default' : 'computer';
        // The wallet's daily fingerprint of the log, written to Solana devnet (a test network): editing any old line
        // breaks it. Anyone can check it with head -n <seq> log.jsonl | sha256sum.
        if (r.app === 'wallet' && note?.audit) {
          const f = note.audit as { seq: number; sha256: string; tx?: string };
          return mk('Fingerprint', 'success', 'system', 'The box', 'security-high', `Log up to entry ${f.seq.toLocaleString('en-US')} fingerprinted on Solana devnet (test network)`, `SHA-256 ${f.sha256.slice(0, 16)}…${f.tx ? `, transaction ${f.tx.slice(0, 12)}…` : ''}. Check it: head -n ${f.seq} log.jsonl | sha256sum`);
        }
        if (r.app === 'kill-switch' && note) {
          const via = note.via && note.via !== by ? note.via : '';
          return note.paused
            ? mk('Paused', 'destructive', act, by, 'media-playback-pause', `${by} paused every agent`, `${plural(note.tasks?.length ?? 0, 'running task')} stopped${via ? `, from ${via}` : ''}.`)
            : mk('Resumed', 'success', act, by, 'media-playback-start', `${by} resumed the agents`, via && `From ${via}.`);
        }
        if (r.app === 'business' && note?.refused) return mk('Refused', 'destructive', act, by, 'process-stop', `${by} tried to ${note.approved ? 'approve' : 'deny'} a request and was refused`, note.why);
        if (r.app === 'business' && note?.person) {
          const name = c.names.get(note.person) ?? note.person;
          const bits = [`Role: ${note.role}`, ...(note.limitCents != null ? [`approves up to ${usd(note.limitCents)}`] : []), ...(note.approvesFor?.length ? [`for ${list(note.approvesFor)}`] : [])];
          return mk('Changed', 'neutral', act, by, glyph, `${by} ${note.change} ${name}`, note.change === 'removed' ? '' : `${bits.join(', ')}.`);
        }
        if (r.app === 'business' && note?.changed) return mk('Changed', 'neutral', act, by, glyph, `${by} changed ${list((note.changed as string[]).map((k) => CHANGED[k] ?? k))}`);
        if (r.app === 'settings' && note?.changed) {
          const keys = Object.keys(note.changed as object);
          return mk(keys.join() === 'paused' ? 'Setting' : 'Changed', 'neutral', act, by, glyph, `Settings changed: ${list(keys)}`);
        }
        return mk('Note', 'neutral', 'system', 'The box', 'help-about', r.what);
      }
      default:
        return mk('Note', 'neutral', 'system', 'The box', 'help-about', r.what);
    }
  })();
  const text = [r.seq, m.kind, m.title, m.sub, m.who, r.title, r.seat, r.asked, r.approver, r.by, approval?.question, r.what].join(' ').toLowerCase();
  return { row: r, ...m, approval, note, text };
}

/** The key and value list of the selected entry. Rows with nothing to say are left out. */
function fieldsOf(e: Entry, c: Ctx): [string, string, boolean?][] {
  const r = e.row;
  const lim = c.roster.get(r.approver)?.limitCents;
  const via = e.note?.via ?? (e.approval?.via);
  const rows: [string, string | undefined | false, boolean?][] = [
    ['Who', e.actor === 'person' && c.roster.get(e.who)?.title ? `${e.who}, ${c.roster.get(e.who)!.title}` : e.who],
    ['Device', via],
    ['When', whenOf(r.at)],
    ['Request', r.title && `${r.title}${r.asked ? `, ${c.people.has(r.asked) ? 'asked' : 'started'} by ${r.asked}` : ''}`],
    ['Prepared by', r.seat && `${r.seat} agent`],
    ['Asked', e.approval?.question],
    ['Rule', e.approval?.route?.rule],
    ['Approval limit', (e.kind === 'Approved' || e.kind === 'Denied') && lim !== undefined && (lim === null ? 'No limit' : `Up to ${usd(lim)}`)],
    ['Why refused', e.kind === 'Refused' && e.note?.why],
    ['Task', r.task, true],
  ];
  return rows.filter((x): x is [string, string, boolean?] => !!x[1]);
}

function Avatar({ e }: { e: Entry }) {
  return e.actor === 'person' ? (
    <span class="gos-au-av" style={{ background: tile(e.who) }} aria-hidden="true">
      {initials(e.who)}
    </span>
  ) : (
    <span class={`gos-au-av is-${e.actor}${e.bad ? ' is-bad' : ''}`} aria-hidden="true">
      <Icon name={e.icon} />
    </span>
  );
}

function Detail({ e, c, inline }: { e: Entry; c: Ctx; inline?: boolean }) {
  return (
    <section class={`gos-au-card${inline ? ' is-inline' : ''}`} aria-label={`Entry ${e.row.seq}`}>
      <p class="gos-au-card-head">
        <Badge kind={e.tone}>{e.kind}</Badge>
        Entry {e.row.seq.toLocaleString('en-US')}
      </p>
      <dl class="g-list gos-au-kv">
        {fieldsOf(e, c).map(([k, v, mono]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd class={mono ? 't-mono' : undefined}>{v}</dd>
          </div>
        ))}
      </dl>
      <p class="gos-au-note">The audit log is append-only. Nobody can edit or delete an entry, including IT admins.</p>
    </section>
  );
}

/** A pill that opens a popover of choices. */
function Pill({ label, children }: { label: string; children: (close: () => void) => ComponentChildren }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [at, setAt] = useState<HTMLElement | null>(null);
  return (
    <>
      <button type="button" ref={ref} class="gos-au-pill" aria-haspopup="menu" aria-expanded={!!at} onClick={() => setAt(at ? null : ref.current)}>
        {label}
        <Icon name="pan-down" />
      </button>
      {at && (
        <Popover anchor={at} onClose={() => setAt(null)} class="gos-au-menu" label={label}>
          {children(() => setAt(null))}
        </Popover>
      )}
    </>
  );
}

const choose = (current: boolean, label: string, run: () => void): MenuItem => ({ label, run, icon: current ? 'object-select' : undefined });

export function AuditApp() {
  const b = useBox();
  const win = useWin();
  const mobile = phone();
  const [range, setRange] = useState<Range>(() => ({ from: shift(today(), -6) }));
  const [person, setPerson] = useState<string>();
  const [seat, setSeat] = useState<string>();
  const [kinds, setKinds] = useState('key');
  const [q, setQ] = useState('');
  const [view, setView] = useState<'timeline' | 'table'>('timeline');
  const [sel, setSel] = useState<number>();
  const [rows, setRows] = useState<AuditRow[]>();
  const [err, setErr] = useState<Error & { status?: number }>();
  const [busy, setBusy] = useState(false);
  const known = useRef({ people: new Map<string, string>(), seats: new Set<string>() });
  const scroller = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);

  // The box filters by UTC day, so ask for a day on each side and keep the days that are right here.
  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (person) p.set('person', person);
    if (seat) p.set('seat', seat);
    if (range.from) p.set('from', shift(range.from, -1));
    if (range.to) p.set('to', shift(range.to, 1));
    return p.size ? `?${p}` : '';
  }, [person, seat, range.from, range.to]);

  useEffect(() => {
    let live = true;
    let timer = 0;
    const load = () =>
      api<AuditRow[]>('GET', `/audit${qs}`).then(
        (r) => {
          if (!live) return;
          learn(known.current, r, box.events);
          setRows(r);
          setErr(undefined);
        },
        (e) => live && setErr(e),
      );
    void load();
    const off = onEvent(() => (clearTimeout(timer), (timer = window.setTimeout(load, 1000))));
    return () => ((live = false), clearTimeout(timer), off());
  }, [qs]);

  const { entries, ctx } = useMemo(() => {
    const roster = new Map<string, Person>();
    const names = new Map(known.current.people);
    // Everyone's name, title and limit come with /api/me's directory, so an auditor sees them too.
    for (const p of [...(b.business.me?.directory ?? []), ...(b.business.people ?? []), ...(b.business.me?.person ? [b.business.me.person] : [])]) (roster.set(p.name, { ...roster.get(p.name), ...p } as never), names.set(p.id, p.name));
    const ctx: Ctx = { roster, names, people: new Set(names.values()) };
    const bySeq = new Map(box.events.map((e) => [e.seq, e]));
    const inRange = (r: AuditRow) => (!range.from || dayKey(r.at) >= range.from) && (!range.to || dayKey(r.at) <= range.to);
    return { entries: (rows ?? []).filter(inRange).map((r) => entryOf(r, bySeq.get(r.seq), ctx)), ctx };
  }, [rows, b.logLoaded, b.business.people, b.business.me, range.from, range.to]);

  const needle = q.trim().toLowerCase();
  const filtered = entries.filter((e) => (kinds === 'all' ? true : kinds === 'key' ? !NOISE.has(e.kind) : e.kind === kinds) && (!needle || e.text.includes(needle)));
  const shown = filtered.slice(-LIMIT);
  const selected = shown.find((e) => e.row.seq === sel) ?? (mobile ? undefined : shown.at(-1));
  const days: { day: string; label: string; items: Entry[] }[] = [];
  for (const e of shown) {
    const day = dayKey(e.row.at);
    if (days.at(-1)?.day !== day) days.push({ day, label: dayLabel(e.row.at), items: [] });
    days.at(-1)!.items.push(e);
  }

  // Newest at the bottom, as in the frame: open at the newest entry, and stay with it while it is in view.
  useEffect(() => {
    const el = scroller.current;
    if (el && pinned.current) el.scrollTop = el.scrollHeight;
  }, [shown.length, view, !!rows]);

  const keys = (ev: KeyboardEvent) => {
    const d = ev.key === 'ArrowDown' ? 1 : ev.key === 'ArrowUp' ? -1 : 0;
    if (!d) return;
    const all = [...(ev.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('[data-seq]')];
    const next = all[all.indexOf(document.activeElement as HTMLElement) + d];
    if (!next) return;
    ev.preventDefault();
    next.focus();
    setSel(Number(next.dataset.seq));
  };

  /** The owner checks the wallet's fingerprints against the log as it is now (GET /t/wallet/audit/verify). */
  async function verifyFingerprints() {
    const token = pairing()?.token;
    const as = signedIn();
    setBusy(true);
    try {
      const r = await fetch(`${base()}/t/wallet/audit/verify`, { headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(as ? { 'x-box-person': as } : {}) } });
      if (!r.ok) throw new Error(r.status === 404 ? 'the Wallet app is off' : (await r.json().catch(() => ({}))).error ?? `${r.status} ${r.statusText}`);
      const v = (await r.json()) as { checks: { matches: boolean }[]; chain?: { ok?: boolean } };
      const bad = v.checks.filter((c) => !c.matches).length;
      win?.toast(
        !v.checks.length
          ? 'No fingerprint yet: the wallet writes one a day.'
          : bad
            ? `${bad} of ${plural(v.checks.length, 'fingerprint')} no longer match the log: an old entry changed.`
            : `All ${plural(v.checks.length, 'fingerprint')} match the log${v.chain?.ok ? ', and the latest is on Solana devnet (test network)' : ''}.`,
      );
    } catch (e) {
      win?.toast(`Not checked: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function exportCsv() {
    const token = pairing()?.token;
    const as = signedIn();
    setBusy(true);
    try {
      const r = await fetch(`${base()}/api/audit.csv${qs}`, { headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(as ? { 'x-box-person': as } : {}) } });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? `${r.status} ${r.statusText}`);
      const url = URL.createObjectURL(await r.blob());
      Object.assign(document.createElement('a'), { href: url, download: 'gurtos-audit.csv' }).click();
      URL.revokeObjectURL(url);
      win?.toast(needle || kinds !== 'key' ? 'Exported gurtos-audit.csv. The file ignores the search and the kinds.' : 'Exported gurtos-audit.csv');
    } catch (e) {
      win?.toast(`Not exported: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  const names = [...ctx.names].sort((x, y) => x[1].localeCompare(y[1]));
  const seats = [...new Set([...(b.business.view?.seats.map((s) => s.name) ?? []), ...known.current.seats])];
  const present = [...new Set(entries.map((e) => e.kind))];
  const t = today();
  const presets: [string, Range][] = [['Today', { from: t, to: t }], ['Last 7 days', { from: shift(t, -6) }], ['Last 30 days', { from: shift(t, -29) }], ['All dates', {}]];
  const rangeLabel = range.from ? (range.from === range.to ? short(range.from) : `${short(range.from)} to ${range.to ? short(range.to) : 'today'}`) : range.to ? `Up to ${short(range.to)}` : 'All dates';
  const count = filtered.length > LIMIT ? `Newest ${LIMIT.toLocaleString('en-US')} of ${filtered.length.toLocaleString('en-US')}` : plural(filtered.length, 'entry', 'entries');
  const forbidden = err?.status === 403;
  const caption = forbidden ? '' : b.business.me?.person?.role === 'auditor' ? 'Read-only for you' : 'Read-only';
  const clear = () => (setQ(''), setPerson(undefined), setSeat(undefined), setKinds('key'), setRange({ from: shift(t, -6) }));

  const row = (e: Entry) => {
    const on = e === selected;
    return {
      'data-seq': e.row.seq,
      'aria-current': on ? ('true' as const) : undefined,
      'aria-expanded': mobile ? on : undefined,
      onClick: () => setSel(mobile && on ? -1 : e.row.seq),
    };
  };

  return (
    <div class="gos-au">
      <HeaderBar
        start={
          mobile ? undefined : (
            <span class="gos-au-start">
              <AppIcon id="audit" size={24} />
              <strong>Audit</strong>
              {caption && <span class="gos-au-caption">{caption}</span>}
            </span>
          )
        }
        title={mobile ? 'Audit' : undefined}
        sub={mobile ? caption : undefined}
        center={
          mobile || forbidden ? undefined : (
            <ToggleGroup
              label="View"
              value={view}
              onChange={setView}
              options={[
                ['timeline', 'Timeline'],
                ['table', 'Table'],
              ]}
            />
          )
        }
        end={
          forbidden ? undefined : mobile ? (
            <IconButton icon="x-office-document" label="Export CSV" onClick={exportCsv} disabled={busy} />
          ) : (
            <>
              {b.owner && b.apps.some((a) => a.track === 'wallet') && (
                <Button kind="flat" onClick={() => void verifyFingerprints()} disabled={busy}>
                  Verify fingerprints
                </Button>
              )}
              <Button onClick={exportCsv} disabled={busy}>
                Export CSV
              </Button>
            </>
          )
        }
      />
      {forbidden ? (
        <StatusPage icon="system-lock-screen" title="Only auditors and admins read the audit">
          {b.business.me?.person ? `${b.business.me.person.name} is signed in. ` : ''}Ask an IT admin for the auditor role.
        </StatusPage>
      ) : !rows ? (
        err ? (
          <StatusPage icon="network-offline" title="The audit did not load">
            {err.message}
          </StatusPage>
        ) : (
          <StatusPage icon="view-refresh" title="Reading the audit" />
        )
      ) : (
        <>
          <div class="gos-au-filters" role="group" aria-label="Filters">
            <div class={`gos-au-pill gos-au-search${q ? ' is-set' : ''}`}>
              <Icon name="system-search" />
              {q && <span>Search:</span>}
              <input
                type="text"
                aria-label="Search the entries"
                placeholder="Search entries"
                value={q}
                style={{ width: `${Math.max(14, q.length + 1)}ch` }}
                onInput={(e) => setQ((e.target as HTMLInputElement).value)}
              />
              {q && (
                <button type="button" class="gos-au-x" aria-label="Remove the search" onClick={() => setQ('')}>
                  <Icon name="window-close" />
                </button>
              )}
            </div>
            <Pill label={rangeLabel}>
              {(close) => (
                <>
                  <Menu label="Dates" onClose={close} items={presets.map(([label, r]) => choose(r.from === range.from && r.to === range.to, label, () => setRange(r)))} />
                  <div class="gos-au-dates">
                    <label>
                      From
                      <input class="g-field" type="date" value={range.from ?? ''} max={range.to} onChange={(e) => setRange({ ...range, from: (e.target as HTMLInputElement).value || undefined })} />
                    </label>
                    <label>
                      To
                      <input class="g-field" type="date" value={range.to ?? ''} min={range.from} onChange={(e) => setRange({ ...range, to: (e.target as HTMLInputElement).value || undefined })} />
                    </label>
                  </div>
                </>
              )}
            </Pill>
            <Pill label={`People: ${person ? (ctx.names.get(person) ?? person) : 'everyone'}`}>
              {(close) => <Menu label="People" onClose={close} items={[choose(!person, 'Everyone', () => setPerson(undefined)), ...names.map(([id, n]) => choose(person === id, n, () => setPerson(id)))]} />}
            </Pill>
            <Pill label={`Agents: ${seat ?? (seats.length === 2 ? 'both' : 'all')}`}>
              {(close) => <Menu label="Agents" onClose={close} items={[choose(!seat, seats.length === 2 ? 'Both' : 'All agents', () => setSeat(undefined)), ...seats.map((s) => choose(seat === s, s, () => setSeat(s)))]} />}
            </Pill>
            <Pill label={`Kinds: ${kinds === 'key' ? 'key events' : kinds === 'all' ? 'all' : kinds.toLowerCase()}`}>
              {(close) => (
                <Menu
                  label="Kinds"
                  onClose={close}
                  items={[choose(kinds === 'key', 'Key events', () => setKinds('key')), choose(kinds === 'all', 'Everything, with tool calls and costs', () => setKinds('all')), 'sep', ...present.map((k) => choose(kinds === k, k, () => setKinds(k)))]}
                />
              )}
            </Pill>
            <span class="gos-au-count" aria-live="polite">
              {count}
            </span>
          </div>
          <div class="gos-au-body">
            <div class="gos-au-main" ref={scroller} onScroll={(e) => (pinned.current = e.currentTarget.scrollHeight - e.currentTarget.scrollTop - e.currentTarget.clientHeight < 80)}>
              <p class="gos-au-count-m" aria-hidden="true">
                {count}
              </p>
              {!shown.length ? (
                <StatusPage icon="edit-find" title={entries.length ? 'No entry matches' : 'No entries yet'} action={entries.length ? <Button onClick={clear}>Clear the filters</Button> : undefined}>
                  {entries.length ? 'Change the search, the people or the kinds.' : 'Nothing was logged in these dates.'}
                </StatusPage>
              ) : view === 'table' && !mobile ? (
                <div class="g-table gos-au-table" role="group" aria-label="Audit entries" onKeyDown={keys}>
                  <div class="g-thead" aria-hidden="true">
                    <span>Time</span>
                    <span>Kind</span>
                    <span>Who</span>
                    <span>Seat</span>
                    <span>What</span>
                  </div>
                  {shown.map((e) => (
                    <button type="button" class="g-tr gos-au-tr" {...row(e)} key={e.row.seq}>
                      <span class="gos-au-time g-td">
                        {short(dayKey(e.row.at))} {hhmm(e.row.at)}
                      </span>
                      <span class="g-td">
                        <Badge kind={e.tone}>{e.kind}</Badge>
                      </span>
                      <span class="g-td">{e.who}</span>
                      <span class="g-td">{e.row.seat}</span>
                      <span class="g-td" title={`${e.title} ${e.sub}`}>
                        {e.kind === 'Prepared' ? (
                          e.sub
                        ) : (
                          <>
                            <strong>{e.title}</strong> <span class="gos-au-dim">{e.sub}</span>
                          </>
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div class="gos-au-days" onKeyDown={keys}>
                  {days.map((d) => (
                    <section key={d.day}>
                      <h3 class="gos-au-day">{d.label}</h3>
                      <ol class="gos-au-list">
                        {d.items.map((e) => (
                          <li key={e.row.seq}>
                            <button type="button" class="gos-au-entry" {...row(e)}>
                              <span class="gos-au-time">{hhmm(e.row.at)}</span>
                              <Avatar e={e} />
                              <span class="gos-au-text">
                                <span class="gos-au-head">
                                  <Badge kind={e.tone}>{e.kind}</Badge>
                                  <span class="gos-au-title">{e.title}</span>
                                </span>
                                {e.sub && <span class="gos-au-sub">{e.sub}</span>}
                              </span>
                            </button>
                            {mobile && e === selected && <Detail e={e} c={ctx} inline />}
                          </li>
                        ))}
                      </ol>
                    </section>
                  ))}
                </div>
              )}
            </div>
            <aside class="gos-au-side" aria-label="The selected entry">
              {selected && <Detail e={selected} c={ctx} />}
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
