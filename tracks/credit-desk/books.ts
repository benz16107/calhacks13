// Fogline's books as a Beancount ledger, plus a small reader for it.
// booksFromCase writes the ledger from a case's CSV files, exactly as the accounting system recorded it. parseLedger,
// balances and newEntries read that text (or an agent's copy of it) back. Money is integer cents everywhere.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseCsv } from './check-case.ts';

type Row = Record<string, string>;

// ---------- money ----------

const OPEN_DATE = '2025-01-01';

/** "1,940.00" or "-450" to cents. Returns undefined for anything that is not a decimal with at most 2 places. */
function toCents(text: string): number | undefined {
  const m = /^([+-]?)(\d[\d,]*)(?:\.(\d+))?$/.exec(text.trim());
  if (!m) return undefined;
  const frac = m[3] ?? '';
  if (frac.length > 2 && /[1-9]/.test(frac.slice(2))) return undefined;
  const cents = Number(m[2].replaceAll(',', '')) * 100 + Number(frac.slice(0, 2).padEnd(2, '0'));
  return m[1] === '-' ? -cents : cents;
}
const fmt = (cents: number) => `${cents < 0 ? '-' : ''}${Math.floor(Math.abs(cents) / 100)}.${String(Math.abs(cents) % 100).padStart(2, '0')}`;
const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;

// ---------- booksFromCase ----------

type Posting = [account: string, cents: number];
type Entry = { date: string; payee: string; narration: string; meta: [string, string][]; postings: Posting[] };

const quote = (s: string) => `"${s.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replace(/\s+/g, ' ').trim()}"`;
const BANK = 'Assets:Bank:Operating';

