// Run: node --test tracks/credit-desk/books.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { balances, booksFromCase, newEntries, parseLedger } from './books.ts';
import { parseCsv } from './check-case.ts';

const CASE = join(import.meta.dirname, 'cases', 'fogline-2026-10');
const books = booksFromCase(CASE);
const ledger = parseLedger(books);
const cents = (s: string) => Math.round(Number(s) * 100);
const rows = (file: string) => (existsSync(join(CASE, file)) ? parseCsv(readFileSync(join(CASE, file), 'utf8')) : []);
const bills = rows('bills.csv');
const paidBills = bills.filter((b) => b.paid_on);

test('the Fogline books parse with no errors and every transaction balances', () => {
  assert.deepEqual(ledger.errors, []);
  // One per invoice, payment and bill, and one more for each bill that was paid.
  assert.equal(ledger.transactions.length, rows('invoices.csv').length + rows('payments.csv').length + bills.length + paidBills.length);
  for (const t of ledger.transactions) assert.equal(t.postings.reduce((s, p) => s + p.cents, 0), 0, `line ${t.line}`);
});

test('the planted mistakes are visible in the books', () => {
  const bal = balances(ledger);
  // PMT-8812 is keyed to Greenleaf's INV-24089: that invoice nets to -450.00, and Golden Gate still owes INV-24098.
  const net = (invoice: string) => ledger.transactions.filter((t) => t.meta.invoice === invoice)
    .flatMap((t) => t.postings).filter((p) => p.account.startsWith('Assets:Receivable:')).reduce((s, p) => s + p.cents, 0);
  assert.equal(net('INV-24089'), -45000);
  assert.equal(net('INV-24098'), 194000);
  // C-1004's account total is that -450.00 plus its other open invoice INV-24113 (1,126.80).
  assert.equal(bal.get('Assets:Receivable:C-1004'), 67680);
  // C-1001 paid INV-24098 but the cash went elsewhere, so it is 1,940.00 too high: 4,595.30 instead of 2,655.30.
  assert.equal(bal.get('Assets:Receivable:C-1001'), 459530);
  // The header total is posted, not the lines (4,286.40).
  assert.equal(ledger.transactions.find((t) => t.meta.invoice === 'INV-24105')!.postings[0].cents, 486240);
  // Both copies of the duplicated order are posted.
  assert.equal(ledger.transactions.filter((t) => t.meta.invoice === 'INV-24116' || t.meta.invoice === 'INV-24117').length, 2);
  // The invoice dated 2025 is posted in 2025.
  assert.equal(ledger.transactions.find((t) => t.meta.invoice === 'INV-24111')!.date, '2025-09-29');
  // The unearned discount (PMT-8806, paid after the window) is allowed.
  assert.equal(ledger.transactions.find((t) => t.meta.payment === 'PMT-8806')!.postings.find((p) => p.account === 'Income:Discounts')!.cents, 4920);
});

test('the bank balance in the books exceeds the deposits the bank received by the post-dated check', () => {
  const asOf = JSON.parse(readFileSync(join(CASE, 'case.json'), 'utf8')).as_of;
  // The bank cannot have a check that is dated after the case date. What it paid out for bills is in the books too.
  const received = rows('payments.csv').filter((p) => !(p.payment_date && p.payment_date > asOf)).reduce((s, p) => s + cents(p.amount), 0);
  const paidOut = paidBills.reduce((s, b) => s + cents(b.paid_amount || b.amount), 0);
  assert.equal(balances(ledger).get('Assets:Bank:Operating')! - (received - paidOut), 203675);
  // On the check's received date the books already count it.
  const check = ledger.transactions.find((t) => t.meta.payment === 'PMT-8823')!;
  assert.equal(check.date, '2026-10-20');
  assert.equal(check.meta.check_date, '2026-11-06');
  assert.equal(balances(ledger, '2026-10-20').get('Assets:Bank:Operating')! - balances(ledger, '2026-10-19').get('Assets:Bank:Operating')!, 203675);
});

test('bills in the case become payables and purchases, a resent bill counting twice', () => {
  if (!bills.length) return;
  const bal = balances(ledger);
  for (const id of new Set(bills.map((b) => b.supplier_id))) {
    const mine = bills.filter((b) => b.supplier_id === id);
    const owed = mine.reduce((s, b) => s + cents(b.amount) - (b.paid_on ? cents(b.paid_amount || b.amount) : 0), 0);
    assert.equal(bal.get(`Liabilities:Payable:${id}`), -owed, id);
  }
  assert.equal(bal.get('Expenses:Purchases'), bills.reduce((s, b) => s + cents(b.amount), 0));
});

test('an unbalanced appended entry is caught with its line number', () => {
  const bad = `${books}\n2026-10-23 * "Reapply PMT-8812"\n  Assets:Receivable:C-1001   1940.00 USD\n  Assets:Receivable:C-1004  -1900.00 USD\n`;
  const line = books.split('\n').length + 1; // the books end with a newline, then one blank line, then the entry
  const { errors } = parseLedger(bad);
  assert.equal(errors.length, 1);
  assert.match(errors[0], new RegExp(`^line ${line}: unbalanced transaction, postings add up to 40.00 USD`));
});

