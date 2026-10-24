// The books. Each run starts from the case's books (books.ts, Beancount). An agent drafts entries in its own copy of the
// file, but an entry reaches the real books only through credit-desk.post_entry: checked as Beancount, a correction
// linked to the entry it fixes, and the controller's OK for a write-off (BK-1). The real books are rebuilt from the log, so
// undoing a task takes its entries back out, and nobody edits a past entry: a fix is a new entry that reverses it.
import type { Task, Tool } from '../../core/contract.ts';
import { booksFromCase, newEntries, parseLedger, type LedgerTransaction } from './books.ts';
import { checkRules, controllerGate, marker, readLog, rulesField, rulesOf, runInfo, runOf, seatOf, toolUses, type RunInfo } from './desk.ts';

const usd = (n: number) => (n / 100).toFixed(2);

/** Posted entries of a run, in log order, from tasks that are not undone, as Beancount text with a provenance comment. */
export function postedEntries(info: RunInfo, tasks: Task[]): { seq: number; seat: string; text: string; kind: string }[] {
  const run = tasks.filter((t) => runOf(t.source) === info.run && t.state !== 'undone');
  const seat = new Map(run.map((t) => [t.id, seatOf(t)]));
  const out: { seq: number; seat: string; text: string; kind: string }[] = [];
  for (const u of toolUses(readLog(), new Set(run.map((t) => t.id)))) {
    if (!u.ok) continue;
    const o = u.output;
    const who = seat.get(u.task) ?? 'seat';
    if (u.tool === 'credit-desk.post_entry' && o?.status === 'recorded') {
      out.push({ seq: u.seq, seat: who, kind: 'entry', text: `; posted by the ${who} (task ${u.task}, log entry ${u.seq})${o.fixes ? `, fixes ${o.fixes}` : ''}; rules ${o.rules.join(', ')}${o.approval ? `; approved by ${o.approval.by}` : ''}\n${o.entry.trim()}` });
    }
    if (u.tool === 'credit-desk.enter_bill' && o?.status === 'recorded') {
      const b = o.bill;
      out.push({ seq: u.seq, seat: who, kind: 'bill', text: `; entered by the ${who} (task ${u.task}, log entry ${u.seq})\n${b.bill_date} * "${o.supplier ?? b.supplier_id}" "Bill ${b.bill_id}, invoice ${b.supplier_invoice}"\n  bill: "${b.bill_id}"\n  Expenses:Purchases  ${Number(b.amount).toFixed(2)} USD\n  Liabilities:Payable:${b.supplier_id}  -${Number(b.amount).toFixed(2)} USD` });
    }
    if (u.tool === 'credit-desk.pay_bill' && o?.status === 'paid' && !o.already) {
      const p = o.payment;
      out.push({ seq: u.seq, seat: who, kind: 'payment', text: `; paid by the ${who} (task ${u.task}, log entry ${u.seq})${p.approval ? `; approved by ${p.approval.by}` : ''}; ${p.bank}\n${p.date} * "${p.supplier}" "Pay ${p.bill_id}"\n  bill: "${p.bill_id}"\n  Liabilities:Payable:${p.supplier_id}  ${Number(p.amount).toFixed(2)} USD\n  Assets:Bank:Operating  -${Number(p.amount).toFixed(2)} USD` });
    }
  }
  return out;
}

/** The real books of a run: the case's books plus every posted entry. */
export function realBooks(info: RunInfo, tasks: Task[]) {
  const base = booksFromCase(info.caseDir);
  const posted = postedEntries(info, tasks);
  const text = posted.length ? `${base.trimEnd()}\n\n; ---- posted through the credit desk (rebuilt from the box's log) ----\n\n${posted.map((p) => p.text).join('\n\n')}\n` : base;
  return { text, posted, ledger: parseLedger(text) };
}

const ids = (t: LedgerTransaction) => Object.values(t.meta);

export const bookTools: Tool[] = [
  {
    name: 'credit-desk.post_entry',
    description: `Post a journal entry to Fogline's real books (Beancount, books/ledger.beancount). Draft it in your copy first. A correction is a new entry that reverses or adjusts the wrong one; never edit a past entry. Set "fixes" to the id the correction is about (an invoice, payment or bill id that is in the books). An entry that writes anything off comes back "needs controller" with a question for box_ask (BK-1).`,
    input: {
      type: 'object',
      properties: {
        entry: { type: 'string', description: 'Beancount text: one or more transactions, using accounts that are open in the books.' },
        fixes: { type: 'string', description: 'For a correction: the invoice, payment or bill id it corrects.' },
        why: { type: 'string' },
        rules: rulesField,
      },
      required: ['entry', 'why', 'rules'],
    },
    async run(input, ctx) {
      const rules = checkRules(rulesOf(ctx), input.rules);
      const info = runInfo(readLog(), runOf(ctx.task!.source)!)!;
      const books = realBooks(info, ctx.box.tasks());
      const entry = String(input.entry ?? '').trim();
      const added = parseLedger(`${books.text}\n${entry}\n`);
      const newErrors = added.errors.filter((e) => !books.ledger.errors.includes(e));
      if (newErrors.length) return { status: 'refused', why: 'The entry is not valid against the books.', errors: newErrors.slice(0, 8) };
      const txns = newEntries(books.text, `${books.text}\n${entry}\n`);
      if (!txns.length) return { status: 'refused', why: 'No transaction in the entry.' };
      if (input.fixes) {
        const known = books.ledger.transactions.some((t) => ids(t).includes(String(input.fixes)));
        if (!known) return { status: 'refused', why: `Nothing in the books carries the id ${input.fixes}, so there is nothing to fix.` };
      }
      const moved = Math.max(...txns.flatMap((t) => t.postings.map((p) => Math.abs(p.cents))));
      const writeOff = txns.some((t) => t.postings.some((p) => /writeoff|baddebt/i.test(p.account.replace(/[-:]/g, ''))));
      let approval: { id: string; approved: boolean; by: string; reason?: string } | undefined;
      if (writeOff) {
        const mark = marker(input.fixes ? String(input.fixes) : 'books', 'post', moved / 100);
        const gate = controllerGate(ctx, mark, `Credit desk ${mark}: post a journal entry moving $${usd(moved)}${writeOff ? ' that writes something off' : ''}${input.fixes ? `, a correction of ${input.fixes}` : ''}? The ${seatOf(ctx.task!)} says: ${String(input.why).slice(0, 300)} Rules: ${rules.join(', ')}.`);
        if (gate.pending) return gate.pending;
        approval = gate.approval!;
        if (!approval.approved) return { status: 'denied', reason: approval.reason ?? null, then: 'The controller said no. Do not post it. Record what you will do instead.' };
      }
      ctx.log(`Books: posted ${txns.length} entr${txns.length > 1 ? 'ies' : 'y'}${input.fixes ? ` fixing ${input.fixes}` : ''} (${rules.join(', ')})`);
      return { status: 'recorded', entry, fixes: input.fixes ?? null, rules, approval: approval ?? null, transactions: txns.length };
    },
  },
];
