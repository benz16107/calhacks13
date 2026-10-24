// The AP clerk's tools: enter a supplier bill, pay one, or hold, void or refer it. The limits are enforced here, not
// in the prompt: no paying a duplicate (AP-3), no paying a bill this seat entered (AP-1), the controller above 5,000
// (AP-2), and no payment at all to a bank account that changed without a confirming call (AP-4).
import fs from 'node:fs';
import type { Ctx, Tool } from '../../core/contract.ts';
import { parseCsv } from './check-case.ts';
import { caseFile, checkRules, controllerGate, marker, money, readLog, rulesField, rulesOf, runInfo, runOf, safeId, seatOf, toolUses, type ToolUse } from './desk.ts';
import { NESSIE_HOST, payFromOperating } from './nessie.ts';

export const AP_LIMIT = 5000;
export const AP_ACTIONS = ['hold', 'void', 'wait', 'refer as suspected fraud', 'bank change confirmed'];
const NEEDS_CONTROLLER = new Set(['refer as suspected fraud', 'bank change confirmed']);
const normInv = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');
const usd = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface Bill { bill_id: string; supplier_id: string; supplier_invoice: string; bill_date: string; due_date: string; amount: number; description: string; po_number: string; entered_by: string; status: string; paid_on: string }

function csv(ctx: Ctx, name: string) {
  const f = caseFile(ctx, 'case', name);
  return fs.existsSync(f) ? parseCsv(fs.readFileSync(f, 'utf8')) : [];
}

/** This run's tool uses so far, from every seat of the run. */
function runUses(ctx: Ctx): ToolUse[] {
  const run = runOf(ctx.task!.source);
  const tasks = new Set(ctx.box.tasks().filter((t) => runOf(t.source) === run && t.state !== 'undone').map((t) => t.id));
  return toolUses(readLog(), tasks);
}

function bills(ctx: Ctx, uses: ToolUse[]): Bill[] {
  const fromCase = csv(ctx, 'bills.csv').map((b) => ({ ...b, amount: Number(b.amount) }) as unknown as Bill);
  const entered = uses.filter((u) => u.tool === 'credit-desk.enter_bill' && u.ok && u.output?.status === 'recorded').map((u) => u.output.bill as Bill);
  return [...fromCase, ...entered];
}

const supplierOf = (ctx: Ctx, id: string) => {
  const s = csv(ctx, 'suppliers.csv').find((x) => x.supplier_id === id);
  if (!s) throw new Error(`there is no supplier ${id} in this case`);
  return s;
};

const asOf = (ctx: Ctx) => JSON.parse(fs.readFileSync(caseFile(ctx, 'case', 'case.json'), 'utf8')).as_of as string;

