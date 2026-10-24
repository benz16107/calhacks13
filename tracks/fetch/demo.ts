// The Fetch.ai track's demo step. Offline, it runs the box's agents in one process (local.py) instead of Agentverse,
// with the fake worker and an offline test-FET ledger: pairing, cards, the diff, Undo, a restart, routing to the app
// agents, a blocked instruction, payments both ways, another machine and a guest. DEMO_LIVE=fetch ./demo also starts
// the real agents on Agentverse and talks to them through ASI:One's API.
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import type { Approval, DemoKit, Task } from '../../core/contract.ts';

const HERE = path.dirname(new URL(import.meta.url).pathname);
type Card = { kind: string; payload: Record<string, any> };
type Out = { id: string; from: string; to: string; session: string; text: string; card?: Card; payment?: any };
/** The box's ASI:One page, as the box's own screen sees it. */
const page = async (d: DemoKit) => (await fetch(`http://127.0.0.1:${fs.readFileSync(path.join(d.home, 'api.port'), 'utf8').trim()}/t/fetch/`)).text();

export default async function (d: DemoKit) {
  d.check(d.view('project', 'split.js')?.includes('Math.floor'), 'the track made the "project" workspace: a small repo with a failing test');
  const off = await page(d);
  d.check(off.includes('agent is off') && !off.includes('Pairing code'), "the box's ASI:One page says the agent is off and how to turn it on, with no pairing code to misread");
  // The pairing code makes whoever sends it the agents' owner: a phone paired as anyone else must not see it.
  const { code: phoneCode } = await d.api<{ code: string }>('POST', '/api/pair/start', {});
  const phone = await d.api<{ token: string }>('POST', '/api/pair', { code: phoneCode, name: "A requester's phone" });
  const asPhone = (p: string) => fetch(`http://127.0.0.1:${fs.readFileSync(path.join(d.home, 'api.port'), 'utf8').trim()}/t/fetch${p}`, { headers: { authorization: `Bearer ${phone.token}` } });
  const refusedPage = await asPhone('/');
  const refusedStatus = await asPhone('/agent');
  d.check(refusedPage.status === 403 && refusedStatus.status === 403, "a phone paired as someone other than the owner gets 403 on the ASI:One page and the agents' status, which carry the pairing code");

  const state = fs.mkdtempSync(path.join(d.home, 'fetch-chat-'));
  const port = fs.readFileSync(path.join(d.home, 'api.port'), 'utf8').trim();
  // Offline: test FET goes to the box's own offline ledger, so the box checks payments the test agents make.
  const env = {
    PATH: process.env.PATH, PYTHONDONTWRITEBYTECODE: '1', BOX_API: `http://127.0.0.1:${port}`, FETCH_STATE: state, FETCH_WORKER: 'fake',
    FETCH_TOOLS: 'example.spend', FETCH_HOLD: '3', FETCH_LEDGER: 'offline', FETCH_LEDGER_FILE: path.join(d.home, 'fetch', 'ledger.json'),
  };
  fs.mkdirSync(path.join(d.home, 'fetch'), { recursive: true });
  let got: Out[] = [];
  let team: ChildProcess;
  let addresses: Record<string, string> = {};
  const start = () => {
    team = spawn('python3', [path.join(HERE, 'local.py')], { env, stdio: ['pipe', 'pipe', 'inherit'] });
    readline.createInterface({ input: team.stdout! }).on('line', (l) => {
      const m = JSON.parse(l);
      if (m.addresses) addresses = m.addresses;
      else got.push(m);
    });
  };
  const owner = `agent1q${randomBytes(26).toString('hex')}`;
  const stranger = `agent1q${randomBytes(26).toString('hex')}`;
  const guest = `agent1q${randomBytes(26).toString('hex')}`;
  const laptop = `agent1q${randomBytes(26).toString('hex')}`;
  const session = randomUUID();
  const say = (from: string, text: string, s: string = session) => team.stdin!.write(JSON.stringify({ from, session: s, text }) + '\n');
  /** The first message to `to` that matches; earlier ones that do not are dropped (progress, "still working"). */
  const expect = (to: string, what: string, ok: (m: Out) => unknown = () => true, ms = 15_000) =>
    d.waitFor(`a reply ${what}`, async () => {
      const i = got.findIndex((m) => m.to === to && ok(m));
      if (i < 0) return undefined;
      const m = got[i];
      got = got.filter((x, j) => j > i || x.to !== to);
      return m;
    }, ms).catch((e) => {
      if (!got.some((m) => m.to === to)) e.message += ' (nothing came back at all)';
      const near = got.filter((m) => m.to === to).slice(-3).map((m) => `    got instead: ${m.text.slice(0, 160).replace(/\n/g, ' ')}`);
      throw new Error([e.message, ...near].join('\n'));
    });
  const chatTasks = async () => (await d.api<Task[]>('GET', '/tasks')).filter((t) => t.source === 'asi1');
  const click = (card: Card | undefined, cta: 'approve_cta' | 'reject_cta') => JSON.stringify(card?.payload[cta]?.selection);
  /** The selection a custom card's button sends. */
  const button = (card: Card | undefined, label: string) => {
    let found: unknown;
    const walk = (v: any) => v && typeof v === 'object' && (v.type === 'button' && v.label === label ? (found = v.action.selection) : Object.values(v).forEach(walk));
    walk(card?.payload);
    return JSON.stringify(found);
  };
  const notes = async (kind: string) => (await d.api<any[]>('GET', '/log')).filter((e) => e.type === 'note' && e.data?.kind === kind);

  start();
  try {
    say(stranger, 'fix the failing test in my project');
    const no = await expect(stranger, 'to a stranger');
    d.check(no.text.includes('pair') && no.text.includes('turned it down') && (await chatTasks()).length === 0,
      "a stranger asking for real work gets the pairing step, and the box turns it down without bothering the owner");

    const { code } = JSON.parse(fs.readFileSync(path.join(state, 'state.json'), 'utf8'));
    say(owner, `pair ${code}`);
    const closed = await expect(owner, 'while pairing is closed');
    d.check(closed.text.startsWith('Pairing is closed'), "the right code does nothing until the box's own screen shows it: pairing is closed by default");
    fs.writeFileSync(path.join(state, 'pairing.json'), JSON.stringify({ opened: Date.now() / 1000 })); // what showing the page does
    say(owner, `pair ${code === '111111' ? '222222' : '111111'}`);
    const wrong = await expect(owner, 'to a wrong code');
    say(owner, `pair ${code}`);
    const paired = await expect(owner, 'to the right code');
    d.check(wrong.text.includes('not the code') && paired.text.startsWith('Paired'), 'a wrong pairing code is refused; the code from the box\'s screen pairs the owner');

    // The fake worker runs the chat text as its script: change a file, then spend $3 of test money.
    say(owner, 'write NOTES.md fixed by the box\ncall example.spend {"cents":300,"on":"a test purchase"}');
    const ask = await expect(owner, 'with an approval card', (m) => m.card?.kind === 'review');
    const [t] = await chatTasks();
    const pending = (await d.api<Approval[]>('GET', '/approvals?state=pending')).find((a) => a.task === t?.id);
    d.check(t && t.hosts.length === 0 && t.budgetCents === 25 && pending, `the chat started task ${t?.id}, with no network of its own and a 25 cent budget; spending $3.00 paused it`);
    const sel = ask.card?.payload.approve_cta?.selection;
    d.check(sel?.action === 'approve' && sel.approval === pending?.id, 'the chat got an ASI Interactive Card (review) with Approve and Deny for that approval');

    say(stranger, click(ask.card, 'approve_cta'));
    await expect(stranger, 'to a stranger clicking Approve');
    d.check((await d.api<Approval[]>('GET', '/approvals?state=pending')).some((a) => a.id === pending?.id), 'a stranger sending the same click approves nothing');

    say(owner, click(ask.card, 'approve_cta'));
    const done = await expect(owner, 'with the result', (m) => m.text.startsWith('Done'));
    const { approvals } = await d.api<{ approvals: Approval[] }>('GET', `/tasks/${t.id}`);
    d.check(approvals[0]?.state === 'approved' && approvals[0].by === 'asi1', 'clicking Approve in the chat answered it on the box, logged as asi1');
    d.check(done.text.includes('+fixed by the box') && d.view('project', 'NOTES.md') === 'fixed by the box', 'the task finished, and its reply carries the diff');
    const diffCard = JSON.stringify(done.card?.payload ?? {});
    d.check(done.card?.kind === 'custom' && diffCard.includes('added NOTES.md') && diffCard.includes('+fixed by the box'), 'the result is a diff card: the files it changed, the diff, and Keep and Undo buttons');

    say(owner, button(done.card, 'Undo'));
    const undone = await expect(owner, 'to Undo');
    d.check(undone.text.startsWith('Undone') && (await chatTasks())[0].state === 'undone' && !d.view('project', 'NOTES.md'), "the diff card's Undo button undid the task on the box");

    // A pull of the plug on the chat side: the OK comes from the phone while the agents are down.
    say(owner, 'ask Deploy the new build?');
    const deploy = await expect(owner, 'with the deploy card', (m) => m.card?.kind === 'review');
    team!.kill('SIGKILL');
    await d.api('POST', `/approvals/${deploy.card?.payload.approve_cta.selection.approval}`, { approved: true, by: 'phone' });
    start();
    // A busy test machine can take a while to start Python again, so these wait longer.
    const onPhone = await expect(owner, 'about the phone', (m) => m.text.startsWith('Approved on your phone'), 60_000);
    const deployed = await expect(owner, 'with the deploy result', (m) => m.text.startsWith('Done'), 60_000);
    d.check(onPhone && deployed, 'restarted, the agents picked up where they were: the OK from the phone, then the result');

    // Through ASI:One's planner a click arrives in its own words, without the id; it answers this chat's last card.
    say(owner, 'ask Ship it to the team?');
    await expect(owner, 'with the ship card', (m) => m.card?.kind === 'review');
    say(owner, 'Approved: the pending card interaction has been approved by the user. Please proceed.');
    d.check(await expect(owner, 'with the ship result', (m) => m.text.startsWith('Done')), "a click relayed in the planner's words answered the chat's last card, and the task finished");

    // The box takes the agents for its own screen, so the chat holds itself to the tasks it started.
    const other = await d.api<Task>('POST', '/tasks', { title: 'A task from the portal', workspace: 'project', worker: 'fake', prompt: 'ask Deploy from the portal?' });
    const otherAsk = await d.waitFor('the portal task to ask', async () => (await d.api<Approval[]>('GET', '/approvals?state=pending')).find((a) => a.task === other.id));
    say(owner, JSON.stringify({ action: 'approve', approval: otherAsk.id }));
    const notYours = await expect(owner, "to approving the portal's task");
    say(owner, JSON.stringify({ action: 'undo', task: other.id }));
    await expect(owner, "to undoing the portal's task");
    const untouched = await d.api<{ task: Task; approvals: Approval[] }>('GET', `/tasks/${other.id}`);
    d.check(notYours.text.startsWith('That is not') && untouched.approvals[0]?.state === 'pending' && untouched.task.state === 'waiting', 'the chat cannot approve or undo a task it did not start');
    await d.api('POST', `/tasks/${other.id}/undo`);

    // ---------- a team of agents: GurtOS routes to its app agents over the chat protocol ----------
    if (addresses.shopper) {
      say(owner, 'Is the Hario V60 filter back in stock?');
      const shop = await expect(owner, 'from the Shopper agent', (m) => m.text.startsWith('GurtOS Shopper') && m.text.includes('Hario'), 45_000);
      d.check(shop.text.includes(addresses.shopper.slice(0, 12)) && /Hario V60/.test(shop.text) && /in stock|not in stock/.test(shop.text),
        `GurtOS routed a price question to its Shopper agent (${addresses.shopper.slice(0, 14)}...), which checked the store and answered: "${shop.text.split('\n').find((l) => l.startsWith('> -'))?.replace(/^> /, '').trim()}"`);
    }
    if (addresses['credit-desk']) {
      say(owner, 'Run the credit desk on the Fogline case');
      const fraud = await expect(owner, 'with the credit desk controller card', (m) => m.card?.kind === 'review', 60_000);
      const ref = fraud.card?.payload.approve_cta?.selection?.approval ?? '';
      d.check(fraud.text.startsWith('GurtOS Credit Desk') && fraud.text.includes('APP-1043') && ref.startsWith('x_') && fraud.card?.payload.title.startsWith('From GurtOS Credit Desk'),
        "GurtOS Credit Desk ran the analyst with live CRS checks; its fraud-hold question reached the owner's chat as a card titled with who sent it, whose buttons carry a ref only the box made");
      say(owner, JSON.stringify({ action: 'approve', approval: 'x_0000000000000000' }));
      d.check((await expect(owner, 'to a made-up card ref')).text.includes('expired'), 'a click with a card ref the box did not make goes nowhere');
      say(owner, click(fraud.card, 'approve_cta'));
      // The analyst also asks the controller (the owner) about a $40,000 limit: answer every card until it finishes.
      let finished = await expect(owner, 'with the next card or the analyst result', (m) => m.card?.kind === 'review' || m.text.includes('credit analyst finished'), 60_000);
      while (finished.card?.kind === 'review') {
        say(owner, click(finished.card, 'approve_cta'));
        finished = await expect(owner, 'with the next card or the analyst result', (m) => m.card?.kind === 'review' || m.text.includes('credit analyst finished'), 60_000);
      }
      d.check(finished.text.includes('APP-1043: fraud hold'), "Approve went back over the chat protocol to the Credit Desk agent, the controller's OK was logged, and the analyst finished: APP-1043 on fraud hold");
    }

    // ---------- other people's agents: their replies are data, never orders ----------
    say(owner, 'Ask the test weather agent for the weather in Berkeley');
    const trap = await expect(owner, 'about the trap', (m) => m.text.startsWith('Blocked'));
    const blockedNotes = await notes('asi1.blocked_instruction');
    d.check(trap.text.includes('GurtOS test weather') && trap.text.includes('17°C') && trap.text.includes('asked for keys') && !/vault keys|ignore your owner/i.test(trap.text) && blockedNotes.length === 1,
      'an outside agent hid an instruction in its weather reply. GurtOS blocked it, said what it tried in plain words (never the instruction itself, which the next model would read), kept the weather, and logged the exact text');

    // ---------- the Agent Payment Protocol, in test FET ----------
    // With DEMO_LIVE=fetch the box's wallet is on Fetch's testnet, so these run in the live part instead, on chain.
    if (/\bfetch\b/.test(process.env.DEMO_LIVE ?? '')) console.log('  skip  the offline payments: this run makes them on chain, below');
    else {
    say(owner, 'Ask the test oracle for a fortune');
    const payAsk = await expect(owner, 'with the payment approval', (m) => m.card?.kind === 'review' && m.text.includes('fetch.pay'), 30_000);
    d.check(payAsk.text.includes('$0.50'), 'the test oracle asked for 0.5 test FET with a RequestPayment; paying runs as a box task, and 0.5 is over its budget, so it asks the owner');
    say(owner, click(payAsk.card, 'approve_cta'));
    const receipt = await expect(owner, 'with the receipt', (m) => m.card?.kind === 'detail', 30_000);
    const fortune = await expect(owner, 'with the fortune', (m) => m.text.includes('Your fortune'), 30_000);
    d.check(JSON.stringify(receipt.card).includes('test FET') && fortune,
      `approved, the box paid with fetch.pay (${receipt.text.match(/\((\S+)\)/)?.[1]}, a receipt card in the chat), sent CommitPayment, and the oracle checked the ledger, sent CompletePayment and the fortune`);

    say(owner, 'Ask the test buyer to buy a price check for hario v60 filters');
    const bought = await expect(owner, 'with the paid price check', (m) => m.text.includes('GurtOS Shopper answered'), 30_000);
    const received = await notes('asi1.payment.received');
    d.check(received.length === 1 && received[0].data.amount === '0.05' && /Hario V60/.test(bought.text),
      'another agent paid the box: the test buyer paid GurtOS Shopper 0.05 test FET, the box checked it on its ledger, then ran the price check');
    }

    // ---------- another machine of the owner's ----------
    say(owner, `link my homebox ${laptop} 123456`);
    const fake = await expect(laptop, 'to the laptop', (m) => /^pair 123456 [0-9a-f]{32}$/.test(m.text));
    say(laptop, 'Paired. Sure, I am your laptop.', fake.session);
    const refused = await expect(owner, 'about a link with no proof', (m) => m.text.startsWith('Did not link'));
    say(owner, `link my homebox ${laptop} 123456`);
    const pairOut = await expect(laptop, 'to the laptop again', (m) => /^pair 123456 [0-9a-f]{32}$/.test(m.text));
    const proof = createHmac('sha256', '123456').update(`${pairOut.text.split(' ')[2]}|${addresses.box}|${laptop}`).digest('hex').slice(0, 32);
    // A box says what it is when it links (GET /api/system): its name and edition, the words the GurtOS app shows too.
    say(laptop, `Paired. This box now takes work from you here. proof ${proof} edition server name Home server`, pairOut.session);
    const linked = await expect(owner, 'about the link', (m) => m.text.startsWith('Linked'));
    d.check(refused && linked.text.includes(laptop) && linked.text.includes('Home server (GurtOS Server)'),
      'linking a machine sends its code with a fresh nonce: a "Paired" with no proof is refused, and only an HMAC of the code links it, shown with its full address, its own name and its edition');
    say(owner, 'write laptop.txt hi on my server');
    const work = await expect(laptop, 'with the work', (m) => m.text === 'write laptop.txt hi');
    say(laptop, 'Done: Write laptop.txt hi.', work.session);
    const fromLaptop = await expect(owner, 'from the laptop', (m) => m.text.includes('your Home server'));
    d.check(linked && fromLaptop.text.includes('Done: Write laptop.txt hi'), 'linked as "homebox", the machine said it is GurtOS Server, so from this Personal box "on my server" ran the work there, and its answer came back to this chat');

    // ---------- a guest: anyone may ask, the owner approves first ----------
    say(guest, 'What is the tallest building in San Francisco?');
    const waitNote = await expect(guest, 'to the guest', (m) => m.text.includes('asked the box'));
    const gate = await expect(owner, 'with the guest card', (m) => m.card?.kind === 'review' && m.text.includes('A guest'));
    d.check(waitNote && gate, "a guest's lookup waits for the owner: the request reached the owner's chat (and phone) as an Approve card, and nothing ran");
    say(owner, click(gate.card, 'approve_cta'));
    const answered = await expect(guest, 'with the guest answer', (m) => m.text.startsWith('Done'), 30_000);
    const guestTask = (await d.api<Task[]>('GET', '/tasks')).find((x) => x.title === 'Guest lookup: approved');
    const shared = guestTask?.source.startsWith('guest-run:') ? "through the Mana app's guest route, which holds one set of limits for every front door" : 'through its own copy of the guest rules (the Mana app is off)';
    d.check(answered && guestTask?.workspace === 'guest' && guestTask.hosts.length === 0, `approved, it ran ${shared}, in the empty guest workspace with no network of its own, and only the guest got the answer`);

    say(owner, 'status');
    const st = await expect(owner, 'to status', (m) => m.text.includes('Your latest tasks'));
    d.check(/: (done|undone|waiting|running), \$/.test(st.text), `"status" lists the owner's five latest tasks, each with its state and cost`);
  } finally {
    team!.kill();
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

  // One demo team per test machine, so live runs do not pile up agents on Agentverse. The installed box has its own.
  const machineSeed = '/var/lib/box-fetch/demo-seed';
  if (!fs.existsSync(machineSeed)) {
    fs.mkdirSync(path.dirname(machineSeed), { recursive: true, mode: 0o700 });
    fs.writeFileSync(machineSeed, randomBytes(32).toString('hex'), { mode: 0o600 });
  }
  fs.mkdirSync(path.join(d.home, 'fetch'), { recursive: true });
  fs.copyFileSync(machineSeed, path.join(d.home, 'fetch', 'seed'));
  const agentState = (name: string) => JSON.parse(fs.readFileSync(path.join(d.home, 'fetch', 'agent', ...(name === 'box' ? [] : [name]), 'state.json'), 'utf8'));
  const noteOf = async (kind: string, since = 0) => (await d.api<any[]>('GET', `/log?after=${since}`)).find((e) => e.type === 'note' && e.data?.kind === kind);

  await d.api('POST', '/t/fetch/agent', { on: true, name: 'GurtOS (test)', testAgents: true }); // the first time, setup.sh installs uAgents
  try {
    const agent = await d.waitFor('every agent to connect its Agentverse mailbox', async () => {
      const s = await d.api('GET', '/t/fetch/agent');
      return s.connected && s.agents?.every((a: any) => a.connected) ? s : undefined;
    }, 180_000);
    const team = agent.agents.filter((a: any) => a.name !== 'box');
    d.check(String(agent.address).startsWith('agent1') && team.length >= 3,
      `the box's agent and ${team.length} more are on Agentverse with mailboxes: ${team.map((a: any) => a.label).join(', ')}`);
    d.check((await page(d)).includes(`pair ${agent.code}`), "the box's ASI:One page shows the team and the pairing code, which opens pairing for 10 minutes");

    const hello = await planner(asiKey!, agent.address, ['Send the agent this exact message: hello']);
    d.check(hello.reply.includes('pair'), `ASI:One's planner reached the box through Agentverse, and the box answered: "${hello.reply.slice(0, 70)}..."`);
    const code = (await d.api('GET', '/t/fetch/agent')).code;
    const paired = await planner(asiKey!, agent.address, [`Send the agent this exact message: pair ${code}`]);
    d.check(paired.reply.startsWith('Paired'), 'the pairing code went through ASI:One and paired it as the owner');

    // Someone else's agent, over Agentverse: Fetch.ai's own Weather Agent. Its answer is relayed as screened data.
    const weather = await planner(asiKey!, agent.address, ["Send the agent this exact message: What's the weather in Berkeley, California?"]);
    d.check(/Weather Agent \(Fetch\.ai\)/.test(weather.reply) && /°|temperature|clear|cloud|rain/i.test(weather.reply),
      `GurtOS asked Fetch.ai's Weather Agent over the chat protocol and relayed its answer as a quote: "${weather.reply.replace(/\s+/g, ' ').slice(0, 90)}..."`);

    // Our trap agent, over Agentverse: its hidden instruction is blocked and logged.
    const before = (await d.api<any[]>('GET', '/log')).length;
    const trap = await planner(asiKey!, agent.address, ['Send the agent this exact message: Ask the test weather agent for the weather in Berkeley']);
    const blocked = await d.waitFor('the blocked instruction in the log', () => noteOf('asi1.blocked_instruction', before), 60_000);
    d.check(blocked && !/vault keys|ignore your owner/i.test(trap.reply),
      `GurtOS test weather hid an instruction in its reply over Agentverse; GurtOS blocked and logged it, and ASI:One saw only: "${trap.reply.replace(/\s+/g, ' ').slice(0, 90)}..."`);

    // Paying another agent on Fetch's testnet: 0.5 test FET is over the box's budget, so the owner approves (as the phone would).
    await planner(asiKey!, agent.address, ['Send the agent this exact message: Ask the test oracle for a fortune']);
    const ask = await d.waitFor('the payment to ask the owner', async () => (await d.api<Approval[]>('GET', '/approvals?state=pending')).find((a) => a.question.includes('fetch.pay')), 90_000);
    d.check(ask, `the test oracle sent a RequestPayment over Agentverse; GurtOS paused for the owner: "${ask.question.slice(0, 90)}..."`);
    await d.api('POST', `/approvals/${encodeURIComponent(ask.id)}`, { approved: true, by: 'phone' });
    const paid = await d.waitFor('the oracle to see the payment', async () => {
      const sales = Object.values<any>(agentState('test-oracle').sales);
      return sales.find((x) => x.state === 'paid') ? sales : undefined;
    }, 180_000);
    const tx = (await d.api<{ events: any[] }>('GET', `/tasks/${ask.task}`)).events.find((e) => e.type === 'tool.result' && e.ok)?.output;
    d.check(paid && tx?.tx && !tx.simulated, `approved, the box paid 0.5 test FET on Fetch's Dorado testnet (${tx?.tx?.slice(0, 16)}...), and the oracle checked it on chain and answered`);

    // Another agent pays the box: the test buyer buys a price check from GurtOS Shopper with its own test FET.
    const since = (await d.api<any[]>('GET', '/log')).length;
    await planner(asiKey!, agent.address, ['Send the agent this exact message: Ask the test buyer to buy a price check for hario v60 filters']);
    const got = await d.waitFor('the Shopper to be paid', () => noteOf('asi1.payment.received', since), 240_000);
    d.check(got && !got.data.simulated && got.data.amount === '0.05',
      `the test buyer paid GurtOS Shopper 0.05 test FET on chain (${String(got?.data.tx).slice(0, 16)}...); the box checked it and ran the price check`);

    if (!/\bdroid\b/.test(process.env.DEMO_LIVE ?? '')) {
      console.log('  skip  the chat that runs a real Droid task: DEMO_LIVE=fetch,droid ./demo runs it');
      return;
    }
    // The planner waits for the box's reply, and usually checks back until the task is done.
    const fix = await planner(asiKey!, agent.address, ['Ask the agent to fix the failing test in my project.']);
    const fixed = await finished(d, (t) => t.workspace === 'project');
    const tests = spawnSync('node', ['--test'], { cwd: path.join(d.home, 'views', 'project') });
    d.check(fixed.state === 'done' && tests.status === 0, `ASI:One started Droid task ${fixed.id} on the box, and the project's tests pass now`);
    await delivered(d, fixed.id);
    d.check(true, `the result with the diff card went back to the chat (the planner's last reply: "${fix.reply.slice(0, 70).replace(/\s+/g, ' ')}...")`);
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
