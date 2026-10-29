// The example is what developers copy, so its routes must answer bad input the way a real app should.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Track } from '../../core/contract.ts';
import track from './track.ts';

const call = (key: string, body: string | null, box: any) => (track as Track).routes![key](new Request('http://box/t/example/x', { method: 'POST', ...(body === null ? {} : { body }) }), box);

test('POST /start answers a bad body or an unknown workspace with a 400 and the reason', async () => {
  const box: any = {
    workspace: (n: string) => {
      if (!/^[\w.-]+$/.test(n)) throw new Error(`bad workspace name ${n}`);
    },
    createTask: async (spec: any) => ({ id: 't1', ...spec }),
  };
  const ok = await call('POST /start', 'null', box);
  assert.deepEqual([ok.status, ((await ok.json()) as any).workspace], [200, 'example'], 'no body at all still starts the default task');
  const bad = await call('POST /start', '{"workspace":"../etc"}', box);
  assert.equal(bad.status, 400);
  assert.match(((await bad.json()) as any).error, /bad workspace name/);
});

test('GET /secret-check says so, with a 404, when the key is not in the vault', async () => {
  const r = await call('GET /secret-check', null, { secret: () => { throw new Error('DEMO_SECRET is not in the vault'); } });
  assert.equal(r.status, 404);
});
