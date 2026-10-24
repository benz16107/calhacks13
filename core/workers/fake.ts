// A worker with no model, for tests and the demo. The prompt is a script, one command per line:
//   write <file> <text>     append <file> <text>     rm <file>     sleep <seconds>
//   expect <file> <text>    missing <file>           whoami <file>
//   call <tool> <json>      ask <question>           fetch <url> <file>      fail <message>
// Each finished line is logged as a step, so after a hard kill it carries on from the next line.
import fs from 'node:fs';
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
      const r = await call(sock, 'POST', '/call', { key: `line${n}`, tool: arg, input: text ? JSON.parse(text) : {} });
      if (!r.ok) throw new Error(`${arg}: ${r.error}`);
      note = `${line} -> ${JSON.stringify(r.output)}`;
      break;
    }
    case 'ask': {
      const question = [arg, text].join(' ');
      const r = await call(sock, 'POST', '/ask', { key: `line${n}`, question });
      if (!r.approved) throw new Error(`not approved: ${question}`);
      break;
    }
    case 'fetch': {
      const res = await fetch(arg);
      fs.writeFileSync(text, await res.text());
      break;
    }
    case 'fail':
      throw new Error([arg, text].join(' '));
    default:
      throw new Error(`unknown command: ${cmd}`);
  }
  await call(sock, 'POST', '/step', { text: note, data: { n } });
}
