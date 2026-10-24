// The Fetch.ai track's demo step. Offline, it chats with brain.py, the box's half of an ASI:One chat, over stdin
// and stdout instead of Agentverse, with the fake worker: pairing, a task, an Approve card, the diff, Undo, and a
// restart. DEMO_LIVE=fetch ./demo also starts the real agent on Agentverse and talks to it through ASI:One's API.
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import type { Approval, DemoKit, Task } from '../../core/contract.ts';

const HERE = path.dirname(new URL(import.meta.url).pathname);
type Card = { kind: string; payload: Record<string, any> };
type Out = { id: string; to: string; session: string; text: string; card?: Card };
/** The box's ASI:One page, as the box's own screen sees it. */
const page = async (d: DemoKit) => (await fetch(`http://127.0.0.1:${fs.readFileSync(path.join(d.home, 'api.port'), 'utf8').trim()}/t/fetch/`)).text();

export default async function (d: DemoKit) {
  d.check(d.view('project', 'split.js')?.includes('Math.floor'), 'the track made the "project" workspace: a small repo with a failing test');
  const off = await page(d);
  d.check(off.includes('agent is off') && !off.includes('Pairing code'), "the box's ASI:One page says the agent is off and how to turn it on, with no pairing code to misread");

  const state = fs.mkdtempSync(path.join(d.home, 'fetch-chat-'));
  const port = fs.readFileSync(path.join(d.home, 'api.port'), 'utf8').trim();
  const env = { PATH: process.env.PATH, PYTHONDONTWRITEBYTECODE: '1', BOX_API: `http://127.0.0.1:${port}`, FETCH_STATE: state, FETCH_WORKER: 'fake', FETCH_TOOLS: 'example.spend', FETCH_HOLD: '3' };
  const got: Out[] = [];
  let brain: ChildProcess;
  const start = () => {
    brain = spawn('python3', [path.join(HERE, 'brain.py')], { env, stdio: ['pipe', 'pipe', 'inherit'] });
    readline.createInterface({ input: brain.stdout! }).on('line', (l) => got.push(JSON.parse(l)));
  };
  const owner = `agent1q${randomBytes(20).toString('hex')}`;
  const stranger = `agent1q${randomBytes(20).toString('hex')}`;
  const session = randomUUID();
  const say = (from: string, text: string) => brain.stdin!.write(JSON.stringify({ from, session, text }) + '\n');
  const reply = (to: string, what: string, ms = 15_000) =>
    d.waitFor(`a reply ${what}`, async () => {
      const i = got.findIndex((m) => m.to === to);
      return i < 0 ? undefined : got.splice(i, 1)[0];
    }, ms);
  const chatTasks = async () => (await d.api<Task[]>('GET', '/tasks')).filter((t) => t.source === 'asi1');
  const click = (card: Card | undefined, cta: 'approve_cta' | 'reject_cta') => JSON.stringify(card?.payload[cta]?.selection);

  start();
  try {
    say(stranger, 'fix the failing test in my project');
    const no = await reply(stranger, 'to a stranger');
    d.check(no.text.includes('pair') && (await chatTasks()).length === 0, 'a stranger on ASI:One gets the pairing step, and no task starts');

    const { code } = JSON.parse(fs.readFileSync(path.join(state, 'state.json'), 'utf8'));
    say(owner, `pair ${code === '111111' ? '222222' : '111111'}`);
    const wrong = await reply(owner, 'to a wrong code');
    say(owner, `pair ${code}`);
    const paired = await reply(owner, 'to the right code');
    d.check(wrong.text.includes('not the code') && paired.text.startsWith('Paired'), 'a wrong pairing code is refused; the code from the box\'s screen pairs the owner');

    // The fake worker runs the chat text as its script: change a file, then spend $3 of test money.
    say(owner, 'write NOTES.md fixed by the box\ncall example.spend {"cents":300,"on":"a test purchase"}');
    const ask = await reply(owner, 'with an approval card');
    const [t] = await chatTasks();
    const pending = (await d.api<Approval[]>('GET', '/approvals?state=pending')).find((a) => a.task === t?.id);
    d.check(t && t.hosts.length === 0 && t.budgetCents === 25 && pending, `the chat started task ${t?.id}, with no network of its own and a 25 cent budget; spending $3.00 paused it`);
    const sel = ask.card?.payload.approve_cta?.selection;
    d.check(ask.card?.kind === 'review' && sel?.action === 'approve' && sel.approval === pending?.id, 'the chat got an ASI Interactive Card (review) with Approve and Deny for that approval');

    say(stranger, click(ask.card, 'approve_cta'));
    await reply(stranger, 'to a stranger clicking Approve');
    d.check((await d.api<Approval[]>('GET', '/approvals?state=pending')).some((a) => a.id === pending?.id), 'a stranger sending the same click approves nothing');

    say(owner, click(ask.card, 'approve_cta'));
    const done = await reply(owner, 'with the result');
    const { approvals } = await d.api<{ approvals: Approval[] }>('GET', `/tasks/${t.id}`);
    d.check(approvals[0]?.state === 'approved' && approvals[0].by === 'asi1', 'clicking Approve in the chat answered it on the box, logged as asi1');
    d.check(done.text.startsWith('Done') && done.text.includes('+fixed by the box') && d.view('project', 'NOTES.md') === 'fixed by the box', 'the task finished, and its reply carries the diff');

    say(owner, click(done.card, 'reject_cta'));
    const undone = await reply(owner, 'to Undo');
    d.check(undone.text.startsWith('Undone') && (await chatTasks())[0].state === 'undone' && !d.view('project', 'NOTES.md'), 'the Undo button in the result card undid the task on the box');

    // A pull of the plug on the chat side: the OK comes from the phone while the chat agent is down.
    say(owner, 'ask Deploy the new build?');
    const deploy = await reply(owner, 'with the deploy card');
    brain!.kill('SIGKILL');
    await d.api('POST', `/approvals/${deploy.card?.payload.approve_cta.selection.approval}`, { approved: true, by: 'phone' });
    start();
    // A busy test machine can take a while to start Python again, so these wait longer.
    const onPhone = await reply(owner, 'about the phone', 60_000);
    const deployed = await reply(owner, 'with the deploy result', 60_000);
    d.check(onPhone.text.startsWith('Approved on your phone') && deployed.text.startsWith('Done'), 'restarted, the chat agent picked up where it was: the OK from the phone, then the result');

    // Through ASI:One's planner a click arrives in its own words, without the id; it answers this chat's last card.
    say(owner, 'ask Ship it to the team?');
    await reply(owner, 'with the ship card');
    say(owner, 'Approved: the pending card interaction has been approved by the user. Please proceed.');
    const shipped = await reply(owner, 'with the ship result');
    d.check(shipped.text.startsWith('Done'), "a click relayed in the planner's words answered the chat's last card, and the task finished");

    // The box takes the chat agent for its own screen, so the chat holds itself to the tasks it started.
    const other = await d.api<Task>('POST', '/tasks', { title: 'A task from the portal', workspace: 'project', worker: 'fake', prompt: 'ask Deploy from the portal?' });
    const otherAsk = await d.waitFor('the portal task to ask', async () => (await d.api<Approval[]>('GET', '/approvals?state=pending')).find((a) => a.task === other.id));
    say(owner, JSON.stringify({ action: 'approve', approval: otherAsk.id }));
    const notYours = await reply(owner, "to approving the portal's task");
    say(owner, JSON.stringify({ action: 'undo', task: other.id }));
    await reply(owner, "to undoing the portal's task");
    const untouched = await d.api<{ task: Task; approvals: Approval[] }>('GET', `/tasks/${other.id}`);
    d.check(notYours.text.startsWith('That is not') && untouched.approvals[0]?.state === 'pending' && untouched.task.state === 'waiting', 'the chat cannot approve or undo a task it did not start');
    await d.api('POST', `/tasks/${other.id}/undo`);

    say(owner, 'status');
    const st = await reply(owner, 'to status');
    d.check(st.text.includes(t.id) && st.text.includes('undone'), '"status" lists the owner\'s tasks and their states');
  } finally {
    brain!.kill();
  }

  if (!(process.env.DEMO_LIVE ?? '').split(/[\s,]+/).includes('fetch')) {
    console.log('  skip  the agent on Agentverse and a chat through ASI:One: DEMO_LIVE=fetch ./demo runs them');
    return;
  }
  await live(d);
}

