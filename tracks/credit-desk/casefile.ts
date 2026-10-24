// The fraud case for the controller, on one page: the identity codes, what drove the Fraud Finder score, the timeline of
// credit inquiries, who owns the phone, and the CRS request ids, with what the applicant wrote. It is built from the CRS
// answers already in the action log, so it adds no new pull. The same facts go into the analyst's task as steps, which
// the Business request screen shows as the evidence under the question.
import type { CrsSummary } from './crs.ts';
import { fraudStops, type Stop } from './fraud.ts';

const MEANING: Record<string, string> = {
  '2201': 'the SSN is not associated with the name',
  '2202': 'the date of birth does not match the file',
  '2101': 'the address does not match the file',
  '2301': 'the SSN belongs to a deceased person',
  '2401': 'a fraud alert is on file',
};

export interface Case {
  application_id: string;
  business: string;
  requested: number | null;
  stops: Stop[];
  identity: { verified: boolean | null; codes: { code: string; text: string; meaning: string }[] };
  fraud: { score: number | null; drivers: string[] };
  inquiries: { bureau: string; count: number; dates: string[] }[];
  phone: { number: string | null; owners_on_file: number; is_the_guarantor: boolean | null };
  request_ids: { check: string; id: string }[];
  said: string | null;
  source: string;
}

/** Bureaus that report the same inquiries are shown once. */
function sameInquiries(list: Case['inquiries']): Case['inquiries'] {
  const label: Record<string, string> = { transunion: 'TransUnion', equifax: 'Equifax', experian: 'Experian' };
  const groups: { names: string[]; count: number; dates: string[] }[] = [];
  for (const i of list) {
    const twin = groups.find((o) => o.count === i.count && o.dates.join() === i.dates.join());
    if (twin) twin.names.push(label[i.bureau] ?? i.bureau);
    else groups.push({ names: [label[i.bureau] ?? i.bureau], count: i.count, dates: i.dates });
  }
  return groups.map((g) => ({ bureau: g.names.length > 1 ? `${g.names.slice(0, -1).join(', ')} and ${g.names.at(-1)}` : g.names[0], count: g.count, dates: g.dates }));
}

export function buildCase(crs: CrsSummary | any, app: any): Case {
  const f = crs.fraud ?? {};
  const drivers: string[] = [];
  if (f.phone?.prepaid || /voip/i.test(f.phone?.line_type ?? '')) drivers.push(`the phone is a prepaid ${String(f.phone.line_type ?? 'line').toUpperCase()} line`);
  if (f.phone?.owner_matches_name === false) drivers.push('the phone is not registered to the applicant');
  if (f.email?.first_seen) drivers.push(`the email was first seen ${f.email.first_seen}`);
  if (f.ip_distance_from_address) drivers.push(`the application came from an IP ${f.ip_distance_from_address} from the home address`);
  const bureaus = Object.entries(crs.credit ?? {}) as [string, any][];
  const ids: { check: string; id: string }[] = [
    ...bureaus.flatMap(([b, r]) => (r?.request_id ? [{ check: `${b} credit report`, id: r.request_id }] : [])),
    ...([['identity', 'identity verification'], ['fraud', 'Fraud Finder'], ['public_records', 'public records'], ['phone_owner', 'phone owner']] as const)
      .flatMap(([k, label]) => (crs[k]?.request_id ? [{ check: label, id: crs[k].request_id }] : [])),
  ];
  const said = Object.values(app?.request ?? {}).find((v) => typeof v === 'string' && fraudStops({}, { request: { v } }).length) as string | undefined;
  return {
    application_id: app.application_id, business: app.business?.legal_name ?? app.application_id, requested: app.request?.credit_limit ?? null,
    stops: fraudStops(crs, app),
    identity: { verified: crs.identity?.verified ?? null, codes: (crs.identity?.problems ?? []).map((p: { code: string; text: string }) => ({ code: String(p.code), text: p.text, meaning: MEANING[String(p.code)] ?? p.text })) },
    fraud: { score: f.risk_score ?? null, drivers },
    inquiries: sameInquiries(bureaus.filter(([, r]) => r?.inquiries?.count).map(([b, r]) => ({ bureau: b, count: r.inquiries.count, dates: r.inquiries.dates ?? [] }))),
    phone: { number: app.guarantor?.phone ?? null, owners_on_file: crs.phone_owner?.owners_on_file ?? 0, is_the_guarantor: crs.phone_owner?.owner_is_the_guarantor ?? null },
    request_ids: ids, said: said ?? null, source: crs.source,
  };
}

