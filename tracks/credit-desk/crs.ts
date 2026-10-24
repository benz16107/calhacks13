// The CRS Credit API for the credit desk: the seven checks on an applicant's guarantor, summarized for the agent.
// Log in once per box process. A failed login is never retried: repeated failed logins disable the CRS account.
import fs from 'node:fs';
import path from 'node:path';
import { crsRequests } from './sandbox/crs-check.ts';
import { TRACK_DIR } from './desk.ts';

const BASE = 'https://api-sandbox.stitchcredit.com/api';
export const CRS_HOST = 'api-sandbox.stitchcredit.com';

let token: Promise<string> | undefined;
let loginBroken: string | undefined;

async function login(user: string, pass: string): Promise<string> {
  if (loginBroken) throw new Error(`CRS login failed earlier (${loginBroken}). Fix the credentials and restart the box; not retrying.`);
  const res = await fetch(`${BASE}/users/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ username: user, password: pass }),
  });
  if (!res.ok) {
    loginBroken = `HTTP ${res.status}`;
    throw new Error(`CRS login failed with HTTP ${res.status}. Not retrying.`);
  }
  return ((await res.json()) as { token: string }).token;
}

type Raw = { status: number; requestId: string | null; response: any; recorded?: boolean };

async function post(route: string, body: unknown, creds: () => [string, string]): Promise<Raw> {
  for (let attempt = 0; ; attempt++) {
    token ??= login(...creds()).catch((e) => ((token = undefined), Promise.reject(e)));
    const res = await fetch(BASE + route, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${await token}` },
      body: JSON.stringify(body),
    });
    if (res.status === 401 && attempt === 0) { token = undefined; continue; } // an expired token: log in once more
    const text = await res.text();
    let response: unknown = text;
    try { response = JSON.parse(text); } catch {}
    return { status: res.status, requestId: res.headers.get('requestid'), response };
  }
}

const date = (d: any) => (d?.year ? `${d.year}-${d.month}-${d.day}` : undefined);
const list = (x: any) => (x == null ? [] : Array.isArray(x) ? x : [x]);

function creditReport(r: Raw) {
  const x = r.response ?? {};
  if (x.errorMessages?.length) return { request_id: r.requestId, errors: x.errorMessages.map((m: any) => m.creditErrorMessageText ?? m) };
  const file = x.creditFiles?.[0]?.creditFileDetail?.creditFileResultStatusType;
  const d = x.summaries?.derogatorySummary ?? {};
  const inquiries: string[] = (x.inquiries ?? []).map((i: any) => i.inquiryDate).filter(Boolean).sort();
  return {
    request_id: r.requestId,
    file,
    score: x.scores?.find((s: any) => s.scoreValue)?.scoreValue ? Number(x.scores.find((s: any) => s.scoreValue).scoreValue) : null,
    score_model: x.scores?.[0]?.modelName,
    no_score_reason: x.scores?.find((s: any) => s.noScoreReasonType)?.noScoreReasonType,
    accounts: (x.tradelines ?? []).length,
    inquiries: { count: inquiries.length, first: inquiries[0], last: inquiries.at(-1) },
    derogatory: { collections: Number(d.collectionsCount ?? 0), charge_offs: Number(d.chargeOffsCount ?? 0), late_90_days: Number(d._90DayLates ?? 0), bankruptcies: Number(d.bankruptciesCount ?? 0), public_records: Number(d.publicRecordsCount ?? 0) },
    // chargeOffAmount is not used: the sandbox's Experian files put 931 on every account.
    bad_accounts: (x.tradelines ?? []).filter((t: any) => t.derogatoryDataIndicator).map((t: any) => ({ creditor: t.creditorName, rating: t.currentRatingType, past_due: Number(t.pastDueAmount ?? 0), opened: t.accountOpenedDate })),
    public_records: (x.publicRecords ?? []).map((p: any) => p.publicRecordType ?? p.type ?? p),
  };
}

function identity(r: Raw) {
  const msgs = r.response?.addOnProducts?.[0]?.idManagerVerification?.messages;
  if (!Array.isArray(msgs)) return { request_id: r.requestId, error: `unexpected answer (HTTP ${r.status})` };
  return { request_id: r.requestId, verified: msgs.length === 0, problems: msgs.map((m: any) => ({ code: m.code, text: m.text })) };
}

