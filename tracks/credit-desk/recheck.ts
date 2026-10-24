// The nightly re-check of existing customers, a Server routine. At 02:00 (when switched on) it starts the credit analyst
// on the `fogline-recheck` case: for each customer with a guarantor on file, one CRS pull for the purpose account-review
// (the pull rules in pulls.ts apply: a purpose, a limit per task, no pull without consent). The pull comes back with what
// changed since the limit was set, the analyst flags it, and any change to a limit goes to the controller (REV-6, SOD-2).
import type { Trigger } from '../../core/contract.ts';
import { schedule } from '../../core/triggers.ts';
import fs from 'node:fs';
import path from 'node:path';
import { HOME } from './desk.ts';
import { startRun } from './start.ts';

export const RECHECK_CASE = 'fogline-recheck';
const ON = path.join(HOME, 'credit-desk', 'recheck.on');

export const recheckOn = () => fs.existsSync(ON);
export function setRecheck(on: boolean) {
  fs.mkdirSync(path.dirname(ON), { recursive: true });
  if (on) fs.writeFileSync(ON, new Date().toISOString());
  else fs.rmSync(ON, { force: true });
}

/** What the analyst is told on a night run, on top of its usual prompt. */
export const EXTRA = `This is the nightly re-check, not a new-customer run. There are no applications. The customers are in case/customers.csv.
The desk holds a guarantor and the consent on file for some of them, and what it knew when each limit was set ("then"). You never see the
guarantor's details: the tool does. For each customer in customers.csv: call credit-desk.crs {customer_id, purpose: "account-review"} once. The answer lists what changed
since then ("changes_since_then"). If something changed, flag it with credit-desk.flag and record credit-desk.review: keep,
reduce or suspend, re-banded from the fresh data (REV-5). A limit change goes to the controller, as the tool says. A customer with no guarantor or consent on file comes back refused; say so and move on. Do not pull a customer twice.`;

export type Then = { transunion?: number; equifax?: number; experian?: number; fraud_score?: number; identity?: string; collections?: number; public_records?: number };

/** What changed between the desk's file and a fresh CRS summary, in plain sentences. Empty when nothing did. */
export function compare(then: Then | undefined, now: any): string[] {
  if (!then) return [];
  const out: string[] = [];
  for (const b of ['transunion', 'equifax', 'experian'] as const) {
    const was = then[b], is = now?.credit?.[b]?.score;
    if (typeof was === 'number' && typeof is === 'number' && was !== is) out.push(`${b} ${was} to ${is} (${is > was ? '+' : ''}${is - was})`);
  }
  const collections = Math.max(0, ...Object.values<any>(now?.credit ?? {}).map((r) => r?.derogatory?.collections ?? 0));
  if (typeof then.collections === 'number' && collections > then.collections) out.push(`collections ${then.collections} to ${collections}`);
  const fraud = now?.fraud?.risk_score;
  if (typeof then.fraud_score === 'number' && typeof fraud === 'number' && Math.abs(fraud - then.fraud_score) >= 10) out.push(`Fraud Finder score ${then.fraud_score} to ${fraud}`);
  if (then.identity === 'verified' && now?.identity?.verified === false) out.push(`identity no longer verifies (${(now.identity.problems ?? []).map((p: { code: string }) => p.code).join(', ')})`);
  const records = (now?.public_records?.liens?.length ?? 0) + (now?.public_records?.judgments?.length ?? 0) + (now?.public_records?.bankruptcies?.length ?? 0);
  if (typeof then.public_records === 'number' && records > then.public_records) out.push(`public records ${then.public_records} to ${records}`);
  return out;
}

const run = (box: Parameters<Trigger['start']>[0], scripted = false) => startRun(box, { case: RECHECK_CASE, seats: ['analyst'], scripted, extra: EXTRA });

export const nightly: Trigger = {
  name: 'nightly-recheck',
  start(box) {
    return schedule({
      name: 'nightly-recheck', dailyAt: '02:00',
      task: async () => {
        if (recheckOn()) await run(box); // off by default: a night run costs model credit
        return undefined;
      },
    }).start(box);
  },
};

export { run as startRecheck };
