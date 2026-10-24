// Put the task on chain: every payment's Memo instruction reads `gurtos task=<id> n=<8 hex>`, so anyone can
// match a transaction on the explorer to the task that paid it. Works for the exact and upto Solana schemes,
// which both take the memo text from `requirements.extra.memo`.
import { randomBytes } from 'node:crypto';
import type { PaymentRequirements, SchemeNetworkClient } from '@x402/core/types';

const MAX_MEMO_BYTES = 256; // the x402 SVM limit

/** The memo for one payment. The random part keeps two payments by one task from sharing a memo. */
export const taskMemo = (taskId: string) => `gurtos task=${taskId.slice(0, 100)} n=${randomBytes(4).toString('hex')}`;

/**
 * Wrap an x402 client scheme so its payment carries the task memo. The scheme gets a copy of the requirements
 * with `extra.memo` set; the x402 client still sends the seller's original requirements as `accepted`.
 * If the seller set its own memo, the facilitator requires that exact memo (checked in @x402/svm), so we leave
 * it alone: that payment has the seller's memo and no task memo, and still succeeds.
 */
export function withTaskMemo<S extends SchemeNetworkClient>(scheme: S, taskId: string): S {
  return {
    ...scheme,
    scheme: scheme.scheme,
    findDefaultAsset: (scheme as any).findDefaultAsset,
    createPaymentPayload: (version: number, req: PaymentRequirements) => {
      if (req.extra?.memo) return scheme.createPaymentPayload(version, req);
      const memo = taskMemo(taskId);
      if (new TextEncoder().encode(memo).length > MAX_MEMO_BYTES) throw new Error('task memo is too long');
      return scheme.createPaymentPayload(version, { ...req, extra: { ...req.extra, memo } });
    },
  };
}
