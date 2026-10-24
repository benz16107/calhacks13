// The vault: secrets only the core can read. A KEY=value file, root-only, at BOX_VAULT.
import fs from 'node:fs';

const file = process.env.BOX_VAULT ?? '/etc/box/vault.env';

export function loadVault(): Map<string, string> {
  const vault = new Map<string, string>();
  if (!fs.existsSync(file)) return vault;
  if (fs.statSync(file).mode & 0o077) throw new Error(`${file} must be readable by root only (chmod 600)`);
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) vault.set(m[1], m[2]);
  }
  return vault;
}