function fraud(r: Raw) {
  const x = r.response ?? {};
  if (!x.risk) return { request_id: r.requestId, error: `unexpected answer (HTTP ${r.status})` };
  const p = x.risk.phone ?? {};
  return {
    request_id: r.requestId,
    risk_score: x.risk.score,
    phone: { line_type: p.line_type, prepaid: p.prepaid, owner_matches_name: p.owner ? p.owner.first_name_match === 'match' && p.owner.last_name_match === 'match' : null },
    email: { first_seen: x.eam?.date_first_seen, status: x.email_validation?.status },
    ip_distance_from_address: x.risk.postal?.ip_postal_distance,
  };
}

function publicRecords(r: Raw) {
  const x = r.response?.DetailedBLJReport;
  if (!x) return { request_id: r.requestId, error: `unexpected answer (HTTP ${r.status})` };
  const res = x.Results ?? {};
  const party = (rec: any) => rec.Plaintiff?.Name?.UnparsedName;
  return {
    request_id: r.requestId,
    bankruptcies: list(res.Bankruptcies?.BankruptcyRecord).map((b: any) => ({ chapter: b.Chapter ?? b.BankruptcyChapter, status: b.Status ?? b.DispositionType, filed: date(b.FilingDate) })),
    judgments: list(res.Judgments?.JudgmentRecord).map((j: any) => ({ amount: Number(j.TotalJudgmentAmount), status: j.Status, plaintiff: party(j), type: j.JudgmentType, filed: date(j.FilingDate) })),
    liens: list(res.Liens?.LienRecord).map((l: any) => ({ amount: Number(l.TotalLienAmount), status: l.Status, holder: party(l), filed: date(l.FilingDate) })),
  };
}

function phoneOwner(r: Raw) {
  const recs = r.response?.data?.records;
  if (!Array.isArray(recs)) return { request_id: r.requestId, error: `unexpected answer (HTTP ${r.status})` };
  return { request_id: r.requestId, owners: recs.map((x: any) => `${x.firstName ?? ''} ${x.lastName ?? ''}`.trim()) };
}

// An HTTP error is reported as an error, never read as an empty (clean-looking) answer.
const read = <T,>(fn: (r: Raw) => T, r: Raw) =>
  r.status >= 400 ? { request_id: r.requestId, error: `HTTP ${r.status}: ${JSON.stringify(r.response).slice(0, 200)}` } : fn(r);

/** Run every check on one application and summarize. `caseId` finds recorded answers if CRS cannot be reached. */
export async function checkApplication(app: any, caseId: string, creds: () => [string, string]) {
  const raw: Record<string, Raw> = {};
  let recorded = false;
  for (const [name, route, body] of crsRequests(app)) {
    try {
      raw[name] = await post(route, body, creds);
    } catch (e) {
      // Only a network failure falls back to the answers recorded on 2026-10-23, and the summary says so.
      const file = path.join(TRACK_DIR, 'sandbox', 'crs-responses', caseId, app.application_id, `${name}.json`);
      if (!(e instanceof TypeError) || !fs.existsSync(file)) throw e;
      raw[name] = { ...JSON.parse(fs.readFileSync(file, 'utf8')), recorded: true };
      recorded = true;
    }
  }
  return {
    application_id: app.application_id,
    guarantor: `${app.guarantor.first_name} ${app.guarantor.last_name}`,
    source: recorded ? 'recorded CRS sandbox answers from 2026-10-23 (CRS could not be reached)' : 'CRS sandbox, live',
    credit: { transunion: read(creditReport, raw.transunion), equifax: read(creditReport, raw.equifax), experian: read(creditReport, raw.experian) },
    identity: read(identity, raw.identity),
    fraud: read(fraud, raw.fraud),
    public_records: read(publicRecords, raw['public-records']),
    phone_owner: read(phoneOwner, raw['phone-owner']),
  };
}

export type CrsSummary = Awaited<ReturnType<typeof checkApplication>>;