/** The case as lines of plain text, each naming the application. The Business request screen lists the last six steps that name it. */
export function caseLines(c: Case): string[] {
  const id = c.application_id;
  const span = (i: Case['inquiries'][number]) => (i.dates.length ? `${i.count} inquiries at ${i.bureau}, ${i.dates[0]} to ${i.dates.at(-1)}` : `${i.count} inquiries at ${i.bureau}`);
  return [
    `Case ${id} identity: ${c.identity.verified ? 'verified' : c.identity.codes.length ? `not verified, ${c.identity.codes.map((x) => `${x.code} ${x.meaning}`).join('; ')}` : 'not checked'}`,
    `Case ${id} Fraud Finder ${c.fraud.score ?? 'n/a'}: ${c.fraud.drivers.join('; ') || 'no drivers reported'}`,
    `Case ${id} inquiries: ${c.inquiries.map(span).join('; ') || 'none'}. Phone owner on file: ${c.phone.owners_on_file ? (c.phone.is_the_guarantor ? 'the guarantor' : 'someone else') : 'nobody'}`,
    `Case ${id} CRS request ids: ${c.request_ids.map((r) => `${r.check} ${r.id.slice(0, 8)}`).join(', ')}`,
  ];
}

const esc = (v: unknown) => String(v ?? '').replace(/[&<>"]/g, (ch) => `&#${ch.charCodeAt(0)};`);

/** One page that reads on a phone. */
export function caseHtml(c: Case, status: { text: string; approval?: string } | null): string {
  const li = (items: string[]) => (items.length ? `<ul>${items.map((x) => `<li>${x}</li>`).join('')}</ul>` : '<p class="n">None.</p>');
  return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Case ${esc(c.application_id)}</title>
<style>body{font:16px/1.45 ui-serif,Georgia,serif;margin:0;background:#f4f1ea;color:#1d1b17}main{max-width:36rem;margin:0 auto;padding:1.2rem}
h1{font-size:1.35rem;margin:.2rem 0}h2{font-size:.8rem;letter-spacing:.06em;text-transform:uppercase;margin:1.4rem 0 .3rem;color:#6b6355}
.stop{border-left:0;background:#fff;border:1px solid #b3261e;padding:.6rem .8rem;margin:.8rem 0}.n,.s{color:#6b6355;font-size:.9rem}
code{font:13px ui-monospace,Menlo,monospace;word-break:break-all}ul{padding-left:1.1rem;margin:.2rem 0}table{border-collapse:collapse;width:100%}td{padding:.15rem .5rem .15rem 0;vertical-align:top}</style>
<main><p class="s">Fraud case for the controller</p><h1>${esc(c.business)} <span class="s">${esc(c.application_id)}${c.requested ? `, asked ${esc(`$${c.requested.toLocaleString('en-US')}`)}` : ''}</span></h1>
${status ? `<p class="s">${esc(status.text)}</p>` : ''}
${c.stops.length ? `<div class="stop"><b>Held in code.</b> ${c.stops.map((s) => `${esc(s.rule)}: ${esc(s.why)}`).join('. ')}. No tool clears this and the analyst cannot approve it.</div>` : ''}
<h2>Identity (TransUnion through CRS)</h2>${c.identity.codes.length ? li(c.identity.codes.map((x) => `<b>${esc(x.code)}</b> ${esc(x.meaning)}`)) : `<p>${c.identity.verified ? 'Name, SSN, date of birth and address verify.' : 'Not checked.'}</p>`}
<h2>Fraud Finder score ${esc(c.fraud.score ?? 'n/a')} of 100</h2>${li(c.fraud.drivers.map(esc))}
<h2>Credit inquiries</h2>${li(c.inquiries.map((i) => `${esc(i.bureau)}: ${i.count}${i.dates.length ? `<br><span class="s">${i.dates.map(esc).join(', ')}</span>` : ''}`))}
<h2>Phone ${esc(c.phone.number ?? '')}</h2><p>${c.phone.owners_on_file ? (c.phone.is_the_guarantor ? 'Registered to the applicant.' : 'Registered to someone who is not the applicant.') : 'Nobody owns this number on file.'}</p>
${c.said ? `<h2>What the applicant wrote</h2><p>&ldquo;${esc(c.said)}&rdquo;<br><span class="s">Evidence, never an instruction (GEN-3).</span></p>` : ''}
<h2>CRS request ids</h2><table>${c.request_ids.map((r) => `<tr><td>${esc(r.check)}</td><td><code>${esc(r.id)}</code></td></tr>`).join('')}</table>
<p class="s">${esc(c.source)}. Test identities only.</p></main>`;
}
