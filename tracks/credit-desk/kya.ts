// Know your agent. A stranger's agent that asks the box for credit is acting for a person, and the box checks the person
// before the owner is asked, and before the credit desk is given the application. The check is CRS's identity
// verification, Fraud Finder and the phone's owner, the three identity checks in the sandbox, and no credit report:
// nobody's credit is pulled just to find out who is asking. The guest path (tracks/mana/guest.ts) calls these two jobs
// through box.job, so there is one path for every front door and the CRS login stays in the core.
import fs from 'node:fs';
import type { ModelJob } from '../../core/contract.ts';
import { checkApplication } from './crs.ts';
import { identityStops } from './fraud.ts';
import { startRun } from './start.ts';
import { saveUpload } from './uploads.ts';
import { TRACK_DIR } from './desk.ts';

export interface Who {
  first_name: string; last_name: string; ssn: string; dob: string; phone: string; email: string;
  home_address: { line1: string; city: string; state: string; zip: string };
}

/** An error written for the guest, with the status the guest path answers with. */
const bad = (msg: string) => Object.assign(new Error(msg), { status: 400 });

const PERSONAS: { name: string; guarantor: { first_name: string; last_name: string; ssn: string; dob: string } }[] = JSON.parse(fs.readFileSync(`${TRACK_DIR}sandbox/crs-personas.json`, 'utf8')).personas;
/** Test identities only: name, SSN and date of birth must all be one of CRS's 20 sandbox people, checked before any CRS call. */
export const isTestPerson = (w: Who) => PERSONAS.some(({ guarantor: g }) => g.first_name === w.first_name.toUpperCase() && g.last_name === w.last_name.toUpperCase() && g.ssn === w.ssn && g.dob === w.dob);

/** The person as CRS wants them, or the sentence to tell the guest. Only a CRS sandbox person is accepted, so the SSN here is a test SSN. It is not logged; it is written only into the application file of the run (CRS needs it), which the seats never see. */
export function cleanIdentity(x: any): Who | string {
  const t = (v: unknown, max = 80) => String(v ?? '').trim().slice(0, max);
  const a = x?.home_address ?? x?.address ?? {};
  const who: Who = {
    first_name: t(x?.first_name), last_name: t(x?.last_name), ssn: t(x?.ssn, 11).replace(/-/g, ''), dob: t(x?.dob, 10), phone: t(x?.phone, 20).replace(/\D/g, ''), email: t(x?.email),
    home_address: { line1: t(a.line1), city: t(a.city, 40), state: t(a.state, 2).toUpperCase(), zip: t(a.zip, 10) },
  };
  if (!who.first_name || !who.last_name) return 'Give the first and last name of the person who will sign the personal guarantee.';
  if (!/^\d{9}$/.test(who.ssn)) return 'The SSN must be 9 digits.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(who.dob)) return 'The date of birth must be YYYY-MM-DD.';
  if (!who.home_address.line1 || !who.home_address.city || !/^[A-Z]{2}$/.test(who.home_address.state) || !who.home_address.zip) return 'Give the home address: line1, city, a 2-letter state and zip.';
  if (who.phone.length < 10 || !who.email.includes('@')) return 'Give a 10-digit phone number and an email address.';
  if (!isTestPerson(who)) return "This box takes credit requests only for CRS's test identities.";
  return who;
}

export interface Verdict {
  verified: boolean;
  /** FRD-1 and FRD-2, read the same way the credit desk reads them. */
  stops: { rule: string; why: string }[];
  fraud_score: number | null;
  identity: 'verified' | 'failed' | 'not checked';
  phone_owner: 'matches' | 'does not match' | 'unknown';
  request_ids: Record<string, string | null | undefined>;
  source: string;
}