/** The real thing: the box's agent on Agentverse, reached by ASI:One's planner, running a Droid task. */
async function live(d: DemoKit) {
  const vault = fs.readFileSync(path.join(d.home, 'vault.env'), 'utf8');
  const asiKey = vault.match(/^ASI_ONE_API_KEY=(.+)$/m)?.[1].trim();
  d.check(/^AGENTVERSE_API_KEY=./m.test(vault) && asiKey, 'DEMO_LIVE=fetch: AGENTVERSE_API_KEY and ASI_ONE_API_KEY are in /etc/box/vault.env on this test machine');

  // One demo agent per test machine, so live runs do not pile up agents on Agentverse. The installed box has its own.
  const machineSeed = '/var/lib/box-fetch/demo-seed';
  if (!fs.existsSync(machineSeed)) {
    fs.mkdirSync(path.dirname(machineSeed), { recursive: true, mode: 0o700 });
    fs.writeFileSync(machineSeed, randomBytes(32).toString('hex'), { mode: 0o600 });
  }
  fs.mkdirSync(path.join(d.home, 'fetch'), { recursive: true });
  fs.copyFileSync(machineSeed, path.join(d.home, 'fetch', 'seed'));

  await d.api('POST', '/t/fetch/agent', { on: true, name: 'box-test' }); // the first time, setup.sh installs uAgents
  try {
    const agent = await d.waitFor('the agent to connect its Agentverse mailbox', async () => {
      const s = await d.api('GET', '/t/fetch/agent');
      return s.connected ? s : undefined;
    }, 120_000);
    d.check(String(agent.address).startsWith('agent1'), `the box's agent is on Agentverse with a mailbox: ${agent.address}`);
    d.check((await page(d)).includes(`pair ${agent.code}`), "the box's ASI:One page shows the agent's address and its pairing code");

    const hello = await planner(asiKey!, agent.address, ['Send the agent this exact message: hello']);
    d.check(hello.reply.includes('pair'), `ASI:One's planner reached the box through Agentverse, and the box answered: "${hello.reply.slice(0, 70)}..."`);
    const code = (await d.api('GET', '/t/fetch/agent')).code;
    const paired = await planner(asiKey!, agent.address, [`Send the agent this exact message: pair ${code}`]);
    d.check(paired.reply.startsWith('Paired'), 'the pairing code went through ASI:One and paired it as the owner');

    if (!/\bdroid\b/.test(process.env.DEMO_LIVE ?? '')) {
      console.log('  skip  the two chats that run real Droid tasks: DEMO_LIVE=fetch,droid ./demo runs them');
      return;
    }
    // The planner waits for the box's reply, and usually checks back until the task is done.
    const fix = await planner(asiKey!, agent.address, ['Ask the agent to fix the failing test in my project.']);
    const fixed = await finished(d, () => true); // the only Droid task so far
    const tests = spawnSync('node', ['--test'], { cwd: path.join(d.home, 'views', 'project') });
    d.check(fixed.state === 'done' && tests.status === 0, `ASI:One started Droid task ${fixed.id} on the box, and the project's tests pass now`);
    await delivered(d, fixed.id);
    d.check(true, `the result with the diff went back to the chat (the planner's last reply: "${fix.reply.slice(0, 70).replace(/\s+/g, ' ')}...")`);

    // Web search costs more than the task's budget, so the box asks with a card, and ASI:One shows it.
    const ask = ['Ask the agent to check if the Hario V60 paper filters (size 02, 100 count) are back in stock.'];
    const session = randomUUID();
    const card = await planner(asiKey!, agent.address, ask, session);
    const sel = card.card?.payload?.schema_payload?.approve_cta?.selection;
    const pending = await d.api<Approval[]>('GET', '/approvals?state=pending');
    d.check(card.card?.card_kind === 'review' && pending.some((a) => a.id === sel?.approval), `ASI:One shows the box's Interactive Card: "${card.reply.slice(0, 70)}..."`);
    // Droid may search more than once, and each search asks again, so approve the way a person would.
    const said = [...ask];
    let stock = card;
    for (let i = 0; i < 3 && (i === 0 || stock.card); i++) stock = await planner(asiKey!, agent.address, (said.push('Approve'), said), session);
    const answered = (await d.api<Approval[]>('GET', '/approvals')).find((a) => a.id === sel.approval);
    d.check(answered?.state === 'approved' && answered.by === 'asi1', 'Approve in ASI:One reached the box and answered the approval');
    const checked = await finished(d, (t) => t.id === answered!.task);
    await delivered(d, checked.id);
    d.check(checked.state === 'done', `the task finished, and the box sent its answer to the chat (the planner's last reply: "${stock.reply.slice(0, 70).replace(/\s+/g, ' ')}...")`);
  } finally {
    await d.api('POST', '/t/fetch/agent', { on: false });
  }
}

