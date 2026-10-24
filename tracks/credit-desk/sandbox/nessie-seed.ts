// Loads a case into Capital One's Nessie sandbox: Fogline's operating account, one customer and account per trade
// customer with its invoices as bills, customer payments as deposits, and each applicant's monthly bank deposits.
// Run on a test VM as root so it can read NESSIE_API_KEY from the box vault: node nessie-seed.ts <case-dir> [ids.json]
// Safe to run again: it looks up every customer, account, bill and deposit before creating it. It never prints the key.
import fs from 'node:fs';
import path from 'node:path';
import { parseCsv } from '../check-case.ts';

const BASE = 'https://api.nessieisreal.com';
const PAYEE = 'Fogline Supply Co.';

function vaultKey(): string {
  const file = process.env.BOX_VAULT ?? '/etc/box/vault.env';
  const m = fs.readFileSync(file, 'utf8').match(/^\s*NESSIE_API_KEY\s*=\s*(.*)$/m);
  if (!m) throw new Error(`NESSIE_API_KEY is not in ${file}`);
  return m[1];
}

// "3150 Geary Blvd" -> street_number "3150", street_name "Geary Blvd"
export function nessieAddress(line1: string, city: string, state: string, zip: string) {
  const m = line1.match(/^(\S+)\s+(.*)$/) ?? [line1, '', line1];
  return { street_number: m[1], street_name: m[2], city, state, zip: zip.slice(0, 5) };
}

// Nessie keeps deposits in whole dollars and silently drops cents, so round here and keep the exact amount in the text.
export const dollars = (amount: string) => Math.round(Number(amount));

