// The vault: secrets only the core can read. A KEY=value file, root-only, at BOX_VAULT.
// The API can set or replace a key and list names; no route reads a value back.
import fs from 'node:fs';
import path from 'node:path';

export const vaultFile = process.env.BOX_VAULT ?? '/etc/box/vault.env';
const file = vaultFile;

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

export const VAULT_NAME = /^[A-Z][A-Z0-9_]{1,63}$/;

/** Set or replace one key in the vault file, atomically, keeping the file root-only. Returns nothing: never the value. */
export function writeVaultKey(name: string, value: string): void {
  if (!VAULT_NAME.test(name)) throw new Error('Key names are capital letters, digits and _ (like STRIPE_KEY), 2 to 64 characters.');
  if (typeof value !== 'string' || !value.trim()) throw new Error('Paste a key first.');
  const v = value.trim();
  if (/[\r\n\0]/.test(v) || v.length > 8192) throw new Error('A key is one line, at most 8,192 characters.');
  const lines = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n') : [];
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  let replaced = false;
  const out = lines.map((l) => {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=/);
    if (m?.[1] !== name) return l;
    replaced = true;
    return `${name}=${v}`;
  });
  if (!replaced) out.push(`${name}=${v}`);
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, out.join('\n') + '\n', { mode: 0o600 });
  fs.renameSync(tmp, file);
}

/** Remove one key from the vault file, atomically. Nothing happens if it is not there. */
export function removeVaultKey(name: string): void {
  if (!VAULT_NAME.test(name) || !fs.existsSync(file)) return;
  const lines = fs.readFileSync(file, 'utf8').split('\n').filter((l) => l.match(/^\s*([A-Z0-9_]+)\s*=/)?.[1] !== name);
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, lines.join('\n'), { mode: 0o600 });
  fs.renameSync(tmp, file);
}
