// Mana designs the rules, GurtOS enforces them. A Mana chat drafts GurtOS Business's approval rules; Mana's agent
// sends the text here; the box turns it into a request for the owner's OK that shows what changes; only after an
// owner or an admin says yes does core apply it (box.setPolicy checks who said yes and that it was this exact text).
//
//   POST /t/mana/policy  {policy}        ->  202 {id, version, adds, removes}, or 4xx {error}
//   GET  /t/mana/policy?id=<id>          ->  {id, version, state, reason?}   state: waiting | applied | denied | expired | replaced | failed
//   GET  /t/mana/policy                  ->  {version, hash}  which Mana version the box enforces now (not the rules: they stay private)
//
// The format is Business's own policy text with three comment lines on top (examples in policy/v1.txt, v2.txt):
//   # GurtOS policy from Mana / # source: <the chat> / # version: <n>
import { createHash } from 'node:crypto';
import type { Box, LogReader, Task } from '../../core/contract.ts';
import { parsePolicy } from '../../core/business.ts';
import { CORS } from './guest.ts';

const SOURCE = 'mana:policy'; // core's setPolicy accepts only requests from this track's own tasks ("mana:...")
const HOUR = 3600_000;
export const EXPIRE_MS = 30 * 60_000;
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: CORS });

export const hashOf = (text: string) => createHash('sha256').update(text).digest('hex').slice(0, 12);
const rules = (text: string) => text.split('\n').map((l) => l.replace(/#.*$/, '').trim()).filter(Boolean);
const versionOf = (text: string) => /^#\s*version:\s*(\d+)/m.exec(text)?.[1];
const open = (t: Task) => ['queued', 'running', 'waiting'].includes(t.state);
const proposals = (box: Box) => box.tasks().filter((t) => t.source === SOURCE);
/** The proposed text rides in the request's own prompt, so nothing else is stored and it survives a restart. */
const textOf = (gate: Task) => Buffer.from(/^write policy\.b64 (\S+)$/m.exec(gate.prompt)?.[1] ?? '', 'base64').toString('utf8');

/** What changes, rule by rule, for the owner's question. */
export function diff(now: string, next: string) {
  const [a, b] = [rules(now), rules(next)];
  return { adds: b.filter((r) => !a.includes(r)), removes: a.filter((r) => !b.includes(r)) };
}

async function propose(req: Request, box: Box) {
  let text: string;
  try {
    const body = JSON.parse(await req.text());
    text = String(body?.policy ?? '').replace(/\r\n/g, '\n').trim() + '\n';
  } catch {
    return json({ error: 'Send JSON: {policy: "<the rules, one per line>"}.' }, 400);
  }
  if (text.length > 8000) return json({ error: 'The rules are too long: at most 8,000 characters.' }, 400);
  const version = versionOf(text);
  if (!/^#\s*GurtOS policy from Mana\s*$/m.test(text) || !version) {
    return json({ error: 'Start the rules with "# GurtOS policy from Mana", "# source: <chat>" and "# version: <n>".' }, 400);
  }
  try {
    parsePolicy(text);
  } catch (e) {
    return json({ error: (e as Error).message }, 400); // names the line the box can't read
  }
  const current = box.policy();
  const change = diff(current, text);
  if (!change.adds.length && !change.removes.length) return json({ error: 'The box already enforces these rules.' }, 409);
  const all = proposals(box);
  if (all.some(open)) return json({ error: 'A rule change from Mana is already waiting for the owner. Try again once it is answered.' }, 409);
  if (all.filter((t) => Date.now() - Date.parse(t.createdAt) < HOUR).length >= 6) return json({ error: 'Enough rule changes this hour. Try again later.' }, 429);

  const say = (rs: string[]) => rs.map((r) => `"${r.replace(/"/g, "'")}"`).join(', ');
  const what = [change.adds.length && `Adds ${say(change.adds)}.`, change.removes.length && `Removes ${say(change.removes)}.`].filter(Boolean).join(' ');
  box.workspace('mana-policy');
  const gate = await box.createTask({
    title: `Rule change from Mana: version ${version}`,
    prompt: `ask Change the approval rules to version ${version} from Mana? ${what} [policy ${hashOf(text)}]\nwrite policy.b64 ${Buffer.from(text).toString('base64')}`,
    workspace: 'mana-policy',
    worker: 'fake',
    tools: [],
    hosts: [],
    budgetCents: 0,
    source: SOURCE,
  });
  box.note({ kind: 'policy.proposed', task: gate.id, version, hash: hashOf(text), ...change }, gate.id);
  return json({ id: gate.id, version, ...change }, 202);
}

function status(req: Request, box: Box) {
  const id = new URL(req.url).searchParams.get('id');
  if (!id) {
    const now = box.policy();
    return json({ version: versionOf(now) ?? null, hash: hashOf(now) });
  }
  const gate = box.task(id);
  if (!gate || gate.source !== SOURCE) return json({ error: 'No such rule change.' }, 404);
  const text = textOf(gate);
  const base = { id, version: versionOf(text) };
  if (open(gate)) return json({ ...base, state: 'waiting' });
  const said = box.approvals().find((a) => a.task === id);
  if (gate.state !== 'done') {
    if (said?.by === 'undo') return json({ ...base, state: 'expired', reason: 'Nobody answered in time, so the rules did not change.' });
    return json({ ...base, state: 'denied', reason: `${said?.by ?? 'The owner'} said no, so the rules did not change.` });
  }
  if (box.policy() === text) return json({ ...base, state: 'applied', reason: `Approved by ${said?.by ?? 'the owner'}. The box enforces version ${base.version} now.` });
  // setPolicy refused it (not GurtOS Business, or not an owner or admin), or a later change replaced it
  return json({ ...base, state: 'replaced', reason: 'Approved, but the box does not enforce it: the rules changed again since, or only an owner or an admin on GurtOS Business can change them.' });
}

/** Apply an approved change. core's setPolicy refuses unless an owner or an admin approved this exact text. */
export const policyReader: LogReader = {
  name: 'policy-apply',
  read(e, box) {
    if (e.type !== 'task.state' || e.state !== 'done') return;
    const gate = box.task(e.task);
    if (gate?.source !== SOURCE || Date.now() - Date.parse(e.at) > EXPIRE_MS) return;
    const yes = box.approvals().find((a) => a.task === gate.id && a.state === 'approved');
    if (!yes) return;
    try {
      box.setPolicy(textOf(gate), yes.id);
      box.note({ kind: 'policy.applied', task: gate.id, version: versionOf(textOf(gate)), by: yes.by }, gate.id);
    } catch (err) {
      box.note({ kind: 'policy.refused', task: gate.id, why: (err as Error).message }, gate.id);
    }
  },
};

export const policyRoutes = {
  'OPTIONS /policy': () => new Response(null, { status: 204, headers: CORS }),
  'POST /policy': propose,
  'GET /policy': status,
};
