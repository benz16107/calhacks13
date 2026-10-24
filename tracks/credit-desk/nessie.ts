// Capital One's Nessie sandbox as the credit desk's bank. Read-only here; sandbox/nessie-seed.ts loads a case into it.
// Never put the key in a message: it travels in the URL, so errors name the path only.
import { safeId } from './desk.ts';

const BASE = 'https://api.nessieisreal.com';
export const NESSIE_HOST = 'api.nessieisreal.com';

export interface BankQuery { what: 'deposits' | 'bills' | 'statements'; customer_id?: string; application_id?: string }

/** `names` maps the case's customer and application ids to their legal names, so another case's data is never returned. */
export async function readBank(q: BankQuery, key: string, names: Map<string, string>) {
  const get = async (p: string): Promise<any> => {
    const res = await fetch(`${BASE}${p}?key=${encodeURIComponent(key)}`);
    if (!res.ok) throw new Error(`Nessie ${p.replace(/[0-9a-f-]{36}/g, '<id>')}: HTTP ${res.status}`);
    return res.json();
  };
  const customers: any[] = await get('/customers');
  const accountOf = async (c: any, nickname?: string) => {
    const accounts: any[] = await get(`/customers/${c._id}/accounts`);
    return nickname ? accounts.find((a) => a.nickname === nickname) : accounts[0];
  };
  const deposits = async (account: any) =>
    ((await get(`/accounts/${account._id}/deposits`)) as any[])
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
    const fogline = customers.find((c) => c.first_name === 'Fogline' && c.last_name === 'Supply Co.');
    const account = fogline && (await accountOf(fogline, 'Fogline Operating'));
    if (!account) throw new Error('the operating account is not in the bank; load the case with sandbox/nessie-seed.ts');
    return { account: 'Fogline Operating', note, deposits: await deposits(account) };
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
