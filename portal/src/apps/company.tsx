// GurtOS Business settings, under COMPANY in Settings (docs/figma/business/): People, Rules and the Kill switch.
// People and the rules come from GET /api/people and GET /api/business; every change goes back through the API, which
// checks it, writes it to the audit log and refuses what it can't read.
import './company.css';
import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { api, box, loadBusiness, pairing, surface, useBox, type Person, type Role, type RuleView } from '../live.ts';
import { AddRow, Alert, AppIcon, Badge, Button, ComboRow, Group, Icon, IconButton, LinkRow, Menu, Popover, Row, Sheet, StatusPage, SwitchRow, type MenuItem } from '../kit/ui.tsx';
import { InWindow, useWin } from '../wm.tsx';
import { PRODUCT } from '../product.ts';
import { appOf, hhmm, ofState, plural, selfBox, useNow, zone } from '../util.ts';
import { Qr, formatCode } from './settings.tsx';

// ---------- shared ----------

const usd = (cents: number) => `$${Math.round(cents / 100).toLocaleString('en-US')}`;
const list = (xs: string[], and = 'and') => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} ${and} ${xs.at(-1)}`);
const when = (t: string | number) => new Date(t).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', ...zone() }).replace(',', '');
const Loading = () => <div class="gos-skeleton gos-skeleton-short" role="status" aria-label="Loading" />;
const AMOUNTS = [100000, 500000, 1000000, 2500000, 5000000, 10000000];
/** Amounts to choose from, in cents, with the current one kept even when it is not on the list. */
const amountOptions = (now: number): [string, string][] => [...new Set([...AMOUNTS, now])].sort((a, b) => a - b).map((c) => [String(c), usd(c)]);

const ROLES: Record<Role, [label: string, about: string]> = {
  approver: ['Approver', 'Can approve requests from others'],
  requester: ['Requester', 'Can ask, not approve'],
  admin: ['Admin', 'Manages people, devices, rules and the kill switch'],
  auditor: ['Auditor', 'Reads the audit log'],
  owner: ['Owner', 'Everything an admin may, plus settings and keys'],
};
const mayApprove = (r: Role) => r === 'approver' || r === 'admin' || r === 'owner';

/** The roles a rule can name instead of a person's name. */
const ROLE_WHO = ['any approver', 'an admin', 'the owner'];
/** "the fraud reviewer" is the name "Fraud reviewer" in people's approvesFor; "IT" stays "IT". */
const nameOf = (who: string) => {
  const n = who.replace(/^(the|a|an)\s+/i, '');
  return /^[A-Z]{2,}$/.test(n) ? n : n[0].toUpperCase() + n.slice(1);
};
const isName = (r: RuleView) => !r.any && !r.blocked && !ROLE_WHO.includes(r.to);
/** The names the rules send requests to, as the policy says them ("the Controller", "IT"), plus any a person already holds. */
function whoNames(rules: RuleView[], people: Person[]) {
  const seen = new Map<string, string>();
  for (const r of rules) if (isName(r)) seen.set(nameOf(r.to).toLowerCase(), r.to);
  for (const n of people.flatMap((p) => p.approvesFor)) if (!seen.has(n.toLowerCase())) seen.set(n.toLowerCase(), /^[A-Z]{2,}$/.test(n) ? n : `the ${n}`);
  return [...seen.values()].map((label) => ({ name: nameOf(label), label }));
}
/** The name the fraud rule sends flags to, if the policy has one. */
const fraudName = (rules: RuleView[]) => {
  const r = rules.find((x) => isName(x) && /fraud/i.test(x.phrase ?? ''));
  return r ? nameOf(r.to) : undefined;
};
const holds = (p: Person, name: string) => p.approvesFor.some((n) => n.toLowerCase() === name.toLowerCase());

/** An inline dropdown inside a sentence: a native select laid over its own label, so the pill is as wide as the choice. */
function Pick({ value, label, options, onChange, disabled }: { value: string; label: string; options: [string, string][]; onChange: (v: string) => void; disabled?: boolean }) {
  const all = options.some(([v]) => v === value) ? options : [...options, [value, value] as [string, string]];
  const shown = all.find(([v]) => v === value)![1];
  if (disabled) return <span class="gos-co-val">{shown}</span>;
  return (
    <span class="gos-co-pick">
      {shown}
      <Icon name="pan-down" />
      <select aria-label={label} value={value} onChange={(e) => onChange((e.target as HTMLSelectElement).value)}>
        {all.map(([v, t]) => (
          <option value={v} key={v}>
            {t}
          </option>
        ))}
      </select>
    </span>
  );
}

// ---------- People ----------

const TILES = ['shopper', 'settings', 'wallet', 'find', 'credit-desk', 'app-center', 'waiting'];
const tileOf = (id: string) => `var(--color-app-${TILES[[...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % TILES.length]})`;
const Avatar = ({ p }: { p: Person }) => (
  <span class="gos-co-avatar" style={{ background: tileOf(p.id) }} aria-hidden="true">
    {p.name
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join('')}
  </span>
);

const phoneText = (p: Person) => {
  const [first, ...more] = p.phones ?? [];
  return first ? `${first.name}${more.length ? ` and ${more.length} more` : ''}` : 'no phone paired yet';
};
function about(p: Person) {
  const tail =
    p.role === 'requester' ? 'can ask agents for work' : p.role === 'admin' ? 'people, devices, rules, the kill switch' : p.role === 'auditor' ? 'sees the audit log and exports it' : phoneText(p);
  return `${p.title || ROLES[p.role][0]} · ${tail}`;
}
function limitText(p: Person) {
  if (p.role === 'requester') return 'Can ask, not approve';
  if (p.role === 'auditor') return 'Read-only';
  if (p.limitCents !== null) return `Approves up to ${usd(p.limitCents)}`;
  if (p.role === 'owner') return 'Approves anything';
  return p.approvesFor.length ? `Approves for ${list(p.approvesFor)}` : 'No spending approvals';
}

export function PeoplePage() {
  const b = useBox();
  const { people, view } = b.business;
  const [sheet, setSheet] = useState<Person | 'new'>();
  if (!view) return <Loading />;
  if (!people)
    return (
      <StatusPage icon="system-lock-screen" title="People">
        Only an admin sees and changes people.
      </StatusPage>
    );
  const fraud = fraudName(view.rules);
  return (
    <>
      <Group title="People" caption="Who can ask, who can approve, and up to how much. Each person approves only from a phone paired to them.">
        {people.map((p) => (
          <LinkRow
            lead={<Avatar p={p} />}
            title={
              <span class="gos-co-name">
                {p.name}
                {fraud && holds(p, fraud) && <Badge kind="accent">Clears fraud flags</Badge>}
              </span>
            }
            sub={<>{about(p)}<span class="gos-co-under">{limitText(p)}</span></>}
            value={<span class="gos-co-end">{limitText(p)}</span>}
            onClick={() => setSheet(p)}
            key={p.id}
          />
        ))}
        <AddRow title="Add a person…" onClick={() => setSheet('new')} />
      </Group>
      <Group title="Agent seats" caption="Agents prepare work. An agent never approves an agent, and never its own proposal.">
        {view.seats.map((s) => (
          <Row
            lead={<AppIcon id="credit-desk" size={36} />}
            title={
              <span class="gos-co-name">
                {s.name}
                <Badge kind="neutral">Agent</Badge>
              </span>
            }
            sub={<>{`Agent${s.about ? ` · ${s.about}` : ''}`}{s.may && <span class="gos-co-under">{s.may}</span>}</>}
            key={s.name}
          >
            {s.may && <span class="g-row-value gos-co-end">{s.may}</span>}
          </Row>
        ))}
      </Group>
      {sheet && <PersonSheet person={sheet === 'new' ? undefined : sheet} onClose={() => setSheet(undefined)} />}
    </>
  );
}

/** Add a person, or change one. After Add, the same sheet moves on to pairing their phone. */
function PersonSheet({ person, onClose }: { person?: Person; onClose: () => void }) {
  const b = useBox();
  const win = useWin();
  const { people = [], view } = b.business;
  const rules = view?.rules ?? [];
  const names = whoNames(rules, people);
  const fraud = fraudName(rules);
  const [name, setName] = useState(person?.name ?? '');
  const [title, setTitle] = useState(person?.title ?? '');
  const [role, setRole] = useState<Role>(person?.role ?? 'approver');
  const [limit, setLimit] = useState(person?.limitCents ?? 1000000);
  const [mine, setMine] = useState(() => new Set((person?.approvesFor ?? []).map((n) => n.toLowerCase())));
  const [busy, setBusy] = useState(false);
  const [pair, setPair] = useState<{ person: Person; added: boolean }>();
  const [remove, setRemove] = useState(false);
  const nameField = useRef<HTMLInputElement>(null);
  useEffect(() => nameField.current?.focus(), [pair]);
  const flip = (n: string, on: boolean) =>
    setMine((s) => {
      const t = new Set(s);
      on ? t.add(n.toLowerCase()) : t.delete(n.toLowerCase());
      return t;
    });
  const valid = name.trim().length > 0 && name.length <= 60;
  const save = async () => {
    if (!valid || busy) return;
    setBusy(true);
    try {
      const saved = await api<Person>('POST', '/people', {
        ...(person && { id: person.id }),
        name: name.trim(),
        title: title.trim(),
        role,
        limitCents: role === 'approver' ? limit : role === 'owner' ? person?.limitCents ?? null : null,
        approvesFor: mayApprove(role) ? names.filter((n) => mine.has(n.name.toLowerCase())).map((n) => n.name) : [],
      });
      await loadBusiness();
      if (person) (onClose(), win?.toast(`${saved.name} saved`));
      else setPair({ person: saved, added: true });
    } catch (e) {
      win?.toast((e as Error).message);
      setBusy(false);
    }
  };
  const doRemove = async () => {
    try {
      await api('DELETE', `/people/${person!.id}`);
      await loadBusiness();
      setRemove(false);
      onClose();
      win?.toast(`${person!.name} removed`);
    } catch (e) {
      setRemove(false);
      win?.toast((e as Error).message);
    }
  };
  if (pair) return <PairSheet person={pair.person} added={pair.added} onClose={onClose} />;
  const who = name.trim() || 'this person';
  const others = people.filter((p) => p.id !== person?.id && fraud && holds(p, fraud)).map((p) => p.name);
  const live = people.find((p) => p.id === person?.id) ?? person;
  return (
    <InWindow>
      <Sheet title={person ? person.name : 'Add a person'} onCancel={onClose} onDone={() => void save()} done={person ? 'Save' : 'Add'} doneDisabled={busy || !valid}>
        <label class="gos-field">
          <span class="t-body-strong">Name</span>
          <input class="g-field" ref={nameField} value={name} placeholder="Full name" maxLength={60} autoComplete="off" onInput={(e) => setName((e.target as HTMLInputElement).value)} onKeyDown={(e) => e.key === 'Enter' && void save()} />
        </label>
        <label class="gos-field">
          <span class="t-body-strong">Job title</span>
          <input class="g-field" value={title} placeholder="Optional, like Controller" maxLength={40} autoComplete="off" onInput={(e) => setTitle((e.target as HTMLInputElement).value)} onKeyDown={(e) => e.key === 'Enter' && void save()} />
        </label>
        <Group>
          <ComboRow
            title="Role"
            sub={ROLES[role][1]}
            value={role}
            options={(Object.keys(ROLES) as Role[]).filter((r) => r !== 'owner' || person?.role === 'owner').map((r) => [r, ROLES[r][0]])}
            onChange={setRole}
          />
          {role === 'approver' && <ComboRow title="Approves up to" sub="Above this amount they can deny, not approve." value={String(limit)} options={amountOptions(limit)} onChange={(v) => setLimit(+v)} />}
          {mayApprove(role) && fraud && (
            <SwitchRow
              title="Can clear fraud flags"
              sub={others.length ? `Today ${others.length === 1 ? 'only ' : ''}${list(others)} can` : 'Nobody can today'}
              checked={mine.has(fraud.toLowerCase())}
              onChange={(v) => flip(fraud, v)}
            />
          )}
          {mayApprove(role) &&
            names
              .filter((n) => n.name !== fraud)
              .map((n) => <SwitchRow title={`Approves for ${n.label}`} sub={`Answers the requests the rules send to ${n.label}.`} checked={mine.has(n.name.toLowerCase())} onChange={(v) => flip(n.name, v)} key={n.name} />)}
        </Group>
        {person ? (
          <Group title="Phones" caption="Each person approves only from a phone paired to them.">
            {live?.phones?.map((ph) => <Row icon="phone" title={ph.name} sub={`Paired ${when(ph.pairedAt)}`} key={ph.id} />)}
            <AddRow title="Pair a phone…" onClick={() => setPair({ person: live!, added: false })} />
          </Group>
        ) : (
          <p class="t-caption t-secondary">Until a phone is paired to {who}, they can't approve anything. Adding them is recorded in the audit log.</p>
        )}
        {person && (
          <div class="gos-actions">
            <Button kind="destructive" onClick={() => setRemove(true)}>
              Remove {person.name}
            </Button>
          </div>
        )}
      </Sheet>
      {remove && <Alert title={`Remove ${person!.name}?`} body="Their phones stop working at once." action={`Remove ${person!.name}`} destructive onConfirm={() => void doRemove()} onCancel={() => setRemove(false)} />}
    </InWindow>
  );
}

interface PairCode {
  code: string;
  url: string;
  expiresAt: string;
}
const loopback = ['127.0.0.1', 'localhost'].includes(location.hostname);

/** A one-time code that pairs a phone as this person, as a QR code (the same card as Devices). */
function PairSheet({ person, added, onClose }: { person: Person; added: boolean; onClose: () => void }) {
  const now = useNow(1000);
  const [code, setCode] = useState<PairCode | string>();
  const [phones, setPhones] = useState(person.phones ?? []);
  const known = useRef(new Set((person.phones ?? []).map((p) => p.id)));
  const make = () => (setCode(undefined), api<PairCode>('POST', `/people/${person.id}/pair`).then(setCode, (e) => setCode((e as Error).message)));
  useEffect(() => {
    void make();
    const t = setInterval(() => void api<Person[]>('GET', '/people').then((all) => setPhones(all.find((p) => p.id === person.id)?.phones ?? []), () => {}), 3000);
    return () => clearInterval(t);
  }, []);
  const close = () => (void loadBusiness(), onClose());
  const joined = phones.find((p) => !known.current.has(p.id));
  const selfUrl = selfBox().url;
  const origin = typeof code === 'object' ? (/^https?:/.test(code.url) ? new URL(code.url).origin : selfUrl ? new URL(selfUrl).origin : loopback ? undefined : location.origin) : undefined;
  const url = origin && typeof code === 'object' ? `${origin}/#pair/${code.code}` : undefined;
  const left = typeof code === 'object' ? Math.max(0, Math.round((Date.parse(code.expiresAt) - now) / 1000)) : 0;
  return (
    <InWindow>
      <Sheet title={`Pair ${person.name}'s phone`} onCancel={close} onDone={close} done="Done">
        <div class="gos-set-pair">
          <div class="gos-set-qr">
            {url ? (
              <Qr text={url} label={`Pairing link for ${person.name}'s phone as a QR code`} />
            ) : typeof code === 'string' ? (
              `Pairing is not available: ${code}`
            ) : code ? (
              `This screen does not know the address phones use (set BOX_URL). Open ${PRODUCT} from a laptop for the QR code.`
            ) : (
              'Making a code…'
            )}
          </div>
          <div class="gos-set-pair-text">
            <p class="t-body">1. Point {person.name}'s phone camera at the code.</p>
            <p class="t-body">2. {PRODUCT} opens on the phone, on this box's address.</p>
            <p class="t-body">3. Check the phone shows the same code, then name it.</p>
            {typeof code === 'object' && (
              <>
                <p class="gos-set-code" aria-label={`Code ${code.code.split('').join(' ')}`}>
                  {formatCode(code.code)}
                </p>
                {joined ? (
                  <p class="t-body-strong t-success" role="status">
                    <Icon name="object-select" /> Paired: {joined.name}
                  </p>
                ) : left > 0 ? (
                  <p class="t-caption t-secondary">
                    The code works once and changes in {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}.
                  </p>
                ) : (
                  <p class="t-caption t-secondary">The code expired, at {hhmm(code.expiresAt)}.</p>
                )}
              </>
            )}
            {!joined && (typeof code === 'string' || (typeof code === 'object' && left === 0)) && (
              <div class="gos-actions">
                <Button onClick={() => void make()}>Make a new code</Button>
              </div>
            )}
          </div>
        </div>
        <p class="t-caption t-secondary">
          Until a phone is paired to {person.name}, they can't approve anything.{added ? ' Adding them is recorded in the audit log.' : ''}
        </p>
      </Sheet>
    </InWindow>
  );
}

