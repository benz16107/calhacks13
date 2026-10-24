// The Fetch.ai track: the box is an agent on Agentverse that ASI:One can find. From an ASI:One chat its owner
// asks for work; the box runs it as a task and replies with progress, Approve and Deny cards, and the diff.
// agent.py (uAgents) carries the chat over an Agentverse mailbox. brain.py turns each message into calls on the
// box's own API, the one the portal and phone use. This file starts the agent and keeps it running. See README.md.
import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import type { Box, Track } from '../../core/contract.ts';

const HOME = process.env.BOX_HOME ?? '/var/lib/box';
const DIR = path.join(HOME, 'fetch'); // the agent's seed (root only) and its on switch
const STATE = path.join(DIR, 'agent'); // the agent's own files: owners, pairing code, chats, status
const ON = path.join(DIR, 'on');
const HERE = path.dirname(new URL(import.meta.url).pathname);
const PYTHON = '/opt/box-fetch/venv/bin/python'; // made by setup.sh
const NOBODY = 65534; // the agent runs unprivileged: it can use the box's API, but cannot read the vault

/** The agent's name on Agentverse, kept in ON across restarts. */
type Conf = { name?: string };

let agent: ChildProcess | undefined;
let starting: Promise<void> | undefined;
let settings: { keys: Record<string, string>; conf: Conf } = { keys: {}, conf: {} }; // what the agent runs with

const readJson = (file: string) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return undefined;
  }
};

function status() {
  const brain = readJson(path.join(STATE, 'state.json'));
  return { on: fs.existsSync(ON), running: !!agent, ...readJson(path.join(STATE, 'status.json')), code: brain?.code, owners: brain?.owners?.length ?? 0 };
}

/** Start agent.py, unless the switch is off or it runs already. Restarts it 5 s after it stops. */
function launch() {
  if (!fs.existsSync(ON) || agent) return;
  const seed = path.join(DIR, 'seed'); // each box is its own agent, with its own address
  if (!fs.existsSync(seed)) fs.writeFileSync(seed, randomBytes(32).toString('hex'), { mode: 0o600 });
  fs.mkdirSync(STATE, { recursive: true, mode: 0o700 });
  fs.chownSync(STATE, NOBODY, NOBODY);
  const env: Record<string, string> = {
    PATH: '/usr/bin:/bin',
    HOME: STATE,
    PYTHONDONTWRITEBYTECODE: '1',
    PYTHONUNBUFFERED: '1',
    BOX_API: `http://127.0.0.1:${fs.readFileSync(path.join(HOME, 'api.port'), 'utf8').trim()}`,
    FETCH_STATE: STATE,
    FETCH_AGENT_SEED: fs.readFileSync(seed, 'utf8').trim(),
    ...settings.keys,
    ...(settings.conf.name && { FETCH_AGENT_NAME: settings.conf.name }),
  };
  const child = spawn(PYTHON, [path.join(HERE, 'agent.py')], { cwd: STATE, uid: NOBODY, gid: NOBODY, env, stdio: ['ignore', 'inherit', 'inherit'] });
  agent = child;
  child.on('exit', (code, signal) => {
    agent = undefined;
    if (!fs.existsSync(ON)) return;
    console.error(`fetch: the ASI:One agent stopped (${signal ?? code}); starting it again in 5 s`);
    setTimeout(() => {
      try {
        launch();
      } catch (e) {
        console.error('fetch: restart failed:', e);
      }
    }, 5000);
  });
}

/** Turn the agent on ({on: true}, optionally with a name), off ({on: false}), or back on as it was ({}). */
async function agentSwitch(box: Box, input: { on?: boolean } & Conf) {
  if (input?.on === false) {
    fs.rmSync(ON, { force: true });
    agent?.kill();
    return status();
  }
  const conf: Conf = input?.on ? { name: input.name && String(input.name).slice(0, 80) } : (readJson(ON) ?? {});
  const secret = (name: string) => {
    try {
      return box.secret(name);
    } catch {
      return '';
    }
  };
  const keys = { AGENTVERSE_API_KEY: secret('AGENTVERSE_API_KEY'), ASI_ONE_API_KEY: secret('ASI_ONE_API_KEY') };
  if (!keys.AGENTVERSE_API_KEY) throw new Error('the vault has no AGENTVERSE_API_KEY, which the Agentverse mailbox needs');
  fs.mkdirSync(DIR, { recursive: true });
  fs.chmodSync(DIR, 0o711); // the agent may pass through to its own folder; the seed stays root only
  fs.writeFileSync(ON, JSON.stringify(conf));
  if (agent && JSON.stringify(settings) !== JSON.stringify({ keys, conf })) agent.kill(); // it restarts with the new ones
  settings = { keys, conf };
  starting ??= (async () => {
    if (!agent) await promisify(execFile)(path.join(HERE, 'setup.sh'), { timeout: 600_000 });
    launch();
  })().finally(() => (starting = undefined));
  await starting;
  return status();
}

export default {
  name: 'fetch',
  secrets: ['AGENTVERSE_API_KEY', 'ASI_ONE_API_KEY'], // handed to the agent: its mailbox, and ASI:One's model

  triggers: [
    {
      name: 'asi1',
      start(box) {
        box.workspace('project', path.join(HERE, 'project')); // the sample repo with a failing test
        if (fs.existsSync(ON)) {
          agentSwitch(box, {}).catch((e) => console.error('fetch: the ASI:One agent did not start:', (e as Error).message));
        }
      },
    },
  ],

  routes: {
    // A plain page until the portal shows this app. It has the pairing code the owner types into ASI:One.
    'GET /': (_req, box) => {
      const s = status();
      const esc = (v: unknown) => String(v ?? '').replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
      let hasKey = true;
      try {
        box.secret('AGENTVERSE_API_KEY');
      } catch {
        hasKey = false;
      }
      const agent = s.address ? ` <strong>${esc(s.name)}</strong> <code>${esc(s.address)}</code>` : '';
      const state = s.connected && s.running
        ? `The agent${agent} is on, with its Agentverse mailbox.`
        : !hasKey
          ? 'The agent is off: the vault has no AGENTVERSE_API_KEY, which its Agentverse mailbox needs.'
          : !s.on
            ? 'The agent is off. Turn it on from the box with <code>POST /t/fetch/agent {"on": true}</code>.'
            : `The agent${agent} is starting: ${esc(s.running ? (s.error ?? 'connecting to Agentverse') : 'it stopped and starts again in a few seconds')}.`;
      // The code is useful only while the agent can take it.
      const pairing = s.connected && s.running && s.code
        ? `<p>Pairing code: <strong>${esc(s.code)}</strong>. Send <code>pair ${esc(s.code)}</code> to the agent in ASI:One. It works once.</p>`
        : '';
      const html = `<!doctype html><title>ASI:One agent</title><h1>ASI:One agent</h1>
<p>${state}</p>${pairing}
<p>Owners paired: ${s.owners}.</p>`;
      return new Response(html, { headers: { 'content-type': 'text/html' } });
    },
    'GET /agent': () => Response.json(status()),
    // {on: true} starts the agent and keeps it on across restarts; {on: false} stops it. {on: true, name} renames it.
    'POST /agent': async (req, box) => Response.json(await agentSwitch(box, await req.json().catch(() => ({})))),
  },

  apps: [{ name: 'asi1', title: 'ASI:One', href: '/' }],
} satisfies Track;
