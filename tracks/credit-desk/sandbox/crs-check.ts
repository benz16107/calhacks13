// Runs the credit desk's CRS checks on every application in one or more case folders and saves the raw answers.
// Run on a test VM as root so it can read the box vault: node crs-check.ts <out-dir> <case-dir>...
// It logs in once and never retries a failed login: repeated failed logins disable the CRS account.
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'https://api-sandbox.stitchcredit.com/api';

// The request bodies the desk sends, built from one application (see crs.md).
export function crsRequests(a: any): [name: string, path: string, body: unknown][] {
  const g = a.guarantor;
  const h = g.home_address;
  const person = { firstName: g.first_name, lastName: g.last_name };
  const report = { ...person, ssn: g.ssn, addresses: [{ borrowerResidencyType: 'Current', addressLine1: h.line1, city: h.city, state: h.state, postalCode: h.zip }] };
  return [
    ['transunion', '/transunion/credit-report/standard/tu-prequal-fico9', report],
    ['equifax', '/equifax/credit-report/standard/efx-prequal-vantage4', report],
    ['experian', '/experian/credit-report/standard/exp-prequal-vantage4', report],
    ['identity', '/transunion/identity-manager-verification/basic', { ...person, ssn: g.ssn, dob: g.dob, street1: h.line1, city: h.city, state: h.state, zip: h.zip }],
    ['fraud', '/fraud-finder/fraud-finder', { ...person, phoneNumber: g.phone, email: g.email, ipAddress: a.submitted_from_ip, address: { addressLine1: h.line1, city: h.city, state: h.state, postalCode: h.zip } }],
    ['public-records', '/pp/fcrablj/data', { terms: { term: [{ person: { ...person, ssn: g.ssn } }] } }],
    ['phone-owner', '/accurate-append/reverse', { phoneNumber: g.phone }],
  ];
}

function vault(): Map<string, string> {
  const file = process.env.BOX_VAULT ?? '/etc/box/vault.env';
  const v = new Map<string, string>();
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) v.set(m[1], m[2]);
  }
  return v;
}

if (import.meta.main) {
  const [out, ...cases] = process.argv.slice(2);
  if (!out || !cases.length) { console.error('usage: node crs-check.ts <out-dir> <case-dir>...'); process.exit(2); }
  const v = vault();
  const login = await fetch(`${BASE}/users/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ username: v.get('CRS_USERNAME'), password: v.get('CRS_PASSWORD') }),
  });
  if (!login.ok) { console.error(`CRS login failed with HTTP ${login.status}. Not retrying.`); process.exit(1); }
  const { token } = (await login.json()) as { token: string };

  for (const dir of cases) {
    const caseId = JSON.parse(fs.readFileSync(path.join(dir, 'case.json'), 'utf8')).case_id;
    for (const f of fs.readdirSync(path.join(dir, 'applications')).filter((f) => f.endsWith('.json')).sort()) {
      const a = JSON.parse(fs.readFileSync(path.join(dir, 'applications', f), 'utf8'));
      const target = path.join(out, caseId, a.application_id);
      fs.mkdirSync(target, { recursive: true });
      for (const [name, route, body] of crsRequests(a)) {
        const res = await fetch(BASE + route, {
          method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        });
        const text = await res.text();
        let response: unknown = text;
        try { response = JSON.parse(text); } catch {}
        const requestId = res.headers.get('requestid');
        fs.writeFileSync(path.join(target, `${name}.json`), JSON.stringify({ route, body, status: res.status, requestId, response }, null, 2));
        console.log(`${a.application_id} ${name} HTTP ${res.status} RequestID ${requestId}`);
      }
    }
  }
}
