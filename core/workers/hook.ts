// Droid's hooks (Factory's PreToolUse and PostToolUse), set up by workers/droid.ts in the task user's ~/.factory.
// Runs inside the task, holds no secrets, and talks only to the task's broker socket.
//   pre:  before every Execute. A risky command waits for the owner's OK; turned down, Droid is told no.
//   post: after every tool. Logs what came back, so each call and its result are in the action log.
import { createHash } from 'node:crypto';
import { call } from '../client.ts';

// Commands that change things outside the task's copy, or can't be taken back. The OS still limits the rest.
export const RISKY = /(^|[;&|(]\s*|\bsudo\s+)(sudo|rm\s+-\w*[rf]|git\s+(push|reset\s+--hard|clean\s+-\w*f)|npm\s+publish|chmod\s+-R|chown|dd\s|mkfs|shutdown|reboot|kill\s+-9|curl\b[^|]*\|\s*(ba|z)?sh)/;

const sock = process.env.BOX_SOCKET!;
const short = (v: unknown, n = 300) => (typeof v === 'string' ? v : JSON.stringify(v ?? '')).slice(0, n);

const mode = process.argv[2];
if (mode === 'pre' || mode === 'post') {
  let input = '';
  for await (const chunk of process.stdin) input += chunk;
  const e = JSON.parse(input);
  try {
    if (mode === 'pre') {
      const cmd = String(e.tool_input?.command ?? '');
      if (RISKY.test(cmd)) {
        const key = `hook.${createHash('sha256').update(cmd).digest('hex').slice(0, 12)}`;
        let r: { pending?: boolean; approved?: boolean };
        do r = await call(sock, 'POST', '/ask', { key, question: `Droid wants to run a risky command: ${cmd.slice(0, 500)}` });
        while (r.pending);
        if (!r.approved) {
          const out = { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: 'The box owner turned this command down.' } };
          process.stdout.write(JSON.stringify(out));
        }
      }
    } else {
      const tool = String(e.tool_name ?? 'tool');
      const sub = tool === 'Task' ? e.tool_input?.subagent_type : undefined;
      const text = sub ? `${sub} finished: ${short(e.tool_response)}` : `${tool} done: ${short(e.tool_response, 160)}`;
      await call(sock, 'POST', '/step', { text, data: { hook: 'PostToolUse', tool, ...(sub ? { droid: sub, result: short(e.tool_response, 4000) } : {}) } });
    }
  } catch (err) {
    console.error(`box hook: ${(err as Error).message}`); // a broken hook must not stop Droid (non-blocking exit 1)
    process.exit(1);
  }
}