/** Beancount text for the case's ledger as the accounting system recorded it, planted mistakes included. */
export function booksFromCase(caseDir: string): string {
  const read = (f: string): Row[] => (existsSync(join(caseDir, f)) ? parseCsv(readFileSync(join(caseDir, f), 'utf8')) : []);
  const customers = read('customers.csv');
  const invoices = read('invoices.csv');
  const payments = read('payments.csv');
  const suppliers = read('suppliers.csv');
  const bills = read('bills.csv');

  const customerName = new Map(customers.map((c) => [c.customer_id, c.legal_name]));
  const supplierName = new Map(suppliers.map((s) => [s.supplier_id, s.name]));
  const invoiceOwner = new Map(invoices.map((i) => [i.invoice_id, i.customer_id]));
  const receivable = (id: string) => `Assets:Receivable:${id}`;
  const payable = (id: string) => `Liabilities:Payable:${id}`;
  const cents = (s: string) => toCents(s) ?? 0;
  // Only fields with a value become metadata.
  const meta = (...pairs: [string, string | undefined][]) => pairs.filter((p): p is [string, string] => !!p[1]);

  const entries: Entry[] = [];

  // An invoice is posted at its header total. The lines are never read, so a wrong header stays in the books.
  for (const i of invoices) {
    entries.push({
      date: i.invoice_date, payee: customerName.get(i.customer_id) ?? i.bill_to_name ?? '',
      narration: `Invoice ${i.invoice_id}`,
      meta: meta(['invoice', i.invoice_id], ['po', i.po_number], ['terms', i.terms], ['due', i.due_date]),
      postings: [[receivable(i.customer_id), cents(i.total)], ['Income:Sales', -cents(i.total)]],
    });
  }

  // A payment credits the customer that owns the invoice it was applied to, which is where the system put it.
  // Unapplied cash (no invoice) credits the customer on the payment row.
  for (const p of payments) {
    const owner = invoiceOwner.get(p.applied_invoice_id) ?? p.customer_id;
    const amount = cents(p.amount);
    const discount = cents(p.discount_taken);
    const postings: Posting[] = [[BANK, amount]];
    if (discount) postings.push(['Income:Discounts', discount]);
    postings.push([receivable(owner), -(amount + discount)]);
    entries.push({
      date: p.received_date, payee: customerName.get(owner) ?? p.payer_name ?? '',
      narration: p.applied_invoice_id ? `Payment ${p.payment_id} applied to ${p.applied_invoice_id}` : `Payment ${p.payment_id} (unapplied)`,
      meta: meta(['payment', p.payment_id], ['invoice', p.applied_invoice_id], ['payer', p.payer_name], ['method', p.method],
        ['reference', p.reference], ['memo', p.remittance_memo], ['check_date', p.payment_date && p.payment_date !== p.received_date ? p.payment_date : undefined]),
      postings,
    });
  }

  // A bill is a purchase on credit. A bill with a paid_on date is also paid then, for paid_amount (or the full amount).
  for (const b of bills) {
    const payee = supplierName.get(b.supplier_id) ?? '';
    entries.push({
      date: b.bill_date, payee, narration: b.description ? `Bill ${b.bill_id}: ${b.description}` : `Bill ${b.bill_id}`,
      meta: meta(['bill', b.bill_id], ['supplier_invoice', b.supplier_invoice], ['po', b.po_number], ['entered_by', b.entered_by], ['due', b.due_date]),
      postings: [['Expenses:Purchases', cents(b.amount)], [payable(b.supplier_id), -cents(b.amount)]],
    });
    if (b.paid_on) {
      const paid = b.paid_amount ? cents(b.paid_amount) : cents(b.amount);
      entries.push({
        date: b.paid_on, payee, narration: `Payment of bill ${b.bill_id}`, meta: meta(['bill', b.bill_id], ['supplier_invoice', b.supplier_invoice]),
        postings: [[payable(b.supplier_id), paid], [BANK, -paid]],
      });
    }
  }
  entries.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)); // stable: same-day entries keep file order

  const customerIds = [...new Set([...customers.map((c) => c.customer_id), ...invoices.map((i) => i.customer_id), ...payments.map((p) => p.customer_id)])].filter(Boolean);
  const supplierIds = [...new Set([...suppliers.map((s) => s.supplier_id), ...bills.map((b) => b.supplier_id)])].filter(Boolean);
  const accounts = [BANK, ...customerIds.map(receivable), 'Income:Sales', 'Income:Discounts', ...supplierIds.map(payable), 'Expenses:Purchases', 'Equity:Opening-Balances'];

  const out = [
    '; Fogline Supply Co. books, as a Beancount ledger (plain-text double-entry accounting).',
    '; This file mirrors the accounting system as recorded, mistakes included: an invoice is posted at its header total,',
    '; a payment is posted to the customer that owns the invoice it was keyed to, a duplicate invoice is posted twice,',
    '; and a post-dated check counts as cash on the day it arrived. Nothing here has been corrected.',
    '; Assets:Bank:Operating is the operating account at Capital One (the Nessie sandbox). Amounts are USD.',
    '',
    'option "title" "Fogline Supply Co."',
    'option "operating_currency" "USD"',
    '',
    ...accounts.map((a) => `${OPEN_DATE} open ${a} USD`),
  ];
  for (const e of entries) {
    out.push('', `${e.date} * ${e.payee ? `${quote(e.payee)} ` : ''}${quote(e.narration)}`);
    for (const [k, v] of e.meta) out.push(`  ${k}: ${quote(v)}`);
    for (const [account, c] of e.postings) out.push(`  ${account.padEnd(36)}${fmt(c).padStart(12)} USD`);
  }
  return out.join('\n') + '\n';
}

// ---------- parseLedger ----------

export type LedgerTransaction = {
  date: string; flag: '*' | '!'; payee?: string; narration: string; meta: Record<string, string>;
  postings: { account: string; cents: number }[]; line: number;
};
export type Ledger = {
  accounts: Map<string, { opened: string; currencies: string[]; closed?: string }>;
  transactions: LedgerTransaction[];
  errors: string[];
};

const ACCOUNT = '[A-Z][A-Za-z0-9-]*(?::[A-Z0-9][A-Za-z0-9-]*)+';
const AMOUNT = '[+-]?\\d[\\d,]*(?:\\.\\d+)?';
const POSTING = new RegExp(`^(?:[*!]\\s+)?(${ACCOUNT})(?:\\s+(${AMOUNT}))?(?:\\s+([A-Z][A-Z0-9'._-]*))?\\s*(?:;.*)?$`);
const META = /^([a-z][A-Za-z0-9_-]*):\s*(?:"((?:[^"\\]|\\.)*)"|([^\s;]+))\s*(?:;.*)?$/;
const unescape = (s: string) => s.replace(/\\(.)/g, '$1');
// Directives that carry no money. 'pad' is not here on purpose: it moves money, so it is reported instead of ignored.
const IGNORED = new Set(['commodity', 'price', 'note', 'document', 'event', 'query', 'custom', 'option', 'plugin', 'pushtag', 'poptag']);