if (import.meta.main) {
  const [dir, idsOut] = process.argv.slice(2);
  if (!dir) { console.error('usage: node nessie-seed.ts <case-dir> [ids.json]'); process.exit(2); }
  const key = vaultKey();
  const call = async (method: string, p: string, body?: unknown): Promise<any> => {
    const res = await fetch(`${BASE}${p}?key=${encodeURIComponent(key)}`, {
      method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`${method} ${p}: HTTP ${res.status} ${text.replaceAll(key, '<key>').slice(0, 300)}`);
    return text ? JSON.parse(text) : null;
  };
  const created = { customers: 0, accounts: 0, bills: 0, deposits: 0, withdrawals: 0 };
  let customers: any[] = await call('GET', '/customers');
  async function customer(first_name: string, last_name: string, address: object) {
    const found = customers.find((c) => c.first_name === first_name && c.last_name === last_name);
    if (found) return found._id as string;
    const c = (await call('POST', '/customers', { first_name, last_name, address })).objectCreated;
    customers.push(c);
    created.customers++;
    return c._id as string;
  }
  async function account(customerId: string, nickname: string) {
    const found = (await call('GET', `/customers/${customerId}/accounts`)).find((a: any) => a.nickname === nickname);
    if (found) return found._id as string;
    created.accounts++;
    return (await call('POST', `/customers/${customerId}/accounts`, { type: 'Checking', nickname, rewards: 0, balance: 0 })).objectCreated._id as string;
  }
  async function deposits(accountId: string, items: { id: string; transaction_date: string; amount: string; description: string }[]) {
    const have: any[] = await call('GET', `/accounts/${accountId}/deposits`);
    const out: Record<string, string> = {};
    for (const d of items) {
      const found = have.find((h) => h.description.startsWith(`${d.id} `));
      out[d.id] = found?._id ?? (await call('POST', `/accounts/${accountId}/deposits`, {
        medium: 'balance', transaction_date: d.transaction_date, status: 'completed', amount: dollars(d.amount), description: `${d.id} ${d.description}`,
      })).objectCreated._id;
      if (!found) created.deposits++;
    }
    return out;
  }

  const read = (f: string) => (fs.existsSync(path.join(dir, f)) ? parseCsv(fs.readFileSync(path.join(dir, f), 'utf8')) : []);
  const asOf: string = JSON.parse(fs.readFileSync(path.join(dir, 'case.json'), 'utf8')).as_of;
  const ids: any = { fogline: {}, customers: {}, bills: {}, payments: {}, applicants: {} };

  ids.fogline.customer = await customer('Fogline', 'Supply Co.', nessieAddress('2240 Livingston St', 'Oakland', 'CA', '94606'));
  ids.fogline.account = await account(ids.fogline.customer, 'Fogline Operating');

  const invoices = read('invoices.csv');
  for (const c of read('customers.csv')) {
    const cust = await customer(c.legal_name, c.customer_id, nessieAddress(c.address_line1, c.city, c.state, c.zip));
    const acct = await account(cust, `${c.legal_name} checking`);
    ids.customers[c.customer_id] = { customer: cust, account: acct };
    const have: any[] = await call('GET', `/accounts/${acct}/bills`);
    for (const inv of invoices.filter((i) => i.customer_id === c.customer_id)) {
      const found = have.find((b) => b.nickname === inv.invoice_id);
      ids.bills[inv.invoice_id] = found?._id ?? (await call('POST', `/accounts/${acct}/bills`, {
        status: inv.status === 'paid' ? 'completed' : 'pending', payee: PAYEE, nickname: inv.invoice_id,
        payment_date: inv.due_date, payment_amount: Number(inv.total),
        // Without recurring_date Nessie stores the bill but then fails every bill list on the account with HTTP 400.
        recurring_date: Number(inv.due_date.slice(8, 10)),
      })).objectCreated._id;
      if (!found) created.bills++;
    }
  }

  // The bank sees what the payer sent, not where the ledger applied it. A check dated after as_of cannot clear yet.
  const payments = read('payments.csv').filter((p) => !(p.payment_date && p.payment_date > asOf));
  ids.payments = await deposits(ids.fogline.account, payments.map((p) => ({
    id: p.payment_id, transaction_date: p.received_date, amount: p.amount,
    description: `from ${p.payer_name} | ${p.reference} | memo ${p.remittance_memo || 'none'} | exact ${p.amount}`,
  })));

  const apps = new Map<string, any>();
  if (fs.existsSync(path.join(dir, 'applications'))) {
    for (const f of fs.readdirSync(path.join(dir, 'applications')).filter((f) => f.endsWith('.json'))) {
      const a = JSON.parse(fs.readFileSync(path.join(dir, 'applications', f), 'utf8'));
      apps.set(a.application_id, a);
    }
  }
  const statements = read('sources/bank_statements.csv');
  for (const appId of [...new Set(statements.map((s) => s.application_id))]) {
    const b = apps.get(appId).business;
    const cust = await customer(b.legal_name, appId, nessieAddress(b.billing_address.line1, b.billing_address.city, b.billing_address.state, b.billing_address.zip));
    const acct = await account(cust, `${b.legal_name} checking`);
    ids.applicants[appId] = { customer: cust, account: acct, deposits: await deposits(acct, statements.filter((s) => s.application_id === appId).map((s) => ({
      id: s.month, transaction_date: `${s.month}-28`, amount: s.deposits_total,
      description: `deposits for the month, ${s.deposit_count} items | exact ${s.deposits_total}`,
    }))) };
  }

  // Money out: the bank's own record of returned payments (sources/bank_events.csv) and supplier bills paid before the case date.
  const outflows = [
    ...read('sources/bank_events.csv').filter((e) => e.event === 'returned').map((e) => ({ date: e.date, amount: e.amount, description: `RETURNED ITEM ${e.payment_id} | ${e.reason}` })),
    ...read('bills.csv').filter((b) => b.status === 'paid' && b.paid_on && b.paid_on <= asOf).map((b) => ({ date: b.paid_on, amount: b.paid_amount || b.amount, description: `PAID ${b.bill_id} to ${b.supplier_id}` })),
  ];
  if (outflows.length) {
    const have: any[] = await call('GET', `/accounts/${ids.fogline.account}/withdrawals`);
    ids.withdrawals = {};
    for (const w of outflows) {
      const found = have.find((h) => h.description.startsWith(`${w.description} |`));
      ids.withdrawals[w.description] = found?._id ?? (await call('POST', `/accounts/${ids.fogline.account}/withdrawals`, {
        medium: 'balance', transaction_date: w.date, status: 'completed', amount: dollars(w.amount), description: `${w.description} | exact ${Number(w.amount).toFixed(2)}`,
      })).objectCreated._id;
      if (!found) created.withdrawals++;
    }
  }

  if (idsOut) fs.writeFileSync(idsOut, JSON.stringify(ids, null, 2));
  console.log(`created ${JSON.stringify(created)}; now holds ${Object.keys(ids.customers).length} trade customers, ${Object.keys(ids.bills).length} bills, ${Object.keys(ids.payments).length} payment deposits, ${Object.keys(ids.applicants).length} applicants`);
}
