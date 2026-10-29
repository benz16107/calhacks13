// gurtos: set up a GurtOS computer from another computer, one command per step, JSON out (AGENT-SETUP.md).
//   gurtos connect <url> <code> [name]   trade the code on the new computer's screen for a setup token
//   gurtos status | doctor | keys | apps | finish
//   gurtos owner <user>                  Personal: the computer's owner account
//   gurtos key set <NAME>                reads the key from stdin; it is never printed or logged
//   gurtos folders <path> [path...]      Personal: the folders agents may use
//   gurtos app on|off <id>               (also: gurtos apps add <id>)
//   gurtos budget <ask-over-dollars> <task-budget-dollars>
//   gurtos settings '<json>'             any other setting, checked by the computer
//   gurtos remote on [name]              its https address at <name>.box.gurtos.com
//   gurtos pair                          a link and code for the owner's phone
// The token is kept in ~/.config/gurtos/setup.json (0600) and stops working when setup finishes.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { client, connect, steps } from './setup-client.ts';

const file = path.join(os.homedir(), '.config', 'gurtos', 'setup.json');
const out = (v: unknown) => console.log(JSON.stringify(v, null, 1));
const fail = (message: string): never => {
  out({ ok: false, error: message });
  process.exit(1);
};
const dollars = (v: string | undefined, what: string) => {
  const text = String(v ?? '').trim().replace(/^\$/, '');
  const n = Number(text);
  return text && Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : fail(`${what}: a dollar amount, like 5 (usage: gurtos budget <ask-over-dollars> <task-budget-dollars>)`);
};
async function stdin() {
  if (process.stdin.isTTY) console.error('Paste the key, then press Enter and Ctrl-D. It is not shown or saved here.');
  let s = '';
  for await (const c of process.stdin) s += c;
  return s.trim();
}
// The usage is the comment at the top of this file.
const usage = () => fs.readFileSync(new URL(import.meta.url), 'utf8').split('\n').filter((l) => l.startsWith('//   ')).map((l) => l.slice(5)).join('\n');

const [cmd, ...args] = process.argv.slice(2);
if (!cmd || ['help', '--help', '-h'].includes(cmd)) {
  console.log(`Set up a GurtOS computer from this one (AGENT-SETUP.md). Each command prints JSON.\n\n${usage()}`);
  process.exit(cmd ? 0 : 1);
}
try {
  if (cmd === 'connect') {
    const [url, code, name] = args;
    if (!url || !code) fail('usage: gurtos connect <url> <code> [name]');
    const r = await connect(url, code, name);
    fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
    fs.writeFileSync(file, JSON.stringify({ url, token: r.token }), { mode: 0o600 });
    out({ ok: true, box: r.box });
  } else {
    const saved = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : undefined;
    if (!saved) fail('not connected: gurtos connect <url> <code> first');
    const api = client(saved.url, saved.token);
    const [a, b] = args;
    const run: Record<string, () => Promise<unknown>> = {
      status: () => steps.status(api),
      doctor: () => steps.doctor(api),
      keys: () => steps.keys(api),
      apps: () => (a === 'add' ? steps.app(api, b, true) : steps.apps(api)),
      finish: () => steps.finish(api),
      owner: () => steps.owner(api, a ?? fail('usage: gurtos owner <user>')),
      key: async () => {
        if (a !== 'set' || !b) fail('usage: gurtos key set <NAME>   (the key on stdin)');
        return steps.setKey(api, b, await stdin());
      },
      folders: () => (args.length ? steps.folders(api, args) : fail('usage: gurtos folders <path> [path...]')),
      app: () => (a === 'on' || a === 'off') && b ? steps.app(api, b, a === 'on') : fail('usage: gurtos app on|off <id>'),
      budget: () => steps.settings(api, { approvalThresholdCents: dollars(a, 'ask over'), defaultBudgetCents: dollars(b, 'task budget') }),
      settings: () => {
        let patch: Record<string, unknown>;
        try {
          patch = JSON.parse(a ?? fail("usage: gurtos settings '<json>'"));
        } catch {
          return fail(`settings: give the changes as JSON, like '{"defaultBudgetCents": 100}'`);
        }
        return steps.settings(api, patch);
      },
      remote: () => (a === 'on' ? steps.remote(api, b) : fail('usage: gurtos remote on [name]')),
      pair: () => steps.pair(api),
    };
    const f = run[cmd ?? ''] ?? fail(`unknown command ${cmd ?? '(none)'}: connect, status, doctor, keys, apps, finish, owner, key set, folders, app, budget, settings, remote on, pair`);
    out({ ok: true, result: await f() });
  }
} catch (e) {
  // A setup token ends when setup finishes, or two hours after it was made.
  if ((e as { status?: number }).status === 401) fail('This setup token no longer works: setup finished, or two hours passed. Ask for a new code on the computer\'s screen and run gurtos connect again.');
  fail((e as Error).message);
}
