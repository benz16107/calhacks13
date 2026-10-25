// The receipts demo step: finish a task that needed an OK, make a receipt, verify it with the code the public page runs,
// flip one byte and watch it fail, then edit the box's real log and watch the chain fail. Offline: no Elastic, no Solana.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { DemoKit, Task } from '../../core/contract.ts';

type Check = { name: string; ok: boolean | null; detail: string };
type Verify = (r: unknown, o?: unknown) => Promise<{ ok: boolean; checks: Check[] }>;
type Shared = { id: string; address: string; verifyUrl: string; publicVerifyUrl: string; entries: number };

export default async function (d: DemoKit) {
  const tests = spawnSync(process.execPath, [...process.execArgv, '--test', path.join(import.meta.dirname, 'receipts.test.ts')], { encoding: 'utf8' });
  d.check(tests.status === 0, `the offline receipt tests pass${tests.status ? `:\n${tests.stdout}${tests.stderr}` : ''}`);

  // The checker is the one in verify.html, the file gurtos.com/verify serves. The box serves the same file.
  const page = await fetch(`http://127.0.0.1:${fs.readFileSync(path.join(d.home, 'api.port'), 'utf8').trim()}/t/receipts/verify`).then((r) => r.text()).catch(() => undefined);
  const html = page ?? fs.readFileSync(path.join(import.meta.dirname, 'verify.html'), 'utf8');
  const code = html.match(/<script type="module" id="verifier">([\s\S]*?)<\/script>/)?.[1] ?? '';
  const { verifyReceipt } = (await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)) as { verifyReceipt: Verify };
  d.check(!!page ? /Verify a GurtOS receipt/.test(page) : true, 'the box serves the public verify page itself (GET /t/receipts/verify)');

  // A task that asks for an OK, gets it from Rosa's phone, and finishes.
  d.workspace('receipts', {});
  const t = await d.api<Task>('POST', '/tasks', { title: 'Deploy build 7', workspace: 'receipts', worker: 'fake', source: 'demo', prompt: 'write plan.txt ship it\nask Deploy build 7 to production?\nwrite deployed.txt yes' });
  const ask = await d.waitFor('the task to ask', async () => (await d.api<{ id: string; task: string }[]>('GET', '/approvals?state=pending')).find((a) => a.task === t.id));
  await d.api('POST', `/approvals/${encodeURIComponent(ask.id)}`, { approved: true, by: 'Rosa Delgado' });
  await d.settled([t.id]);

  const shared = await d.api<Shared>('POST', '/t/receipts/share', { task: t.id, mode: 'full' });
  const fetched = await d.api<any>('GET', `/t/receipts/r?id=${shared.id}`);
  d.check(shared.verifyUrl.includes('/t/receipts/verify#r=') && shared.publicVerifyUrl.startsWith('https://gurtos.com/verify#r='), `the task has a receipt and a link for the QR code: ${shared.publicVerifyUrl.slice(0, 60)}...`);
  const ok = await verifyReceipt(fetched);
  const passed = ok.checks.filter((c) => c.ok === true).map((c) => c.name);
  d.check(ok.ok && ['Signature', 'Signing key', 'Chain', 'Entries'].every((n) => passed.includes(n)), `the receipt checks out: ${passed.join(', ')} passed, ${fetched.entries.length} entries, chain of ${fetched.chain.lines.length} log lines`);
  const says = (fetched.entries as { text: string }[]).map((e) => e.text).join('\n');
  d.check(/asked: Deploy build 7 to production\?/.test(says) && /Approved by Rosa Delgado/.test(says) && fetched.task.state === 'done', 'it says what the task did, who approved it and how it ended');

  const red = await d.api<Shared>('POST', '/t/receipts/share', { task: t.id, mode: 'redacted' });
  const redacted = await d.api<any>('GET', `/t/receipts/r?id=${red.id}`);
  const redOk = await verifyReceipt(redacted);
  d.check(redOk.ok && !JSON.stringify(redacted).includes('Deploy build 7 to production') && !JSON.stringify(redacted).includes('ship it') && redacted.entries.every((e: { line?: string }) => !e.line), 'the redacted receipt also checks out, and holds no step text, question or file content');

  // One byte.
  const text = JSON.stringify(fetched);
  const flipped = JSON.parse(text.replace('"Deploy build 7"', '"Deploy build 8"'));
  const bad = await verifyReceipt(flipped);
  d.check(!bad.ok && bad.checks.some((c) => c.name === 'Signature' && c.ok === false), 'one changed byte (the title) and the signature fails visibly');
  const noSig = await verifyReceipt({ ...fetched, sig: Buffer.from('x'.repeat(64)).toString('base64') });
  d.check(!noSig.ok, 'a made-up signature fails too');

  // The log itself. Root edits a past entry of this task; the next receipt is signed by the box over a log that no longer chains.
  const file = path.join(d.home, 'log.jsonl');
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  const at = lines.findIndex((l) => l.includes('"type":"task.step"') && l.includes(`"task":"${t.id}"`));
  d.check(at >= 0, `found entry ${at + 1} of the task in the log`);
  const original = lines[at];
  lines[at] = original.replace('ship it', 'ship it NOT');
  fs.writeFileSync(file, lines.join('\n'));
  const tampered = await d.api<Shared>('POST', '/t/receipts/share', { task: t.id, mode: 'full' });
  const afterEdit = await verifyReceipt(await d.api<any>('GET', `/t/receipts/r?id=${tampered.id}`));
  const chain = afterEdit.checks.find((c) => c.name === 'Chain');
  d.check(!afterEdit.ok && chain?.ok === false && new RegExp(`entry ${at + 2}\\b`).test(chain.detail), `an edited log fails visibly even though the box signed: "${chain?.detail}"`);
  const now = fs.readFileSync(file, 'utf8').split('\n'); // the box appended notes meanwhile: put back only the one line
  now[at] = original;
  fs.writeFileSync(file, now.join('\n'));

  const gone = await fetch(`http://127.0.0.1:${fs.readFileSync(path.join(d.home, 'api.port'), 'utf8').trim()}/t/receipts/r?id=${'0'.repeat(32)}`);
  d.check(gone.status === 404, 'a receipt address that does not exist answers 404');
  const key = (await d.api<{ type: string; data?: { kind?: string; fingerprint?: string } }[]>('GET', '/log')).find((e) => e.type === 'note' && e.data?.kind === 'receipts.key');
  d.check(key?.data?.fingerprint === fetched.box.keyFingerprint, "the signing key's short name was written into the box's log when the key was made, so it ships to Elastic and is covered by the chain");
}