test('a posting to an unopened account, a bad date and an unparsable line are caught', () => {
  const { errors } = parseLedger([
    '2025-01-01 open Assets:A USD', '2025-01-01 open Income:B USD', '2025-06-01 open Assets:Late USD',
    '2026-02-30 * "bad day"', '  Assets:A  1.00 USD', '  Income:B', '',
    '2026-03-01 * "ghost"', '  Assets:Ghost  1.00 USD', '  Income:B', '',
    '2025-05-01 * "too early"', '  Assets:Late  1.00 USD', '  Income:B', '',
    'what is this',
  ].join('\n'));
  assert.deepEqual(errors, [
    'line 4: bad date 2026-02-30',
    'line 9: posting to Assets:Ghost, which was never opened',
    'line 13: posting to Assets:Late on 2025-05-01, before it was opened on 2025-06-01',
    'line 16: unparsable line: what is this',
  ]);
});

test('balance assertions are checked, and a posting without an amount takes the balancing amount', () => {
  const head = ['2025-01-01 open Assets:A USD', '2025-01-01 open Income:B USD', '2026-01-02 * "sale"', '  Assets:A  1,250.50 USD', '  Income:B'];
  const ok = parseLedger([...head, '2026-01-03 balance Assets:A  1250.50 USD', '2026-01-03 balance Income:B -1250.50 USD'].join('\n'));
  assert.deepEqual(ok.errors, []);
  assert.equal(ok.transactions[0].postings[1].cents, -125050);
  const bad = parseLedger([...head, '2026-01-02 balance Assets:A  1250.50 USD', '2026-01-03 balance Assets:A  1250.00 USD'].join('\n'));
  assert.deepEqual(bad.errors, [
    'line 6: balance assertion failed for Assets:A on 2026-01-02: expected 1250.50 USD, got 0.00 USD', // holds at the start of the day
    'line 7: balance assertion failed for Assets:A on 2026-01-03: expected 1250.00 USD, got 1250.50 USD',
  ]);
});

test('newEntries finds the two entries an agent appended', () => {
  const added = `${books}
2026-10-23 * "Greenleaf Juice Co." "Reverse PMT-8812"
  reviewed_by: "clerk"
  Assets:Receivable:C-1004   1940.00 USD
  Assets:Receivable:C-1001  -1940.00 USD

; apply it to the right invoice
2026-10-23 ! "Golden Gate Bagel Co." "Reapply PMT-8812 to INV-24098"
  Assets:Receivable:C-1001   1940.00 USD
  Assets:Receivable:C-1004
`;
  const found = newEntries(books, added);
  assert.deepEqual(found.map((t) => t.narration), ['Reverse PMT-8812', 'Reapply PMT-8812 to INV-24098']);
  assert.deepEqual(found.map((t) => t.flag), ['*', '!']);
  assert.equal(found[0].meta.reviewed_by, 'clerk');
  assert.equal(found[1].postings[1].cents, -194000);
  assert.deepEqual(newEntries(books, books), []);
  // An exact copy of an existing entry is new: the first copy matches, the second does not.
  const dup = ledger.transactions[5];
  const lines = books.split('\n');
  const copy = lines.slice(dup.line - 1, dup.line + dup.postings.length + Object.keys(dup.meta).length).join('\n');
  assert.equal(newEntries(books, `${books}\n${copy}\n`).length, 1);
});

test('suppliers and bills become payable and purchase postings', () => {
  const dir = mkdtempSync(join(tmpdir(), 'books-'));
  writeFileSync(join(dir, 'suppliers.csv'), [
    'supplier_id,name,email,phone,address,bank_name,bank_routing,bank_account,bank_changed_on,terms,notes',
    'S-201,"Bay Roasters, Inc.",ar@bayroasters.example,,,Chase,021000021,111222333,,Net 30,',
    'S-202,Pacific Paper,,,,,,,,Net 15,',
  ].join('\n'));
  writeFileSync(join(dir, 'bills.csv'), [
    'bill_id,supplier_id,supplier_invoice,bill_date,due_date,amount,description,po_number,entered_by,status,paid_on,paid_amount',
    'B-901,S-201,BR-5521,2026-09-02,2026-10-02,"2,400.00","Green coffee, 20 bags",PO-77,M. Chen,paid,2026-10-01,2400.00',
    'B-902,S-202,PP-318,2026-09-20,2026-10-05,615.40,Kraft napkins,,J. Park,open,,',
  ].join('\n'));
  const l = parseLedger(booksFromCase(dir));
  assert.deepEqual(l.errors, []);
  const bal = balances(l);
  assert.equal(bal.get('Expenses:Purchases'), 301540);
  assert.equal(bal.get('Liabilities:Payable:S-201'), 0); // billed 2,400.00, then paid
  assert.equal(bal.get('Liabilities:Payable:S-202'), -61540); // billed, still open
  assert.equal(bal.get('Assets:Bank:Operating'), -240000);
  assert.equal(balances(l, '2026-09-30').get('Liabilities:Payable:S-201'), -240000);
  const bill = l.transactions.find((t) => t.meta.bill === 'B-901' && t.postings[0].account === 'Expenses:Purchases')!;
  assert.equal(bill.payee, 'Bay Roasters, Inc.');
  assert.equal(bill.meta.supplier_invoice, 'BR-5521');
  assert.equal(bill.meta.po, 'PO-77');
  // No customers, invoices or payments: only the chart of accounts for them.
  assert.equal(l.transactions.length, 3);
});

test('a case with only applications gets just the chart of accounts', () => {
  const l = parseLedger(booksFromCase(mkdtempSync(join(tmpdir(), 'books-'))));
  assert.deepEqual(l.errors, []);
  assert.equal(l.transactions.length, 0);
  assert.ok(l.accounts.has('Assets:Bank:Operating') && l.accounts.has('Equity:Opening-Balances'));
});
