// Vultr's cloud firewall, set from the box. It drops packets before they reach the machine, in front of the
// box's own nftables (image/rootfs/etc/nftables.conf), which stays: that one lets the API on 7700 in from private
// networks only. So this group never opens 7700 or SpacetimeDB's 3000, and opens only what BOX_HOME/vultr/firewall.json
// names. Vultr firewall groups are allow lists (everything else inbound is dropped); replies to the box's own
// connections, such as Tailscale and the relay tunnel, are tracked and come back in.
import fs from 'node:fs';
import path from 'node:path';

const API = 'https://api.vultr.com/v2';
const NEVER = new Set([7700, 3000]);

export interface FirewallConfig {
  /** Addresses (CIDR) that may ssh in. Required: with none the box would lock out everyone who can fix it. */
  ssh?: string[];
  /** Ports open to the whole internet, such as 443 for the two public routes behind the box's own Caddy. */
  public?: number[];
  /** Set to apply a group with no ssh source at all. */
  allowNoSsh?: boolean;
}

export interface Rule {
  protocol: 'tcp' | 'icmp';
  subnet: string;
  subnet_size: number;
  port: string;
  notes: string;
}

/** The rules this config asks for. Pure, so a test can check it without Vultr. Throws on anything unsafe. */
export function desired(cfg: FirewallConfig): Rule[] {
  const rules: Rule[] = [];
  for (const cidr of cfg.ssh ?? []) {
    const m = cidr.match(/^(\d{1,3}(?:\.\d{1,3}){3})(?:\/(\d{1,2}))?$/);
    if (!m || m[1].split('.').some((o) => Number(o) > 255) || Number(m[2] ?? 32) > 32) throw new Error(`ssh source "${cidr}" is not an IPv4 address or CIDR`);
    if (Number(m[2] ?? 32) < 8) throw new Error(`ssh source "${cidr}" is wider than a /8: name the addresses that need it`);
    rules.push({ protocol: 'tcp', subnet: m[1], subnet_size: Number(m[2] ?? 32), port: '22', notes: 'gurtos: ssh' });
  }
  for (const port of cfg.public ?? []) {
    if (!Number.isInteger(port) || port < 1 || port > 65535 || NEVER.has(port)) throw new Error(`port ${port} cannot be opened to the internet (7700 and 3000 never are)`);
    rules.push({ protocol: 'tcp', subnet: '0.0.0.0', subnet_size: 0, port: String(port), notes: `gurtos: public ${port}` });
  }
  if (!rules.some((r) => r.port === '22') && !cfg.allowNoSsh) throw new Error('no ssh source: this group would lock out ssh. Add one to "ssh", or set allowNoSsh');
  return rules;
}

const key = (r: Pick<Rule, 'protocol' | 'subnet' | 'subnet_size' | 'port'>) => `${r.protocol} ${r.subnet}/${r.subnet_size} ${r.port}`;

async function vultr<T>(token: string, method: string, p: string, body?: unknown): Promise<T> {
  const res = await fetch(API + p, { method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) throw new Error(`Vultr ${method} ${p}: ${res.status} ${(await res.text()).slice(0, 200)}`);
  return (res.status === 204 ? undefined : await res.json()) as T;
}

/** The instance this box runs on, from Vultr's metadata address. */
export const myInstance = async (): Promise<string> => (await (await fetch('http://169.254.169.254/v1/instance-v2-id', { signal: AbortSignal.timeout(3000) })).text()).trim();

export interface Applied {
  group: string;
  added: string[];
  removed: string[];
  attached: boolean;
}

/** Make the group `gurtos-<name>` hold exactly these rules and put the instance in it (no instance: only the group). Safe to run again. */
export async function apply(token: string, instance: string | undefined, name: string, rules: Rule[]): Promise<Applied> {
  const description = `gurtos-${name}`;
  const groups = (await vultr<{ firewall_groups: { id: string; description: string }[] }>(token, 'GET', '/firewalls?per_page=500')).firewall_groups;
  const group = groups.find((g) => g.description === description)?.id ?? (await vultr<{ firewall_group: { id: string } }>(token, 'POST', '/firewalls', { description })).firewall_group.id;
  const have = (await vultr<{ firewall_rules: (Rule & { id: number; ip_type: string })[] }>(token, 'GET', `/firewalls/${group}/rules?per_page=500`)).firewall_rules.filter((r) => r.ip_type === 'v4');
  const want = new Map(rules.map((r) => [key(r), r]));
  const added: string[] = [];
  const removed: string[] = [];
  // Add before removing, so a changed ssh source never leaves a moment with none.
  for (const [k, r] of want) if (!have.some((h) => key(h) === k)) (await vultr(token, 'POST', `/firewalls/${group}/rules`, { ip_type: 'v4', ...r }), added.push(k));
  for (const h of have) if (!want.has(key(h))) (await vultr(token, 'DELETE', `/firewalls/${group}/rules/${h.id}`), removed.push(key(h)));
  if (!instance) return { group, added, removed, attached: false };
  const current = (await vultr<{ instance: { firewall_group_id: string } }>(token, 'GET', `/instances/${instance}`)).instance.firewall_group_id;
  if (current !== group) await vultr(token, 'PATCH', `/instances/${instance}`, { firewall_group_id: group });
  return { group, added, removed, attached: current !== group };
}

export const readConfig = (home: string): FirewallConfig => {
  try {
    return JSON.parse(fs.readFileSync(path.join(home, 'vultr', 'firewall.json'), 'utf8'));
  } catch {
    return {};
  }
};
