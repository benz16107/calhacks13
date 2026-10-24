// Capital One's Nessie sandbox as the credit desk's bank. Read-only here; sandbox/nessie-seed.ts loads a case into it.
// Never put the key in a message: it travels in the URL, so errors name the path only.
import { safeId } from './desk.ts';

const BASE = 'https://api.nessieisreal.com';
export const NESSIE_HOST = 'api.nessieisreal.com';

export interface BankQuery { what: 'deposits' | 'bills' | 'statements'; customer_id?: string; application_id?: string }

const getter = (key: string) => async (p: string): Promise<any> => {
  const res = await fetch(`${BASE}${p}?key=${encodeURIComponent(key)}`);
  if (!res.ok) throw new Error(`Nessie ${p.replace(/[0-9a-f-]{36}/g, '<id>')}: HTTP ${res.status}`);
  return res.json();
};

async function operatingAccount(key: string) {
  const get = getter(key);
  const fogline = ((await get('/customers')) as any[]).find((c) => c.first_name === 'Fogline' && c.last_name === 'Supply Co.');
  const account = fogline && ((await get(`/customers/${fogline._id}/accounts`)) as any[]).find((a) => a.nickname === 'Fogline Operating');
  if (!account) throw new Error('the operating account is not in the bank; load the case with sandbox/nessie-seed.ts');
  return account;
}

/**
 * Pay a supplier from the operating account: a Nessie withdrawal, test money. `run` goes in the description so a
 * run sees its own payments and not those of earlier demo runs. Nessie keeps whole dollars.
 */
export async function payFromOperating(key: string, p: { date: string; amount: number; description: string; run: string }) {
  const account = await operatingAccount(key);
  // No idempotency key at Nessie: if this run already paid this bill (a call cut off by a restart), don't pay again.
  const prior = ((await getter(key)(`/accounts/${account._id}/withdrawals`)) as any[]).find((w) => w.description.startsWith(`${p.description} |`) && w.description.includes(`| run ${p.run} |`));
  if (prior) return prior._id as string;
  const res = await fetch(`${BASE}/accounts/${account._id}/withdrawals?key=${encodeURIComponent(key)}`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ medium: 'balance', transaction_date: p.date, status: 'completed', amount: Math.round(p.amount), description: `${p.description} | exact ${p.amount.toFixed(2)} | run ${p.run} | test payment` }),
  });
  if (!res.ok) throw new Error(`Nessie withdrawal: HTTP ${res.status}`);
  return ((await res.json()) as { objectCreated: { _id: string } }).objectCreated._id;
}

/**
 * `names` maps the case's customer and application ids to their legal names, so another case's data is never returned.
 * `asOf` is the case date: the bank shows nothing after it. Money out shows the bank's returned items and this run's
 * own supplier payments.
 */
export async function readBank(q: BankQuery, key: string, names: Map<string, string>, asOf = '9999-12-31', run = '') {
  const get = getter(key);
  const customers: any[] = await get('/customers');
  const accountOf = async (c: any, nickname?: string) => {
    const accounts: any[] = await get(`/customers/${c._id}/accounts`);
    return nickname ? accounts.find((a) => a.nickname === nickname) : accounts[0];
  };
  const deposits = async (account: any) =>
    ((await get(`/accounts/${account._id}/deposits`)) as any[])
      .filter((d) => d.transaction_date <= asOf)
      .map((d) => ({ date: d.transaction_date, amount: d.amount, status: d.status, description: d.description }))
      .sort((a, b) => a.date.localeCompare(b.date));
  const caseCustomer = (id: string) => {
    const name = names.get(id);
    const c = customers.find((x) => x.last_name === id && x.first_name === name);
    if (!c) throw new Error(`${id} is not in the bank for this case`);
    return c;
  };
  const note = 'Nessie keeps deposits in whole dollars; the exact amount is at the end of each description.';

  if (q.what === 'deposits') {
    const account = await operatingAccount(key);
    const out = ((await get(`/accounts/${account._id}/withdrawals`)) as any[])
      .filter((w) => w.transaction_date <= asOf && (/^(RETURNED|PAID) /.test(w.description) || (run && w.description.includes(`| run ${run} |`))))
      .map((w) => ({ date: w.transaction_date, amount: w.amount, description: w.description }))
      .sort((a, b) => a.date.localeCompare(b.date));
    return { account: 'Fogline Operating', as_of: asOf, note, deposits: await deposits(account), money_out: out };
  }
  if (q.what === 'bills') {
    const id = safeId(q.customer_id);
    const account = await accountOf(caseCustomer(id));
    const bills: any[] = await get(`/accounts/${account._id}/bills`);
    return { customer_id: id, bills: bills.map((b) => ({ invoice: b.nickname, status: b.status, amount: b.payment_amount, due: b.payment_date })) };
  }
  if (q.what === 'statements') {
    const id = safeId(q.application_id);
    return { application_id: id, note, deposits: await deposits(await accountOf(caseCustomer(id))) };
  }
  throw new Error('what must be deposits, bills or statements');
}
