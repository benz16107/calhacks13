import assert from 'node:assert/strict';
import test from 'node:test';
import { destination } from './net.ts';

test('a task reaches a name on the box only on the exact host:port it was given, never a box port', async () => {
  assert.match((await destination(['localhost:5555'], 'localhost', '5555')) ?? '', /^(127\.0\.0\.1|::1)$/); // either loopback: the OS decides which one "localhost" is
  assert.equal(await destination(['localhost'], 'localhost', '7700'), undefined); // the box API, through a loose entry
  assert.equal(await destination(['localhost'], 'localhost', '5555'), undefined); // on the box: needs host:port
  assert.equal(await destination(['localhost:3000'], 'localhost', '3000'), undefined); // SpacetimeDB, even if listed
  assert.equal(await destination(['localhost:8888'], 'localhost', '8888'), undefined); // the proxy itself
  assert.equal(await destination(['example.com'], 'other.com', '443'), undefined); // not on the list
});
