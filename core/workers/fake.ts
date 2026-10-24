// A worker with no model, for tests and the demo. The prompt is a script, one command per line:
//   write <file> <text>     append <file> <text>     rm <file>     sleep <seconds>     mkdir <dir>
//   expect <file> <text>    missing <file>           whoami <file>
//   call <tool> <json>      ask <question>           fetch <url> <file>      fail <message>
//   askq <question>         (asks with the question as the key, so the approval id has spaces)
//   callpar <tool> <json>   (two different calls at once: tests the budget reservation)
//   callsame <tool> <json>  (the same call twice at once: tests idempotent dedup)
//   steal <file> <out>      env <out>                connect <host:port> <out>      procs <out>
// The last four, and fetch, write what happened instead of failing: they act out a hijacked agent.
// Each finished line is logged as a step, so after a hard kill it carries on from the next line.
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import { call } from '../client.ts';

const sock = process.env.BOX_SOCKET!;
const { task, steps } = await call(sock, 'GET', '/task');
const done = Math.max(0, ...steps.map((s: { data?: { n?: number } }) => s.data?.n ?? 0));
const lines: string[] = task.prompt.split('\n').map((l: string) => l.trim()).filter(Boolean);
if (done) console.log(`resuming after line ${done}`);

for (let n = done + 1; n <= lines.length; n++) {
  const line = lines[n - 1];
  const [cmd, arg = '', ...rest] = line.split(/\s+/);
  const text = rest.join(' ');
  let note = line;
  switch (cmd) {
    case 'write':
      fs.writeFileSync(arg, text + '\n');
      break;
    case 'append':
      fs.appendFileSync(arg, text + '\n');
      break;
    case 'mkdir':
      fs.mkdirSync(arg, { recursive: true });
      break;
    case 'rm':
      fs.rmSync(arg);
      break;
    case 'sleep':
      await new Promise((r) => setTimeout(r, Number(arg) * 1000));
      break;
    case 'expect': {
      const got = fs.existsSync(arg) ? fs.readFileSync(arg, 'utf8').trim() : '(missing)';
      if (got !== text) throw new Error(`${arg} is "${got}", expected "${text}"`);
      break;
    }
    case 'missing':
      if (fs.existsSync(arg)) throw new Error(`${arg} should not exist here`);
      break;
    case 'whoami':
      fs.writeFileSync(arg, os.userInfo().username + '\n');
      break;
    case 'call': {
      let r;
      do {
        r = await call(sock, 'POST', '/call', { key: `line${n}`, tool: arg, input: text ? JSON.parse(text) : {} });
      } while (r.pending); // keep checking past the approval wait window
      if (!r.ok) throw new Error(`${arg}: ${r.error}`);
      note = `${line} -> ${JSON.stringify(r.output)}`;
      break;
    }
    case 'callpar':
    case 'callsame': {
      // callpar: two different calls at once (different actions) to test the budget reservation.
      // callsame: the same call twice at once (one action) to test idempotent dedup.
      const base = text ? JSON.parse(text) : {};
      const once = async (suffix: string) => {
        const input = cmd === 'callpar' ? { ...base, _par: suffix } : base;
        let r;
        do {
          r = await call(sock, 'POST', '/call', { key: `line${n}${suffix}`, tool: arg, input });
        } while (r.pending);
        return r;
      };
      const [ra, rb] = await Promise.all([once('a'), once('b')]);
      note = `${line} -> ${[ra, rb].map((r) => (r.ok ? 'ok' : r.error)).join(', ')}`;
      break;
    }
    case 'ask':
    case 'askq': {
      const question = [arg, text].join(' ');
      // 'askq' keys the approval by the question text itself, so its id contains spaces (like Droid's questions).
      const key = cmd === 'askq' ? question : `line${n}`;
      let r;
      do {
        r = await call(sock, 'POST', '/ask', { key, question });
      } while (r.pending); // wait past the window, as long as it takes
      if (!r.approved) throw new Error(`not approved: ${question}`);
      break;
    }
    case 'fetch': {
      const out = await fetch(arg).then(
        async (r) => (r.ok ? await r.text() : `blocked: HTTP ${r.status}`),
        (e) => `blocked: ${e.cause?.message ?? e.message}`,
      );
      fs.writeFileSync(text, out);
      break;
    }
    case 'steal':
      try {
        fs.writeFileSync(text, fs.readFileSync(arg, 'utf8'));
      } catch (e) {
        fs.writeFileSync(text, `denied: ${(e as NodeJS.ErrnoException).code}`);
      }
      break;
    case 'env':
      fs.writeFileSync(arg, JSON.stringify(process.env, null, 1));
      break;
    case 'connect': {
      const [host, port] = arg.split(':');
      const out = await new Promise<string>((resolve) => {
        const s = net.connect(Number(port), host, () => (s.destroy(), resolve('connected')));
        s.on('error', (e: NodeJS.ErrnoException) => resolve(`blocked: ${e.code}`));
        s.setTimeout(3000, () => (s.destroy(), resolve('blocked: timeout')));
      });
      fs.writeFileSync(text, out);
      break;
    }
    case 'procs': {
      // The users of every process this task can see.
      const pids = fs.readdirSync('/proc').filter((d) => /^\d+$/.test(d));
      const uids = new Set(pids.flatMap((p) => { try { return [fs.statSync(`/proc/${p}`).uid]; } catch { return []; } }));
      fs.writeFileSync(arg, [...uids].join(','));
      break;
    }
    case 'fail':
      throw new Error([arg, text].join(' '));
    default:
      throw new Error(`unknown command: ${cmd}`);
  }
  await call(sock, 'POST', '/step', { text: note, data: { n } });
}