export const apTools: Tool[] = [
  {
    name: 'credit-desk.enter_bill',
    description: 'Enter a supplier bill that is not in bills.csv yet, from a supplier invoice in the AP inbox. Returns its new bill id. A bill this seat enters cannot be paid by this seat alone (AP-1).',
    input: {
      type: 'object',
      properties: {
        supplier_id: { type: 'string' }, supplier_invoice: { type: 'string' }, bill_date: { type: 'string' }, due_date: { type: 'string' },
        amount: { type: 'number' }, description: { type: 'string' }, po_number: { type: 'string' }, source: { type: 'string', description: 'Where it came from, e.g. the message id.' },
      },
      required: ['supplier_id', 'supplier_invoice', 'bill_date', 'due_date', 'amount', 'source'],
    },
    async run(input, ctx) {
      const s = supplierOf(ctx, safeId(input.supplier_id));
      const amount = Number(input.amount);
      if (!(amount > 0)) throw new Error('amount must be a positive number of dollars');
      for (const k of ['bill_date', 'due_date']) if (!/^\d{4}-\d{2}-\d{2}$/.test(String(input[k]))) throw new Error(`${k} must be YYYY-MM-DD`);
      const uses = runUses(ctx);
      const all = bills(ctx, uses);
      const same = all.find((b) => b.supplier_id === s.supplier_id && normInv(b.supplier_invoice) === normInv(String(input.supplier_invoice)));
      if (same) return { status: 'refused', why: `${same.bill_id} is already supplier invoice ${same.supplier_invoice} from ${s.name} (AP-3). Do not enter it again.` };
      const next = Math.max(0, ...all.map((b) => Number(b.bill_id.replace(/\D/g, '')) || 0)) + 1;
      const bill: Bill = {
        bill_id: `B-${next}`, supplier_id: s.supplier_id, supplier_invoice: String(input.supplier_invoice), bill_date: input.bill_date, due_date: input.due_date,
        amount, description: String(input.description ?? ''), po_number: String(input.po_number ?? ''), entered_by: seatOf(ctx.task!), status: 'open', paid_on: '',
      };
      ctx.log(`AP: entered ${bill.bill_id}, ${s.name} invoice ${bill.supplier_invoice}, ${usd(amount)}, due ${bill.due_date} (from ${input.source})`);
      return { status: 'recorded', bill, supplier: s.name, note: 'You entered this bill, so you cannot pay it alone (AP-1).' };
    },
  },
  {
    name: 'credit-desk.pay_bill',
    description: `Pay a supplier bill from Fogline's operating account at the bank (Capital One Nessie sandbox, test money). Refuses a duplicate, a bill already paid, and any payment to bank details changed without a confirming call. Over ${money(AP_LIMIT)}, or a bill this seat entered, comes back "needs controller" with a question for box_ask.`,
    input: { type: 'object', properties: { bill_id: { type: 'string' }, why: { type: 'string' }, rules: rulesField }, required: ['bill_id', 'rules'] },
    secrets: ['NESSIE_API_KEY'],
    hosts: [NESSIE_HOST],
    cost: () => 0,
    async run(input, ctx) {
      const id = safeId(input.bill_id);
      const rules = checkRules(rulesOf(ctx), input.rules);
      const uses = runUses(ctx);
      const all = bills(ctx, uses);
      const bill = all.find((b) => b.bill_id === id);
      if (!bill) throw new Error(`there is no bill ${id} in this case`);
      if (bill.status === 'paid') return { status: 'refused', why: `${id} was already paid on ${bill.paid_on}.` };
      // Idempotent: a bill paid once in this run is never paid again, even after a restart mid-call.
      const paid = uses.find((u) => u.tool === 'credit-desk.pay_bill' && u.ok && u.output?.status === 'paid' && u.output.payment.bill_id === id);
      if (paid) return { ...paid.output, already: true };
      const acted = uses.filter((u) => u.tool === 'credit-desk.ap_action' && u.ok && u.output?.status === 'recorded' && u.output.action.subject === id).map((u) => u.output.action.action);
      if (acted.includes('void')) return { status: 'refused', why: `${id} was voided in this run.` };
      if (acted.includes('hold') || acted.includes('refer as suspected fraud')) return { status: 'refused', why: `${id} is on hold. Only the controller can release it.` };
      // AP-3: a later copy of the same supplier invoice, or the same amount within 30 days, is a duplicate.
      const dup = all.find((b) => b.bill_id !== id && b.supplier_id === bill.supplier_id && b.bill_date <= bill.bill_date && b.bill_id < id &&
        (normInv(b.supplier_invoice) === normInv(bill.supplier_invoice) || (b.amount === bill.amount && Math.abs(Date.parse(b.bill_date) - Date.parse(bill.bill_date)) <= 30 * 86400000)));
      if (dup) return { status: 'refused', why: `${id} looks like a duplicate of ${dup.bill_id} (same supplier, invoice ${dup.supplier_invoice}, ${usd(dup.amount)}). Void it; do not pay it (AP-3).` };
      const s = supplierOf(ctx, bill.supplier_id);
      // AP-4: changed bank details are confirmed by a call to the number on record, and only the controller says so.
      const confirmed = uses.some((u) => u.tool === 'credit-desk.ap_action' && u.ok && u.output?.status === 'recorded' && u.output.action.subject === s.supplier_id && u.output.action.action === 'bank change confirmed');
      if (s.bank_changed_on && !confirmed) {
        return { status: 'refused', why: `${s.name}'s bank details changed on ${s.bank_changed_on} and nobody has confirmed them by calling ${s.phone}, the number on record (AP-4). No payment goes to the new account. Hold ${id} and refer the change to the controller.` };
      }
      const later = all.find((b) => b.bill_id !== id && b.supplier_id === bill.supplier_id && b.bill_id > id && normInv(b.supplier_invoice) === normInv(bill.supplier_invoice));
      const mine = bill.entered_by === seatOf(ctx.task!);
      let approval: { id: string; approved: boolean; by: string; reason?: string } | undefined;
      if (bill.amount > AP_LIMIT || mine) {
        const mark = marker(id, 'pay', bill.amount);
        const gate = controllerGate(ctx, mark, `Credit desk ${mark}: pay ${usd(bill.amount)} to ${s.name} for bill ${id} (invoice ${bill.supplier_invoice}, due ${bill.due_date})? ${mine ? 'The AP clerk entered this bill itself, so a second person must approve it (AP-1).' : `Over the AP clerk's ${money(AP_LIMIT)} limit (AP-2).`} Why: ${String(input.why ?? '').slice(0, 300)} Rules: ${rules.join(', ')}.`);
        if (gate.pending) return gate.pending;
        approval = gate.approval!;
        if (!approval.approved) return { status: 'denied', reason: approval.reason ?? null, then: 'The controller said no. Do not pay this bill. Record what you will do instead with credit-desk.ap_action (hold or wait), citing the reason.' };
      }
      const info = runInfo(readLog(), runOf(ctx.task!.source)!)!;
      const date = asOf(ctx);
      const nessie = info.nessie ? await payFromOperating(ctx.secret('NESSIE_API_KEY'), { date, amount: bill.amount, description: `${id} to ${s.supplier_id} ${s.name}`, run: info.run }) : null;
      ctx.log(`AP: paid ${id}, ${usd(bill.amount)} to ${s.name}${approval ? `, approved by ${approval.by}` : ''} (${rules.join(', ')})`);
      return {
        status: 'paid',
        payment: { bill_id: id, supplier_id: s.supplier_id, supplier: s.name, amount: bill.amount, date, decided_by: approval ? `controller (${approval.by})` : seatOf(ctx.task!), approval: approval ?? null, rules, bank: nessie ? 'Nessie sandbox, test money' : 'recorded only (this case has no bank)', nessie_withdrawal: nessie },
        ...(later ? { warning: `${later.bill_id} is the same supplier invoice again. Void it (AP-3).` } : {}),
      };
    },
  },
  {
    name: 'credit-desk.ap_action',
    description: `Record what you do with a bill or supplier: ${AP_ACTIONS.join(', ')}. "refer as suspected fraud" and "bank change confirmed" need the controller and come back "needs controller" with a question for box_ask.`,
    input: { type: 'object', properties: { subject: { type: 'string', description: 'A bill id or supplier id.' }, action: { type: 'string', enum: AP_ACTIONS }, detail: { type: 'string' }, rules: rulesField }, required: ['subject', 'action', 'detail', 'rules'] },
    decides: (i) => `record "${i.action}" for ${i.subject} (${i.detail})`,
    async run(input, ctx) {
      const subject = safeId(input.subject);
      if (!AP_ACTIONS.includes(input.action)) throw new Error(`action must be one of: ${AP_ACTIONS.join(', ')}`);
      const rules = checkRules(rulesOf(ctx), input.rules);
      let approval: { id: string; approved: boolean; by: string; reason?: string } | undefined;
      if (NEEDS_CONTROLLER.has(input.action)) {
        const mark = marker(subject, input.action);
        const fraud = input.action === 'refer as suspected fraud';
        const gate = controllerGate(ctx, mark, `Credit desk ${mark}: ${fraud ? `fraud referral. Hold ${subject} and treat it as suspected vendor fraud` : `the bank change for ${subject} was confirmed by a call to the number on record; allow payments to the new account`}? The AP clerk says: ${String(input.detail).slice(0, 400)} Rules: ${rules.join(', ')}.`);
        if (gate.pending) return gate.pending;
        approval = gate.approval!;
        if (!approval.approved) return { status: 'denied', reason: approval.reason ?? null, then: 'The controller said no. Keep the bill on hold and record that, with the reason.' };
      }
      ctx.log(`AP: ${input.action} on ${subject} (${rules.join(', ')})`);
      return { status: 'recorded', action: { subject, action: input.action, detail: input.detail, decided_by: approval ? `controller (${approval.by})` : seatOf(ctx.task!), approval: approval ?? null, rules } };
    },
  },
];
