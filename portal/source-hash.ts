// A hash of everything the built portal comes from: its sources, its lockfile, and the SpacetimeDB bindings it
// bundles. If the core changes the tables, the old bundle cannot read the new rows, so dist/ must be rebuilt.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const files = (dir: string): string[] =>
  fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(path.join(dir, e.name)) : [path.join(dir, e.name)]));

export function sourceHash() {
  const h = createHash('sha256');
  for (const f of [...files('portal/src'), ...files('core/spacetime/bindings'), 'portal/package-lock.json', 'portal/build.ts'].sort()) {
    h.update(f + '\0').update(fs.readFileSync(path.join(root, f))).update('\0');
  }
  return h.digest('hex').slice(0, 16);
}