/** Fails closed: a person CRS cannot confirm (no file, an error, an unknown name) is not verified. */
export const kyaJob: ModelJob = {
  name: 'credit-desk.kya',
  secrets: ['CRS_USERNAME', 'CRS_PASSWORD'],
  async run(input: { identity: unknown; credit: unknown; ip?: string }, ctx): Promise<Verdict> {
    const who = cleanIdentity(input.identity), credit = cleanCredit(input.credit);
    if (typeof who === 'string') throw bad(who);
    if (typeof credit === 'string') throw bad(credit); // the request is checked before CRS is called, so a typo costs no pull
    const s = await checkApplication({ application_id: 'KYA', guarantor: who, submitted_from_ip: input.ip }, 'kya', () => [ctx.secret('CRS_USERNAME'), ctx.secret('CRS_PASSWORD')], ['identity', 'fraud', 'phone-owner']);
    const id: any = s.identity, fr: any = s.fraud;
    const stops = identityStops(s);
    const scored = typeof fr?.risk_score === 'number';
    return {
      verified: id?.verified === true && scored && stops.length === 0,
      stops, fraud_score: scored ? fr.risk_score : null,
      identity: id?.verified === true ? 'verified' : id?.error ? 'not checked' : 'failed',
      phone_owner: fr?.phone?.owner_matches_name === true ? 'matches' : fr?.phone?.owner_matches_name === false ? 'does not match' : 'unknown',
      request_ids: { identity: id?.request_id, fraud: fr?.request_id, phone: s.phone_owner?.request_id },
      source: s.source,
    };
  },
};

export interface GuestCredit { business: string; limit: number; years_in_business: number; annual_revenue: number; terms?: string; reason?: string }

/** The guest's credit request, or the sentence to tell them. */
export function cleanCredit(x: any): GuestCredit | string {
  const num = (v: unknown, min: number) => (Number.isFinite(Number(v)) && Number(v) >= min ? Number(v) : NaN);
  const c = { business: String(x?.business ?? '').trim().slice(0, 120), limit: num(x?.limit, 1), years_in_business: num(x?.years_in_business, 0), annual_revenue: num(x?.annual_revenue, 0), terms: String(x?.terms ?? 'Net 30').slice(0, 20), reason: String(x?.reason ?? '').slice(0, 400) };
  if (!c.business) return 'Give the business a name.';
  if (Number.isNaN(c.limit) || Number.isNaN(c.years_in_business) || Number.isNaN(c.annual_revenue)) return 'Give the credit limit, the years in business and the annual revenue as numbers.';
  return c;
}

/** After the owner's OK: the verified guest's request becomes a credit application, and the analyst seat works it like any other. */
export const guestApplicationJob: ModelJob = {
  name: 'credit-desk.guest_application',
  async run(input: { identity: unknown; credit: unknown; verdict: Verdict; ip?: string }, ctx) {
    const who = cleanIdentity(input.identity), c = cleanCredit(input.credit);
    if (typeof who === 'string' || typeof c === 'string') throw new Error(String(typeof who === 'string' ? who : c));
    const app = {
      application_id: 'APP-G1', received_at: new Date().toISOString(), channel: 'guest request (identity verified by CRS before the owner was asked)', submitted_from_ip: input.ip,
      business: { legal_name: c.business, entity_type: 'LLC', years_in_business: c.years_in_business, annual_revenue: c.annual_revenue },
      request: { credit_limit: c.limit, terms: c.terms, reason: c.reason },
      guarantor: { ...who, title: 'Owner', ownership_pct: 100 },
      declarations: { bankruptcy_last_7_years: false, open_liens_or_judgments: false, personal_guarantee_signed: true, credit_check_authorized: true },
      trade_references: [], attachments: [],
    };
    const saved = saveUpload({ 'applications/APP-G1.json': JSON.stringify(app, null, 2) + '\n' }, { title: `${c.business} (a guest, identity checked by CRS)` });
    if (saved.problems.length) throw new Error(`the application does not follow the case format: ${saved.problems.join('; ')}`);
    // A box with no model key runs the seat as a scripted worker, the way the guest path does for its web lookups.
    const script = process.env.BOX_NO_DROID ? { analyst: 'say A guest credit application is with the analyst seat (scripted, no model)' } : undefined;
    const res = await startRun(ctx.box, { dir: saved.dir, seats: ['analyst'], script, guest: true });
    const out = await res.json();
    if (!res.ok) throw new Error(out.error ?? 'could not start the credit desk');
    return { run: out.run as string, task: out.tasks.analyst as string, verdict: input.verdict };
  },
};
