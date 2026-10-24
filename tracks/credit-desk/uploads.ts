// Bring your own scenario: a judge uploads case files, or fills in one credit application on a CRS test person, and
// the desk checks it and works it live. Uploaded cases live in BOX_HOME, never in the code folder.
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { checkCase } from './check-case.ts';
import { CASES_DIR, HOME, TRACK_DIR, safeId } from './desk.ts';

export const UPLOADS = path.join(HOME, 'credit-desk', 'cases');
const PROFILE = path.join(TRACK_DIR, 'company', 'profile.md');
const MAX_FILE = 512 * 1024;
const MAX_TOTAL = 2 * 1024 * 1024;
const CSVS = ['customers.csv', 'invoices.csv', 'invoice_lines.csv', 'payments.csv', 'orders.csv', 'suppliers.csv', 'bills.csv'];

/** The file names a case may hold (README "Input format"). Anything else is refused, and no path can leave the folder. */
export function allowed(name: string) {
  return name === 'case.json' || name === 'answer_key.json' || CSVS.includes(name) ||
    /^applications\/APP-[\w-]{1,40}\.json$/.test(name) || /^sources\/[\w.-]{1,60}\.(csv|json)$/.test(name);
}

export function caseDirOf(id: string) {
  const name = safeId(id);
  for (const root of [CASES_DIR, UPLOADS]) if (fs.existsSync(path.join(root, name, 'case.json'))) return path.join(root, name);
  return undefined;
}

export function listCases() {
  const list = (root: string, uploaded: boolean) => (fs.existsSync(root) ? fs.readdirSync(root) : [])
    .filter((c) => fs.existsSync(path.join(root, c, 'case.json')))
    .map((c) => {
      const meta = JSON.parse(fs.readFileSync(path.join(root, c, 'case.json'), 'utf8'));
      return { id: c, title: meta.title ?? c, as_of: meta.as_of, uploaded, follows: meta.follows ?? null, scored: fs.existsSync(path.join(root, c, 'answer_key.json')) };
    });
  return [...list(CASES_DIR, false), ...list(UPLOADS, true).sort((a, b) => b.id.localeCompare(a.id))];
}

/** Write a new case from uploaded files ({name: text}). Adds case.json if missing. Returns the checker's verdict. */
export function saveUpload(files: Record<string, unknown>, opts: { title?: string; as_of?: string } = {}) {
  const entries = Object.entries(files ?? {});
  if (!entries.length) throw new Error('no files');
  if (entries.length > 60) throw new Error('at most 60 files');
  let total = 0;
  for (const [name, text] of entries) {
    if (!allowed(name)) throw new Error(`${name} is not a case file. Allowed: case.json, ${CSVS.join(', ')}, applications/APP-*.json, sources/*.csv or .json, answer_key.json`);
    if (typeof text !== 'string') throw new Error(`${name} must be text`);
    if (text.length > MAX_FILE) throw new Error(`${name} is over 512 KB`);
    total += text.length;
  }
  if (total > MAX_TOTAL) throw new Error('the files are over 2 MB together');
  const id = `upload-${new Date().toISOString().slice(0, 10)}-${randomBytes(2).toString('hex')}`;
  const dir = path.join(UPLOADS, id);
  fs.mkdirSync(dir, { recursive: true, mode: 0o755 });
  for (const [name, text] of entries) {
    const f = path.join(dir, name);
    if (!f.startsWith(dir + path.sep)) throw new Error(`bad path ${name}`);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, text as string);
  }
  if (!files['case.json']) {
    // The company is Fogline unless the judge brings their own profile; the rules are the desk's default.
    fs.writeFileSync(path.join(dir, 'case.json'), JSON.stringify({
      case_id: id, title: opts.title || 'A judge\'s own case', as_of: /^\d{4}-\d{2}-\d{2}$/.test(opts.as_of ?? '') ? opts.as_of : new Date().toISOString().slice(0, 10),
      currency: 'USD', company_profile: PROFILE,
    }, null, 2) + '\n');
  } else {
    // An uploaded case.json names its own id; the folder name wins so two uploads never collide.
    const meta = JSON.parse(fs.readFileSync(path.join(dir, 'case.json'), 'utf8'));
    fs.writeFileSync(path.join(dir, 'case.json'), JSON.stringify({ company_profile: PROFILE, ...meta, case_id: id, nessie: false }, null, 2) + '\n');
  }
  const { problems, summary } = checkCase(dir);
  return { case: id, dir, problems, summary };
}

const personas = () => JSON.parse(fs.readFileSync(path.join(TRACK_DIR, 'sandbox', 'crs-personas.json'), 'utf8')).personas as any[];

export const personaList = () => personas().map((p) => ({ id: p.id, name: p.name, profile: p.profile, expected: p.crs_expected_decision }));

/** One credit application from a form: the business as typed, the guarantor a CRS test person (the sandbox knows only them). */
export function applicationCase(form: Record<string, unknown>) {
  const p = personas().find((x) => x.id === form.persona);
  if (!p) throw new Error('pick a CRS test person');
  const num = (k: string, min: number) => {
    const n = Number(form[k]);
    if (!Number.isFinite(n) || n < min) throw new Error(`${k} must be a number of at least ${min}`);
    return n;
  };
  const text = (k: string, max = 120) => String(form[k] ?? '').trim().slice(0, max);
  const business = text('business');
  if (!business) throw new Error('give the business a name');
  const app = {
    application_id: 'APP-2001',
    received_at: new Date().toISOString(),
    channel: 'credit desk window (a judge)',
    submitted_from_ip: p.submitted_from_ip,
    business: {
      legal_name: business, entity_type: text('entity_type', 40) || 'LLC', state_of_formation: text('state', 2).toUpperCase() || 'CA',
      ein: text('ein', 20), years_in_business: num('years_in_business', 0), annual_revenue: num('annual_revenue', 0), employees: Number(form.employees) || undefined,
      industry: text('industry'), billing_address: { line1: text('address') || '100 Main St', city: text('city', 40) || 'Oakland', state: text('state', 2).toUpperCase() || 'CA', zip: text('zip', 10) || '94607' },
    },
    request: { credit_limit: num('credit_limit', 1), terms: text('terms', 20) || 'Net 30', first_order_amount: Number(form.first_order_amount) || undefined, reason: text('reason', 400) },
    guarantor: { ...p.guarantor, title: 'Owner', ownership_pct: 100 },
    declarations: { bankruptcy_last_7_years: form.bankruptcy === true, open_liens_or_judgments: form.liens === true, personal_guarantee_signed: true, credit_check_authorized: true },
    trade_references: [],
    attachments: [],
  };
  return saveUpload({ 'applications/APP-2001.json': JSON.stringify(app, null, 2) + '\n' }, { title: `${business} (on ${p.name}, CRS test person ${p.id})` });
}

/** Templates a judge can start from: the case files' header rows, and a sample application. */
export function templates(): Record<string, string> {
  const fog = path.join(CASES_DIR, 'fogline-2026-10');
  const out: Record<string, string> = {};
  for (const f of CSVS) if (fs.existsSync(path.join(fog, f))) out[f] = fs.readFileSync(path.join(fog, f), 'utf8').split('\n').slice(0, 2).join('\n') + '\n';
  out['applications/APP-2001.json'] = fs.readFileSync(path.join(fog, 'applications', 'APP-1041.json'), 'utf8').replace('"APP-1041"', '"APP-2001"');
  out['case.json'] = JSON.stringify({ case_id: 'my-case', title: 'My case', as_of: '2026-10-23', currency: 'USD' }, null, 2) + '\n';
  return out;
}