/** Reads the subset of Beancount that booksFromCase writes and an agent would plausibly append. */
export function parseLedger(text: string): Ledger {
  const accounts: Ledger['accounts'] = new Map();
  const transactions: LedgerTransaction[] = [];
  const errors: string[] = [];
  let skip = false; // a top-level line that failed: its indented lines are not reported again
  const err = (line: number, msg: string) => {
    errors.push(`line ${line}: ${msg}`);
    if (!/^\s/.test(lines[line - 1])) skip = true;
  };
  const closes: { account: string; date: string; line: number }[] = [];
  const asserts: { account: string; date: string; cents: number; line: number }[] = [];
  const postingLines = new Map<LedgerTransaction, number[]>();

  let txn: LedgerTransaction | undefined;
  let missing: { posting: { account: string; cents: number }; line: number } | undefined; // the posting with no amount
  let missingCount = 0;
  let sawPosting = false;
  const finish = () => {
    if (!txn) return;
    if (missingCount > 1) err(txn.line, 'more than one posting has no amount');
    else {
      const sum = txn.postings.reduce((s, p) => s + p.cents, 0);
      if (missing) missing.posting.cents = -sum;
      else if (sum !== 0) err(txn.line, `unbalanced transaction, postings add up to ${fmt(sum)} USD`);
    }
    txn = undefined; missing = undefined; missingCount = 0; sawPosting = false;
  };

  const lines = text.split(/\r?\n/);
  for (let n = 1; n <= lines.length; n++) {
    const raw = lines[n - 1];
    const body = raw.trim();
    if (body === '' || body.startsWith(';')) continue;

    if (/^\s/.test(raw)) { // indented: belongs to the transaction above
      if (!txn) { if (!skip && !META.test(body)) err(n, `unparsable line: ${body}`); continue; } // metadata on open/close is not kept
      const m = META.exec(body);
      if (m) { if (!sawPosting) txn.meta[m[1]] = m[2] !== undefined ? unescape(m[2]) : m[3]; continue; } // posting metadata is dropped
      const p = POSTING.exec(body);
      if (!p) { err(n, `unparsable line: ${body}`); continue; }
      sawPosting = true;
      const posting = { account: p[1], cents: 0 };
      if (p[2] === undefined) {
        if (p[3] !== undefined) { err(n, `unparsable line: ${body}`); continue; }
        missingCount++; missing = { posting, line: n };
      } else {
        const c = toCents(p[2]);
        if (c === undefined) { err(n, `amount ${p[2]} has more than 2 decimal places`); continue; }
        if (p[3] !== undefined && p[3] !== 'USD') { err(n, `only USD is supported, got ${p[3]}`); continue; }
        posting.cents = c;
      }
      txn.postings.push(posting);
      postingLines.get(txn)!.push(n);
      continue;
    }

    finish();
    skip = false;
    const head = /^(\d{4}-\d{1,2}-\d{1,2})\s+(\S+)\s*(.*)$/.exec(body);
    if (!head) {
      if (/^(option|plugin|pushtag|poptag)\b/.test(body)) continue;
      err(n, `unparsable line: ${body}`);
      continue;
    }
    const [, date, kind, rest] = head;
    if (!isDate(date)) { err(n, `bad date ${date}`); continue; }

    if (kind === '*' || kind === '!' || kind === 'txn') {
      const strings: string[] = [];
      let tail = rest;
      for (let m; (m = /^"((?:[^"\\]|\\.)*)"\s*/.exec(tail)); tail = tail.slice(m[0].length)) strings.push(unescape(m[1]));
      if (strings.length > 2 || !/^(?:[#^][\w./-]+\s*)*(?:;.*)?$/.test(tail)) { err(n, `unparsable line: ${body}`); continue; }
      txn = {
        date, flag: kind === '!' ? '!' : '*', ...(strings.length === 2 ? { payee: strings[0] } : {}),
        narration: strings.length === 2 ? strings[1] : strings[0] ?? '', meta: {}, postings: [], line: n,
      };
      postingLines.set(txn, []);
      transactions.push(txn);
    } else if (kind === 'open') {
      const m = new RegExp(`^(${ACCOUNT})(?:\\s+([A-Z][A-Z0-9'._,-]*))?\\s*(?:"[^"]*"\\s*)?(?:;.*)?$`).exec(rest);
      if (!m) err(n, `unparsable line: ${body}`);
      else if (accounts.has(m[1])) err(n, `account ${m[1]} is opened twice`);
      else accounts.set(m[1], { opened: date, currencies: m[2] ? m[2].split(',') : [] });
    } else if (kind === 'close') {
      const m = new RegExp(`^(${ACCOUNT})\\s*(?:;.*)?$`).exec(rest);
      if (!m) err(n, `unparsable line: ${body}`); else closes.push({ account: m[1], date, line: n });
    } else if (kind === 'balance') {
      const m = new RegExp(`^(${ACCOUNT})\\s+(${AMOUNT})\\s+([A-Z][A-Z0-9'._-]*)\\s*(?:;.*)?$`).exec(rest);
      const c = m ? toCents(m[2]) : undefined;
      if (!m || c === undefined) err(n, `unparsable line: ${body}`);
      else if (m[3] !== 'USD') err(n, `only USD is supported, got ${m[3]}`);
      else asserts.push({ account: m[1], date, cents: c, line: n });
    } else if (!IGNORED.has(kind)) err(n, kind === 'pad' ? 'pad is not supported' : `unparsable line: ${body}`);
  }
  finish();

  for (const c of closes) {
    const a = accounts.get(c.account);
    if (!a) err(c.line, `cannot close ${c.account}, it was never opened`);
    else if (c.date < a.opened) err(c.line, `${c.account} is closed on ${c.date}, before it was opened on ${a.opened}`);
    else a.closed = c.date;
  }
  for (const t of transactions) {
    t.postings.forEach((p, i) => {
      const a = accounts.get(p.account);
      const at = postingLines.get(t)![i];
      if (!a) err(at, `posting to ${p.account}, which was never opened`);
      else if (t.date < a.opened) err(at, `posting to ${p.account} on ${t.date}, before it was opened on ${a.opened}`);
      else if (a.closed && t.date > a.closed) err(at, `posting to ${p.account} on ${t.date}, after it was closed on ${a.closed}`);
    });
  }
  const ledger = { accounts, transactions, errors };
  for (const a of asserts) { // a balance assertion holds at the start of its day and covers sub-accounts
    if (!accounts.has(a.account)) { err(a.line, `balance assertion on ${a.account}, which was never opened`); continue; }
    let got = 0;
    for (const [account, c] of tally(transactions, (d) => d < a.date)) if (account === a.account || account.startsWith(`${a.account}:`)) got += c;
    if (got !== a.cents) err(a.line, `balance assertion failed for ${a.account} on ${a.date}: expected ${fmt(a.cents)} USD, got ${fmt(got)} USD`);
  }
  errors.sort((a, b) => Number(a.split(':')[0].slice(5)) - Number(b.split(':')[0].slice(5)));
  return ledger;
}

function tally(transactions: LedgerTransaction[], keep: (date: string) => boolean): Map<string, number> {
  const out = new Map<string, number>();
  for (const t of transactions) if (keep(t.date)) for (const p of t.postings) out.set(p.account, (out.get(p.account) ?? 0) + p.cents);
  return out;
}

/** Cents per account, counting transactions dated on or before `upTo` (all of them if omitted). Opened accounts start at 0. */
export function balances(ledger: Ledger, upTo?: string): Map<string, number> {
  const out = new Map<string, number>([...ledger.accounts.keys()].map((a) => [a, 0]));
  for (const [account, c] of tally(ledger.transactions, (d) => upTo === undefined || d <= upTo)) out.set(account, c);
  return out;
}

const sameEntry = (t: LedgerTransaction) =>
  JSON.stringify([t.date, t.flag, t.payee ?? null, t.narration, Object.entries(t.meta).sort(), t.postings.map((p) => [p.account, p.cents])]);

/** The transactions in `after` that `base` does not have. Equal entries are matched one for one, so a copy of an existing entry counts as new. */
export function newEntries(base: string, after: string): LedgerTransaction[] {
  const have = new Map<string, number>();
  for (const t of parseLedger(base).transactions) have.set(sameEntry(t), (have.get(sameEntry(t)) ?? 0) + 1);
  return parseLedger(after).transactions.filter((t) => {
    const k = sameEntry(t);
    const left = have.get(k) ?? 0;
    if (left > 0) { have.set(k, left - 1); return false; }
    return true;
  });
}

if (import.meta.main) {
  const [dir] = process.argv.slice(2);
  if (!dir) { console.error('usage: node tracks/credit-desk/books.ts <case-dir>   (prints the ledger)'); process.exit(2); }
  process.stdout.write(booksFromCase(dir));
}
