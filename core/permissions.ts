// What each app may do, like a phone's app permissions. The manifest is what the app declares (the keys it reads, the
// tools that spend money, routes strangers may call) plus what the box has seen it use (hosts its tasks reach, agents
// with a shell, the owner's folders). The owner can turn any item off, and set money per day. The box enforces each
// "off" where it already draws the line: the vault, the broker, task creation and open routes. Nothing changes for an
// app until the owner turns something off, so existing apps keep working.
import fs from 'node:fs';
import path from 'node:path';

export type Item = { id: string; kind: 'key' | 'money' | 'strangers' | 'shell' | 'host' | 'folders'; text: string; seen?: boolean };
export type Grant = { deny: string[]; perDayCents?: number; diskBytes?: number; answered?: boolean; seen: { hosts: string[]; shell?: boolean; folders?: boolean } };
export type Grants = Record<string, Grant>;

export function load(home: string): Grants {
  try {
    return JSON.parse(fs.readFileSync(path.join(home, 'permissions.json'), 'utf8'));
  } catch {
    return {};
  }
}

export function save(home: string, g: Grants) {
  fs.writeFileSync(path.join(home, 'permissions.json'), JSON.stringify(g, null, 1), { mode: 0o600 });
}

export const grant = (g: Grants, app: string): Grant => (g[app] ??= { deny: [], seen: { hosts: [] } });

/** The app's manifest: what it declares, then what it has been seen using. */
export function manifest(o: { title: string; keys: string[]; spends: boolean; strangers: boolean }, g: Grant): Item[] {
  const items: Item[] = o.keys.map((k) => ({ id: `key:${k}`, kind: 'key' as const, text: `Use the key ${k} (through GurtOS; the app never sees it)` }));
  if (o.spends) items.push({ id: 'money', kind: 'money', text: g.perDayCents !== undefined ? `Spend money, up to $${(g.perDayCents / 100).toFixed(2)} a day` : 'Spend money (each task within its budget)' });
  if (o.strangers) items.push({ id: 'strangers', kind: 'strangers', text: "Take requests from people and agents who aren't paired with this computer" });
  if (g.seen.shell) items.push({ id: 'shell', kind: 'shell', text: 'Run agents that can run commands in their own copy of the files', seen: true });
  if (g.seen.folders) items.push({ id: 'folders', kind: 'folders', text: "Give agents copies of your folders", seen: true });
  for (const h of g.seen.hosts) items.push({ id: `host:${h}`, kind: 'host', text: `Let its agents reach ${h}`, seen: true });
  return items;
}

export const denied = (g: Grants, app: string, id: string) => !!g[app]?.deny.includes(id);