const finished = (d: DemoKit, which: (t: Task) => boolean) =>
  d.waitFor('the chat task to finish', async () => {
    const ts = await d.api<Task[]>('GET', '/tasks');
    return ts.find((t) => t.source === 'asi1' && t.worker === 'droid' && which(t) && ['done', 'failed'].includes(t.state));
  }, 300_000);

/** The brain sent everything it had to say about the task, and stopped following it. */
const delivered = (d: DemoKit, task: string) =>
  d.waitFor('the reply to leave the outbox', async () => {
    const s = JSON.parse(fs.readFileSync(path.join(d.home, 'fetch', 'agent', 'state.json'), 'utf8'));
    return s.outbox.length === 0 && s.chats[task]?.closed;
  }, 60_000);

/**
 * Ask ASI:One's planner to work with one agent: what that agent last said, and the card it last showed.
 * The planner sometimes answers on its own without messaging the agent, or misses an agent that just came up,
 * so an empty answer is asked again, up to three times.
 */
async function planner(key: string, address: string, messages: string[], session = randomUUID()) {
  let out = await plannerOnce(key, address, messages, session);
  for (let i = 0; i < 2 && !out.reply && !out.card; i++) {
    await new Promise((r) => setTimeout(r, 10_000));
    out = await plannerOnce(key, address, messages, session);
  }
  return out;
}

