#!/usr/bin/env -S node --experimental-strip-types --disable-warning=ExperimentalWarning
// Put the real GurtOS disc on a Vultr instance: add the ISO from a URL (or reuse one), make an instance that boots
// it, wait until the installer has had time to finish, detach the disc, and print the console address where the
// box's setup wizard is. Timings are printed so a README can quote them.
//   VULTR_API_KEY=… vultr-up --iso-url https://sjc1.vultrobjects.com/gurtos/<version>/gurtos-server-x86_64.iso
//   VULTR_API_KEY=… vultr-up --iso-id <id> [--plan vc2-1c-1gb] [--region sjc] [--firewall <group id>]
//   VULTR_API_KEY=… vultr-up --destroy <instance id> [--delete-iso <iso id>]
// The disc has no sshd, and the box's API refuses the public internet, so setup happens on that console.
import { parseArgs } from 'node:util';

const { values: a } = parseArgs({
  options: {
    'iso-url': { type: 'string' }, 'iso-id': { type: 'string' }, plan: { type: 'string', default: 'vc2-1c-1gb' }, region: { type: 'string', default: 'sjc' },
    label: { type: 'string', default: 'gurtos-test' }, firewall: { type: 'string' }, 'install-seconds': { type: 'string', default: '480' }, destroy: { type: 'string' }, 'delete-iso': { type: 'string' },
  },
});
const token = process.env.VULTR_API_KEY;
if (!token) throw new Error('set VULTR_API_KEY');
const api = async (method: string, p: string, body?: unknown) => {
  const res = await fetch('https://api.vultr.com/v2' + p, { method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) throw new Error(`${method} ${p}: ${res.status} ${(await res.text()).slice(0, 300)}`);
  return res.status === 204 ? {} : await res.json();
};
const t0 = Date.now();
const at = (what: string) => console.log(`[${String(Math.round((Date.now() - t0) / 1000)).padStart(4)} s] ${what}`);
const until = async (what: string, get: () => Promise<boolean>, every = 5000, limit = 1800_000) => {
  for (const start = Date.now(); Date.now() - start < limit; await new Promise((r) => setTimeout(r, every))) if (await get()) return;
  throw new Error(`timed out waiting for ${what}`);
};

if (a.destroy) {
  await api('DELETE', `/instances/${a.destroy}`);
  at(`deleted instance ${a.destroy}`);
  if (a['delete-iso']) (await api('DELETE', `/iso/${a['delete-iso']}`), at(`deleted ISO ${a['delete-iso']}`));
  process.exit(0);
}

let iso = a['iso-id'];
if (!iso) {
  if (!a['iso-url']) throw new Error('give --iso-url or --iso-id');
  iso = (await api('POST', '/iso', { url: a['iso-url'] })).iso.id as string;
  at(`asked Vultr to fetch the ISO (${iso})`);
  await until('the ISO to download', async () => (await api('GET', `/iso/${iso}`)).iso.status === 'complete');
  at('ISO ready on Vultr');
}

const { instance } = await api('POST', '/instances', {
  region: a.region, plan: a.plan, iso_id: iso, label: a.label, hostname: a.label, backups: 'disabled', enable_ipv6: false,
  ...(a.firewall ? { firewall_group_id: a.firewall } : {}),
});
at(`instance ${instance.id} created (${a.plan}, ${a.region})`);
await until('the instance to run', async () => {
  const i = (await api('GET', `/instances/${instance.id}`)).instance;
  return i.status === 'active' && i.power_status === 'running' && i.main_ip !== '0.0.0.0';
});
const now = (await api('GET', `/instances/${instance.id}`)).instance;
at(`running at ${now.main_ip}; the installer starts from the disc`);

// The installer copies the system (about 3 minutes on a 2-vCPU instance) and restarts into the box on its own.
await new Promise((r) => setTimeout(r, Number(a['install-seconds']) * 1000));
await api('POST', `/instances/${instance.id}/iso/detach`);
at('disc detached; the box starts from its own disk');
console.log(JSON.stringify({ instance: instance.id, iso, ip: now.main_ip, console: now.kvm }, null, 2));
