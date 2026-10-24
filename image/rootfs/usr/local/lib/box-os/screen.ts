// The page on the box's own screen, at 127.0.0.1:7780. A placeholder until the portal lands: it shows the pairing
// QR code, whether the box service is healthy, and which system slot and build are running.
// Runs as a throwaway user. systemd hands it /etc/box/pairing.json (root only) as a credential.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';

const pairing = JSON.parse(fs.readFileSync(`${process.env.CREDENTIALS_DIRECTORY}/pairing`, 'utf8'));
const qr = execFileSync('qrencode', ['-t', 'SVG', '--inline', '-m', '1', '-o', '-', pairing.url], { encoding: 'utf8' });
const build = fs.readFileSync('/etc/box-os/release', 'utf8').match(/^BUILD=(.*)$/m)?.[1] ?? '';
const slot = fs.readFileSync('/proc/cmdline', 'utf8').match(/box\.slot=(\w)/)?.[1];
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

async function status() {
  const health = await fetch('http://127.0.0.1:7700/health', { signal: AbortSignal.timeout(2000) })
    .then((r) => r.json())
    .catch(() => null);
  const addresses = Object.values(os.networkInterfaces())
    .flat()
    .filter((a) => a && !a.internal && a.family === 'IPv4')
    .map((a) => a!.address);
  return { box: pairing.box, healthy: health?.ok === true, tasks: health?.tasks ?? 0, addresses, build,
    system: slot ? `system ${slot.toUpperCase()}` : 'the install disc' };
}

const page = `<!doctype html>
<meta charset="utf-8">
<title>Box ${esc(pairing.box)}</title>
<style>
  body { margin: 0; height: 100vh; display: grid; place-items: center; background: #f2efe8; color: #1c1b19;
         font: 22px/1.45 "DejaVu Sans", sans-serif; }
  main { text-align: center; max-width: 80vw; }
  h1 { font-size: 34px; margin: 0 0 4px; }
  svg { width: min(46vh, 70vw); height: auto; margin: 16px 0; }
  .url { font-size: 14px; word-break: break-all; color: #57534b; }
  #status { font-weight: bold; }
  .down { color: #9a2a1a; }
</style>
<main>
  <h1>Box ${esc(pairing.box)}</h1>
  <p>Scan this code with your phone to pair the box with your portal.</p>
  ${qr}
  <p class="url">${esc(pairing.url)}</p>
  <p id="status">Starting the box…</p>
  <p id="info"></p>
</main>
<script>
  async function tick() {
    try {
      const s = await (await fetch('/status')).json();
      const st = document.getElementById('status');
      st.textContent = s.healthy ? 'The box is running. Tasks: ' + s.tasks : 'The box service is not up yet';
      st.className = s.healthy ? '' : 'down';
      document.getElementById('info').textContent =
        [s.addresses.join(', ') || 'no network', s.system, 'build ' + s.build].join(' · ');
    } catch {}
  }
  tick();
  setInterval(tick, 2000);
</script>
`;

http
  .createServer(async (req, res) => {
    if (req.url === '/status') {
      res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(await status()));
    } else {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(page);
    }
  })
  .listen(7780, '127.0.0.1');
