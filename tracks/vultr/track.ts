// The Vultr track: what GurtOS Server does with a Vultr account, from the box itself.
//   GET  /t/vultr/status    last backup and the firewall config (names and sizes, nothing private)
//   POST /t/vultr/backup    encrypt the box's state and upload it to Object Storage now (owner)
//   PUT  /t/vultr/firewall  save {ssh, public} and apply it as this instance's Vultr firewall group (owner)
// A backup also runs every day. See README.md for why each part is here.
import fs from 'node:fs';
import path from 'node:path';
import type { Box, Track } from '../../core/contract.ts';
import { HOME, haveAge, lastBackup, runBackup } from './backup.ts';
import { apply, desired, myInstance, readConfig, type FirewallConfig } from './firewall.ts';

const ownerOnly = (req: Request) => {
  const who = req.headers.get('x-box-caller');
  if (who !== 'owner' && who !== 'screen') throw Object.assign(new Error('only the owner can do this'), { status: 403 });
};
const fail = (e: any) => Response.json({ error: String(e?.message ?? e) }, { status: e?.status ?? 400 });
const tryRead = (box: Box, name: string) => { try { return box.secret(name); } catch { return undefined; } };

let running: Promise<unknown> | undefined;

export default {
  name: 'vultr',
  title: 'Vultr cloud',
  description: 'Backs the box up, encrypted, to Vultr Object Storage, and sets the Vultr cloud firewall for the machine it runs on.',
  secrets: ['VULTR_OBJ_ACCESS', 'VULTR_OBJ_SECRET', 'BACKUP_AGE_RECIPIENT', 'VULTR_API_KEY', 'VULTR_OBJ_HOST', 'VULTR_OBJ_BUCKET'],
  // Backups need the first three; the firewall needs VULTR_API_KEY; the last two have defaults.
  optionalSecrets: ['VULTR_API_KEY', 'VULTR_OBJ_HOST', 'VULTR_OBJ_BUCKET'],

  routes: {
    'GET /status': (_req, box) =>
      Response.json({ age: haveAge(), backup: lastBackup() ?? null, backupConfigured: !!tryRead(box, 'BACKUP_AGE_RECIPIENT') && !!tryRead(box, 'VULTR_OBJ_ACCESS'), firewall: readConfig(HOME) }),

    'POST /backup': async (req, box) => {
      try {
        ownerOnly(req);
        running ??= runBackup(box).finally(() => (running = undefined));
        return Response.json(await running);
      } catch (e) {
        return fail(e);
      }
    },

    'PUT /firewall': async (req, box) => {
      try {
        ownerOnly(req);
        const cfg = (await req.json()) as FirewallConfig;
        const rules = desired(cfg); // throws before anything is saved or sent
        const token = box.secret('VULTR_API_KEY');
        const applied = await apply(token, await myInstance(), process.env.BOX_ID ?? 'box', rules);
        fs.mkdirSync(path.join(HOME, 'vultr'), { recursive: true });
        fs.writeFileSync(path.join(HOME, 'vultr', 'firewall.json'), JSON.stringify(cfg));
        box.note({ firewall: { group: applied.group, added: applied.added, removed: applied.removed } });
        return Response.json(applied);
      } catch (e) {
        return fail(e);
      }
    },
  },

  triggers: [
    {
      name: 'daily-backup',
      start(box) {
        const every = Number(process.env.VULTR_BACKUP_EVERY_MS) || 24 * 3600_000;
        const tick = () => {
          if (!tryRead(box, 'BACKUP_AGE_RECIPIENT')) return; // not set up: stay quiet
          running ??= runBackup(box).catch((e) => box.note({ backupError: String(e.message).slice(0, 300) })).finally(() => (running = undefined));
        };
        const first = setTimeout(tick, 60_000);
        const timer = setInterval(tick, every);
        return () => (clearTimeout(first), clearInterval(timer));
      },
    },
  ],
} satisfies Track;