// ---------- Rules ----------

/** The four sentences the policy reads, as the page edits them. Amounts are in cents. */
type Form = { kind: 'over'; amount: number; who: string } | { kind: 'words'; words: string; who: string } | { kind: 'blocked'; amount: number } | { kind: 'else'; who: string };
const cents = (s: string) => +s.replace(/,/g, '') * 100;
function parseLine(line: string): Form | undefined {
  let m: RegExpExecArray | null;
  if ((m = /^Requests over \$([\d,]+) go to (.+) for approval\.$/.exec(line))) return { kind: 'over', amount: cents(m[1]), who: m[2] };
  if ((m = /^Requests over \$([\d,]+) can't be approved in GurtOS\.$/.exec(line))) return { kind: 'blocked', amount: cents(m[1]) };
  if ((m = /^Everything else goes to (.+)\.$/.exec(line))) return { kind: 'else', who: m[1] };
  if ((m = /^(.+?) go to (.+) for approval\.$/.exec(line))) return { kind: 'words', words: m[1], who: m[2] };
}
const writeLine = (f: Form) =>
  f.kind === 'over' ? `Requests over ${usd(f.amount)} go to ${f.who} for approval.` : f.kind === 'words' ? `${f.words} go to ${f.who} for approval.` : f.kind === 'blocked' ? `Requests over ${usd(f.amount)} can't be approved in GurtOS.` : `Everything else goes to ${f.who}.`;
/** Where each rule sits in the policy text: one rule per line, comments and blank lines skipped. */
const ruleLines = (all: string[]) => all.flatMap((l, i) => (l.trim() && !l.trim().startsWith('#') ? [i] : []));

/** What the tester asks for: the words the rules match on, per kind of request. */
const KINDS: [id: string, label: string, words: string][] = [
  ['credit line', 'credit line', 'credit line'],
  ['fraud flag', 'fraud flag', 'fraud referral'],
  ['write-off', 'write-off', 'write off'],
  ['production change', 'production change', 'production change'],
  ['other', 'other request', ''],
];
interface Route {
  rule: string;
  to: string;
  people: { id: string; name: string }[];
  why: string;
}

function Tester({ people }: { people?: Person[] }) {
  const b = useBox();
  const view = b.business.view!;
  const askers = (people ?? []).filter((p) => p.role !== 'auditor');
  const [kind, setKind] = useState('credit line');
  const [amount, setAmount] = useState(4000000);
  const [pick, setPick] = useState('');
  const asked = askers.some((p) => p.id === pick) ? pick : (askers.find((p) => p.role === 'requester') ?? askers[0])?.id ?? '';
  const [res, setRes] = useState<Route | string>();
  useEffect(() => {
    let live = true;
    const words = KINDS.find((k) => k[0] === kind)![2];
    api<Route>('GET', `/business/route?text=${encodeURIComponent(words)}&amount=${amount}${asked ? `&asked=${asked}` : ''}`).then(
      (r) => live && setRes(r),
      (e) => live && setRes((e as Error).message),
    );
    return () => void (live = false);
  }, [kind, amount, asked, view.policy]);
  const rule = typeof res === 'object' ? view.rules.find((r) => r.line === res.rule) : undefined;
  const asker = askers.find((p) => p.id === asked);
  const barred = typeof res === 'object' && res.people.length > 0 && asker && rule?.approvers.includes(asker.name) && !res.people.some((p) => p.id === asker.id);
  const goes =
    typeof res === 'object' &&
    (res.people.length
      ? `Goes to ${list(
          res.people.map((p) => (res.people.length === 1 && people?.find((x) => x.id === p.id)?.title ? `${p.name}, ${people.find((x) => x.id === p.id)!.title}` : p.name)),
          'or',
        )}.`
      : rule?.blocked
        ? "Can't be approved in GurtOS."
        : 'Nobody can approve it yet.');
  return (
    <section class="gos-co-test" aria-label="Who would approve this?">
      <h3 class="t-heading">Who would approve this?</h3>
      <p class="gos-co-sentence">
        A
        <Pick value={kind} label="Kind of request" options={KINDS.map(([id, label]) => [id, label])} onChange={setKind} />
        of
        <Pick value={String(amount)} label="Amount" options={amountOptions(4000000)} onChange={(v) => setAmount(+v)} />
        {askers.length > 0 && (
          <>
            asked for by
            <Pick value={asked} label="Asked for by" options={askers.map((p) => [p.id, p.name])} onChange={setPick} />
          </>
        )}
      </p>
      <div class="gos-co-answer" role="status">
        {typeof res === 'string' ? (
          <p class="t-secondary">{res}</p>
        ) : res ? (
          <>
            <p class="t-body-strong">{goes}</p>
            <p class="t-secondary">
              {res.why}
              {barred ? ` ${asker!.name} can't approve it, because they asked for it.` : ''}
            </p>
          </>
        ) : null}
      </div>
    </section>
  );
}

export function RulesPage() {
  const b = useBox();
  const win = useWin();
  const { view, people } = b.business;
  const [adding, setAdding] = useState(false);
  if (!view) return <Loading />;
  const edit = !!people; // only an admin or the owner changes rules
  const names = whoNames(view.rules, people ?? []);
  const whoOptions: [string, string][] = [...names.map((n) => [n.label, n.label] as [string, string]), ...ROLE_WHO.map((r) => [r, r] as [string, string])];
  const all = view.policy.split('\n');
  const at = ruleLines(all);
  const save = async (next: string[]) => {
    try {
      const saved = await api<{ warnings?: string[] }>('PUT', '/business', { policy: next.join('\n') });
      if (saved.warnings?.length) win?.toast(saved.warnings[0]);
    } catch (e) {
      win?.toast((e as Error).message);
    }
    await loadBusiness();
  };
  const setLine = (i: number, f: Form) => {
    const next = [...all];
    next[at[i]] = writeLine(f);
    return save(next);
  };
  const move = (i: number, d: number) => {
    const next = [...all];
    [next[at[i]], next[at[i + d]]] = [next[at[i + d]], next[at[i]]];
    return save(next);
  };
  const remove = (i: number) => {
    const next = [...all];
    next.splice(at[i], 1);
    return save(next).then(() => win?.toast('Rule removed', 'Undo', () => void save(all)));
  };
  const add = async (f: Form) => {
    const next = [...all];
    const last = view.rules.findIndex((r) => parseLine(r.line)?.kind === 'else');
    next.splice(last >= 0 ? at[last] : next.length, 0, writeLine(f));
    await save(next);
    setAdding(false);
  };
  const forms = view.rules.map((r) => parseLine(r.line));
  return (
    <>
      <Tester people={people} />
      <Group title="Who approves" caption={edit ? 'Click a highlighted value to change it. Every change is in the audit log.' : 'Only an admin changes these. Every change is in the audit log.'}>
        {view.rules.map((r, i) => {
          const f = forms[i];
          const amountPick = (f: Extract<Form, { amount: number }>) => <Pick value={String(f.amount)} label={`Rule ${i + 1}, amount`} options={amountOptions(f.amount)} onChange={(v) => void setLine(i, { ...f, amount: +v })} disabled={!edit} />;
          const whoPick = (f: Extract<Form, { who: string }>) => <Pick value={f.who} label={`Rule ${i + 1}, who approves`} options={whoOptions} onChange={(v) => void setLine(i, { ...f, who: v })} disabled={!edit} />;
          const sentence = !f ? (
            r.line
          ) : f.kind === 'over' ? (
            <>
              Requests over {amountPick(f)} go to {whoPick(f)} for approval.
            </>
          ) : f.kind === 'blocked' ? (
            <>Requests over {amountPick(f)} can't be approved in GurtOS.</>
          ) : f.kind === 'else' ? (
            <>Everything else goes to {whoPick(f)}.</>
          ) : (
            <>
              {f.words} go to {whoPick(f)} for approval.
            </>
          );
          const items: MenuItem[] = [
            { label: 'Move up', icon: 'pan-up', run: () => void move(i, -1), disabled: i === 0 || f?.kind === 'else' },
            { label: 'Move down', icon: 'pan-down', run: () => void move(i, 1), disabled: i === view.rules.length - 1 || forms[i + 1]?.kind === 'else' },
            { label: 'Remove', icon: 'user-trash', run: () => void remove(i), destructive: true },
          ];
          return (
            <Row
              title={sentence}
              sub={[
                r.changed && `Changed by ${r.changed.by} · ${when(r.changed.at)}`,
                r.blocked ? 'Nobody approves these.' : r.approvers.length ? `${list(r.approvers)} ${r.approvers.length === 1 ? 'approves' : 'approve'}.` : 'Nobody can approve these yet.',
              ]
                .filter(Boolean)
                .join(' · ')}
              key={r.line}
            >
              {edit && <More label={`More for rule ${i + 1}`} items={items} />}
            </Row>
          );
        })}
        {edit && <AddRow title="Add a rule…" onClick={() => setAdding(true)} />}
      </Group>
      <Group title="Always on" caption="Built into GurtOS Business. Nobody can turn these off, including admins.">
        {['Nobody approves their own request.', 'An agent never approves an agent.', 'Every request, routing, answer and rule change goes in the audit log.'].map((t) => (
          <Row icon="system-lock-screen" title={t} key={t} />
        ))}
      </Group>
      {adding && <AddRuleSheet who={whoOptions} onAdd={add} onClose={() => setAdding(false)} />}
    </>
  );
}

/** A view-more button with a menu under it. */
function More({ label, items }: { label: string; items: (MenuItem | 'sep')[] }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return (
    <>
      <IconButton icon="view-more" label={label} aria-haspopup="menu" aria-expanded={!!anchor} onClick={(e) => setAnchor((a) => (a ? null : (e.currentTarget as HTMLElement)))} />
      {anchor && (
        <Popover anchor={anchor} onClose={() => setAnchor(null)} align="end" label={label}>
          <Menu items={items} onClose={() => setAnchor(null)} label={label} />
        </Popover>
      )}
    </>
  );
}

/** Pick one of the sentences the policy reads, and fill in its values. */
function AddRuleSheet({ who, onAdd, onClose }: { who: [string, string][]; onAdd: (f: Form) => Promise<void>; onClose: () => void }) {
  const [kind, setKind] = useState<'over' | 'words' | 'blocked'>('over');
  const [amount, setAmount] = useState(1000000);
  const [words, setWords] = useState('');
  const [to, setTo] = useState('any approver');
  const [busy, setBusy] = useState(false);
  // The Sheet focuses its first enabled control, which here would be Add rule: start on the first choice instead.
  useEffect(() => (document.querySelector('.g-sheet select') as HTMLElement | null)?.focus(), []);
  const text = words.trim() ? words.trim()[0].toUpperCase() + words.trim().slice(1) : 'Production changes';
  const f: Form = kind === 'over' ? { kind, amount, who: to } : kind === 'blocked' ? { kind, amount } : { kind, words: text, who: to };
  const go = () => (setBusy(true), onAdd(f).finally(() => setBusy(false)));
  return (
    <InWindow>
      <Sheet title="Add a rule" onCancel={onClose} onDone={() => void go()} done="Add rule" doneDisabled={busy || (kind === 'words' && !words.trim())}>
        <Group>
          <ComboRow
            title="Kind of rule"
            value={kind}
            options={[
              ['over', 'Requests over an amount'],
              ['words', 'Requests that mention certain words'],
              ['blocked', 'Requests too big to approve'],
            ]}
            onChange={setKind}
          />
          {kind !== 'words' && <ComboRow title="Over" value={String(amount)} options={amountOptions(amount)} onChange={(v) => setAmount(+v)} />}
          {kind !== 'blocked' && <ComboRow title="Goes to" value={to} options={who} onChange={setTo} />}
        </Group>
        {kind === 'words' && (
          <label class="gos-field">
            <span class="t-body-strong">The request mentions</span>
            <input class="g-field" value={words} placeholder="Production changes" maxLength={40} autoComplete="off" onInput={(e) => setWords((e.target as HTMLInputElement).value)} onKeyDown={(e) => e.key === 'Enter' && words.trim() && !busy && void go()} />
          </label>
        )}
        <p class="t-body">{writeLine(f)}</p>
        <p class="t-caption t-secondary">The new rule goes above "Everything else", and the first rule that matches decides. Adding it is recorded in the audit log.</p>
      </Sheet>
    </InWindow>
  );
}

// ---------- Kill switch ----------

export function KillSwitchPage() {
  const b = useBox();
  const win = useWin();
  const { view, me } = b.business;
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!view || !me) return <Loading />;
  const paused = me.paused ?? view.paused;
  const role = me.person?.role;
  const may = role ? role === 'admin' || role === 'owner' : b.owner;
  const running = ofState('running').length;
  const waiting = [...box.approvals.values()].filter((a) => a.state === 'pending').length;
  const act = async (path: '/pause' | '/resume') => {
    setBusy(true);
    try {
      await api('POST', path);
      await loadBusiness();
    } catch (e) {
      win?.toast((e as Error).message);
    }
    setBusy(false);
    setConfirm(false);
  };
  const where = pairing() ? 'this phone is paired to you' : surface === 'box screen' ? 'this screen' : 'this browser';
  const you = me.person ? `${me.person.name} · ${me.person.title || ROLES[me.person.role][0]} · ${where}` : `The box owner · ${where}`;
  if (paused) {
    const mine = !!me.person && paused.by === me.person.name;
    const here = mine && (pairing() ? pairing()!.device.name === paused.via : surface === 'box screen' && paused.via === 'box screen');
    const from = here ? (pairing() ? 'this phone' : 'this screen') : paused.via === 'box screen' ? 'the box screen' : paused.via;
    const stopped = ofState('running', 'waiting', 'queued');
    return (
      <>
        <section class="g-banner g-banner-destructive gos-co-paused">
          <h3 class="gos-co-paused-title">
            <Icon name="media-playback-pause" /> All agents are paused
          </h3>
          <p>
            {mine ? 'You paused them' : paused.by === paused.via ? 'Paused' : `${paused.by} paused them`} at {hhmm(paused.at)}
            {from ? ` from ${from}` : ''}. {plural(stopped.length, 'task')} stopped where {stopped.length === 1 ? 'it was' : 'they were'}.
          </p>
          <Button kind="suggested" large class="gos-co-big" disabled={!may || busy} onClick={() => void act('/resume')}>
            Resume all agents
          </Button>
          {!may && <p class="t-caption t-secondary">Only an IT admin can pause or resume the agents.</p>}
        </section>
        <Group title="Stopped tasks">
          {stopped.map((t) => (
            <Row lead={<AppIcon id={appOf(t).id} title={appOf(t).title} size={36} />} title={<span class="gos-co-clamp">{t.title}</span>} sub={<span class="gos-co-clamp">{[t.seat, t.step].filter(Boolean).join(' · ')}</span>} key={t.id}>
              <Badge kind="neutral">Paused</Badge>
            </Row>
          ))}
          {!stopped.length && <Row title="No tasks were running" />}
        </Group>
        <p class="t-caption t-secondary">{waiting ? `${plural(waiting, 'request')} waiting for an OK stay${waiting === 1 ? 's' : ''} open. Whoever the rules send ${waiting === 1 ? 'it' : 'them'} to can still answer.` : 'No requests are waiting for an OK.'}</p>
      </>
    );
  }
  return (
    <>
      <Group>
        <Row title="Running now">
          <span class="g-row-value">{plural(running, 'task')}</span>
        </Row>
        <Row title="Waiting for an OK">
          <span class="g-row-value">{plural(waiting, 'request')}</span>
        </Row>
        <Row title="Agent seats">
          <span class="g-row-value">{view.seats.length}</span>
        </Row>
      </Group>
      <div class="gos-co-stack">
        <Button kind="destructive" large class="gos-co-big" disabled={!may || busy} onClick={() => setConfirm(true)}>
          Pause all agents
        </Button>
        {!may && <p class="t-caption t-secondary">Only an IT admin can pause or resume the agents.</p>}
      </div>
      <p class="t-body t-secondary">Every running task stops where it is and nothing new starts. Requests waiting for an OK stay open. Only an IT admin can resume, and both the pause and the resume go in the audit log.</p>
      <p class="t-caption t-secondary">{you}</p>
      {confirm && (
        <Alert
          title={`Pause all agents at ${view.company}?`}
          body={`${running} running ${running === 1 ? 'task stops where it is' : 'tasks stop where they are'}, and nothing new starts. ${
            waiting ? `The ${plural(waiting, 'request')} waiting for an OK stay${waiting === 1 ? 's' : ''} open.` : 'No requests are waiting for an OK.'
          } Only an IT admin can resume. The pause goes in the audit log.`}
          action="Pause all agents"
          destructive
          busy={busy}
          onConfirm={() => void act('/pause')}
          onCancel={() => setConfirm(false)}
        />
      )}
    </>
  );
}
