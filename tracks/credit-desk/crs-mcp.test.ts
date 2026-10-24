import assert from 'node:assert/strict';
import test from 'node:test';
import { DOCS, Mcp, redact } from './crs-mcp.ts';

test("CRS's MCP server starts with no login and answers a docs tool; the server's other tools are the wrapper's to hide", async () => {
  const s = await new Mcp({}).init();
  try {
    const { tools } = await s.rpc('tools/list');
    const names: string[] = tools.map((t: { name: string }) => t.name);
    assert.ok(names.includes('debug_request') && DOCS.every((d) => names.includes(d)), names.join(', '));
    assert.ok((await s.tool('get_use_cases', {})).length > 100);
    await assert.rejects(() => s.tool('debug_request', { requestId: '00000000-0000-0000-0000-000000000000', product: 'credit_report' }), /CRS_USERNAME|Authentication/);
  } finally {
    s.stop();
  }
});

test('redact removes SSNs and birth dates from a raw record', () => {
  const out = redact('{"ssn":"666701013","dob":"1999-12-24","note":"ssn 666-70-1013 and 666701013 again","score":640}');
  assert.ok(!/66670/.test(out) && !/1999-12-24/.test(out) && out.includes('"score":640'), out);
});