async function plannerOnce(key: string, address: string, messages: string[], session: string) {
  const r = await fetch('https://api.asi1.ai/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json', 'x-session-id': session },
    body: JSON.stringify({ model: 'asi1', stream: true, planner_mode: true, agents: [address], messages: messages.map((content) => ({ role: 'user', content })) }),
    signal: AbortSignal.timeout(290_000),
  });
  if (!r.ok) throw new Error(`ASI:One ${r.status}: ${await r.text()}`);
  // The stream carries partial plan updates; merge each task's fields as they come.
  const tasks = new Map<string, Record<string, any>>();
  for (const line of (await r.text()).split('\n')) {
    if (!line.startsWith('data:') || line.includes('[DONE]')) continue;
    for (const [p, phase] of Object.entries<any>(JSON.parse(line.slice(5)).metadata?.phases ?? {})) {
      for (const [i, task] of Object.entries<any>(phase.tasks ?? {})) tasks.set(`${p}.${i}`, { ...tasks.get(`${p}.${i}`), ...task });
    }
  }
  const ours = [...tasks.values()].filter((t) => t.agent_used?.agent_address === address || t.card_interaction_request?.agent_address === address);
  const last = ours.findLast((t) => t.agent_response || t.agent_card_response);
  return { reply: String(last?.agent_card_response?.chat_message ?? last?.agent_response ?? ''), card: last?.card_interaction_request };
}
