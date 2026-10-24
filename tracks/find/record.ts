// Saves what a live model says about each test photo to recorded.json, so offline demo runs need no model.
//   node --experimental-strip-types tracks/find/record.ts [base] [model]
// Default: Ollama on this machine with gemma4. For Ollama on another machine, pass its address, or forward its
// port first: ssh -NfL 11434:localhost:11434 <machine running Ollama>
import fs from 'node:fs';
import { describe, sha256 } from './find.ts';

const [base = 'http://localhost:11434/v1', model = 'gemma4'] = process.argv.slice(2);
const dir = new URL('./photos/', import.meta.url).pathname;
const out: Record<string, unknown> = {};
for (const name of fs.readdirSync(dir).sort()) {
  const d = await describe(dir + name, { model, base });
  out[sha256(dir + name)] = { file: name, ...d };
  console.log(`${name} (${d.ms} ms)\n${d.text}\n`);
}
fs.writeFileSync(new URL('./recorded.json', import.meta.url), JSON.stringify(out, null, 2) + '\n');
