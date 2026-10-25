// Seed the clip box as GurtOS Business for Fogline Supply (made up), for shots A30 to A34: the same people, seats,
// policy and five requests as the merge gate's Business step (core/business-demo.ts). Scripted seats, no model.
//   BOX=http://127.0.0.1:7795 node docs/video/capture/seed-business.ts          # on
//   BOX=http://127.0.0.1:7795 node docs/video/capture/seed-business.ts off      # Business off again
// Prints each person's phone token, so a simulator or a browser can act as that person (never commit them).
import { PEOPLE, POLICY, SEATS } from '../../../core/business-demo.ts';

const BOX = process.env.BOX ?? 'http://127.0.0.1:7795';
const RELAYED = { 'x-forwarded-for': '203.0.113.9' }; // a phone's request, not the box's own screen
async function call(method: string, p: string, body?: unknown, headers: Record<string, string> = {}) {
  const r = await fetch(BOX + p, { method, headers: { 'content-type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text();
  if (!r.ok) throw new Error(`${method} ${p}: ${r.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

if (process.argv[2] === 'off') {
  await call('PUT', '/api/business', { on: false });
  console.log('Business off');
  process.exit(0);
}

await call('PUT', '/api/business', { on: true, company: 'Fogline Supply', policy: POLICY, seats: SEATS });
const have = new Set(((await call('GET', '/api/people')) as { id: string }[]).map((p) => p.id));
const tokens: Record<string, string> = {};
for (const p of PEOPLE) {
  if (!have.has(p.id)) await call('POST', '/api/people', p);
  const { code } = await call('POST', `/api/people/${p.id}/pair`);
  tokens[p.id] = (await call('POST', '/api/pair', { code }, RELAYED)).token;
}
const as = (who: string) => (m: string, p: string, b?: unknown) => call(m, p, b, { authorization: `Bearer ${tokens[who]}`, ...RELAYED });

const start = (who: string, seat: string, title: string, prompt: string) =>
  as(who)('POST', '/api/tasks', { title, seat, prompt, worker: 'fake', workspace: 'fogline-business' });
await start('sam', 'Credit analyst', 'Credit analyst: APP-1042', 'say CRS: guarantor credit 790, band A; identity verified; Fraud Finder no reasons\nask Credit desk [APP-1042 approve 40000]: approve Bright Harbor Catering for $40,000, Net 30?');
await start('sam', 'Credit analyst', 'Credit analyst: APP-1043', 'ask Credit desk: fraud referral. Put Pacific Crest Provisions LLC (APP-1043) on fraud hold, no credit? Its owner fails identity (2201, 2202) and Fraud Finder scores it 88.');
await start('sam', 'Credit analyst', 'Credit analyst: APP-1047', 'ask Credit desk: approve Bayview Grocers (APP-1047) for $75,000, Net 30?');
await start('sam', 'Collections clerk', 'Collections clerk: INV-24102', 'ask Collections: write off the last $2,400 on INV-24102 for Mission St. Taqueria?\nwrite INV-24102.txt written off');
await start('rosa', 'Credit analyst', 'Credit analyst: APP-1048', 'ask Credit desk: approve Tamarind Kitchen (APP-1048) for $12,000, Net 30?');

for (const end = Date.now() + 30000; Date.now() < end; await new Promise((r) => setTimeout(r, 500))) {
  const pending = (await call('GET', '/api/approvals?state=pending')) as { route?: { rule?: string } }[];
  if (pending.filter((a) => a.route).length >= 5) {
    console.log(`Fogline Supply seeded: ${PEOPLE.length} people, 5 routed requests`);
    for (const [id, t] of Object.entries(tokens)) console.log(`  ${id} token ${t}`);
    process.exit(0);
  }
}
throw new Error('the five requests did not all arrive within 30 s');
