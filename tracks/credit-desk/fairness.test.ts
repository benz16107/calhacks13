// Protected attributes never reach a decision: the seats that decide never see them.
// Run: node --test tracks/credit-desk/fairness.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkApplication } from './crs.ts';
import { PROTECTED_KEYS, redactApplication, stageWorkspace } from './desk.ts';

const CASE = path.join(import.meta.dirname, 'cases', 'fogline-2026-10');
const base = JSON.parse(fs.readFileSync(path.join(CASE, 'applications', 'APP-1041.json'), 'utf8'));
// The same applicant twice, differing only in protected attributes, some of them nested.
const twin = (who: Record<string, unknown>) => ({
  ...structuredClone(base),
  demographics: { race: who.race, ethnicity: who.ethnicity, sex: who.sex, religion: who.religion },
  guarantor: { ...base.guarantor, marital_status: who.marital, national_origin: who.origin, dob: who.dob, age: who.age },
});
const a = twin({ race: 'Asian', ethnicity: 'Not Hispanic or Latino', sex: 'female', religion: 'Buddhist', marital: 'married', origin: 'Japan', dob: '1976-09-16', age: 50 });
const b = twin({ race: 'Black', ethnicity: 'Hispanic or Latino', sex: 'male', religion: 'Muslim', marital: 'single', origin: 'Mexico', dob: '1990-02-03', age: 36 });
const SECRETS = ['Asian', 'Hispanic', 'female', 'Buddhist', 'married', 'Japan', '1976-09-16', base.guarantor.ssn, base.guarantor.first_name, base.guarantor.last_name, base.guarantor.home_address.line1];

const keysDeep = (v: unknown): string[] => (v && typeof v === 'object' ? Object.entries(v).flatMap(([k, x]) => [k.toLowerCase(), ...keysDeep(x)]) : []);

test('a seat sees no protected attribute and no guarantor identity', () => {
  const seen = redactApplication(a);
  assert.deepEqual(keysDeep(seen).filter((k) => PROTECTED_KEYS.includes(k)), []);
  const text = JSON.stringify(seen);
  for (const s of SECRETS) assert.ok(!text.includes(String(s)), `${s} reached the seat`);
  assert.equal(seen.business.legal_name, base.business.legal_name, 'what the decision needs is still there');
  assert.equal(seen.request.credit_limit, base.request.credit_limit);
});

test('two applicants who differ only in protected attributes look identical to the seats', () => {
  assert.deepEqual(redactApplication(a), redactApplication(b));
});

test('the workspace a run hands the seats holds the redacted applications only', () => {
  const caseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fair-case-'));
  fs.cpSync(CASE, caseDir, { recursive: true });
  fs.writeFileSync(path.join(caseDir, 'applications', 'APP-1041.json'), JSON.stringify(a));
  fs.writeFileSync(path.join(caseDir, 'case.json'), JSON.stringify({ case_id: 'fair', as_of: '2026-10-23' }));
  const staged = stageWorkspace({ run: 'fair', caseId: 'fair', caseDir, rulesFile: path.join(import.meta.dirname, 'rules', 'credit-rules.yaml'), workspace: 'fair', nessie: false });
  const text = fs.readFileSync(path.join(staged, 'case', 'applications', 'APP-1041.json'), 'utf8');
  for (const s of SECRETS) assert.ok(!text.includes(String(s)), `${s} is in the seats' copy`);
  for (const f of fs.readdirSync(path.join(staged, 'case', 'applications'))) {
    const other = fs.readFileSync(path.join(staged, 'case', 'applications', f), 'utf8');
    assert.ok(!/"ssn"|"dob"/.test(other), `${f} still has an SSN or a date of birth`);
  }
  fs.rmSync(staged, { recursive: true, force: true });
  fs.rmSync(caseDir, { recursive: true, force: true });
});

test("the CRS summary a seat receives has no guarantor's name, SSN, date of birth or address", async () => {
  // Offline: a network failure makes the client use the answers recorded from the sandbox on 2026-10-23.
  const real = globalThis.fetch;
  globalThis.fetch = (() => Promise.reject(new TypeError('offline'))) as typeof fetch;
  try {
    const app = JSON.parse(fs.readFileSync(path.join(CASE, 'applications', 'APP-1043.json'), 'utf8'));
    const s: any = await checkApplication(app, "fogline-2026-10", () => ["u", "p"]);
    const text = JSON.stringify(s);
    for (const v of [app.guarantor.first_name, app.guarantor.last_name, app.guarantor.ssn, app.guarantor.dob, app.guarantor.home_address.line1]) {
      assert.ok(!text.includes(v), `${v} is in the CRS summary`);
    }
    assert.equal(s.identity.verified, false, 'the checks still work: the fake applicant still fails identity');
    assert.equal(s.phone_owner.owner_is_the_guarantor, false);
  } finally {
    globalThis.fetch = real;
  }
});
