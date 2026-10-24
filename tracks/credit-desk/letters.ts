// The letter an applicant or customer gets after a decision (rules DCL-1 and FRR-3). It is modelled on adverse-action
// notices (ECOA / Regulation B 12 CFR 1002.9, and FCRA section 615(a) when a guarantor's credit report played a part).
// It is a model letter for a sandbox company, not a notice reviewed for legal compliance.

/** Plain-words reasons for rule ids. A fraud stop is never named: the letter only says we could not verify. */
const REASONS: [RegExp, string][] = [
  [/^(BND-[A-D1-9]|BIZ-1)$/, "The owner's credit history: the lowest credit score among the credit bureaus, or a negative item on a credit report."],
  [/^(PUB-[1-3])$/, 'Public records: an open lien or an unpaid judgment.'],
  [/^(LIM-[1-4])$/, 'The amount requested is more than we can extend on the revenue we were able to verify.'],
  [/^(NEW-[12])$/, 'Time in business.'],
  [/^(REV-6|COL-8)$/, 'Payments to us were returned unpaid.'],
  [/^(DOC-[12])$/, 'We could not use some of the documents provided; we rely on reports we obtain ourselves.'],
];
const FRAUD = /^(FRD-|FRR-)/;
const CREDIT_REPORT_RULES = /^(BND-|BIZ-1|PUB-|CHK-1)/;

export interface LetterInput {
  to: string;
  date: string;
  kind: 'decision' | 'review';
  outcome: string;
  limit: number;
  terms: string;
  asked?: { limit: number | null; terms: string | null };
  rules: string[];
  usedCreditReport: boolean;
}

const usd = (n: number) => `$${n.toLocaleString('en-US')}`;

/** Returns null when nothing adverse happened (approved as asked, or a review that kept the terms). */
export function letter(x: LetterInput): string | null {
  const fraud = x.outcome === 'fraud hold' || x.rules.some((r) => FRAUD.test(r));
  const reduced = x.outcome === 'approve' && x.asked && ((x.asked.limit ?? 0) > x.limit || (x.asked.terms && x.asked.terms !== x.terms));
  const adverse = fraud || reduced || ['decline', 'cash in advance', 'reduce', 'suspend'].includes(x.outcome);
  if (!adverse) return null;
  const head = [`${x.date}`, '', `${x.to}`, '', `Re: your ${x.kind === 'review' ? 'trade credit account' : 'application for trade credit'} with Fogline Supply Co.`, ''];
  const foot = ['', 'Fogline Supply Co., credit department, 2240 Livingston St, Oakland, CA 94606', '(A model letter from a sandbox company. Not reviewed for legal compliance.)'];
  if (fraud) {
    // FRR-3: never name the check, the rule, the data source, which detail failed, or the word fraud.
    return [...head,
      'Thank you for your application.',
      'We need to verify some information before we can offer terms. Until then we can only accept orders paid in advance.',
      'If you would like to continue, please reply to this letter and we will tell you what we need.',
      ...foot].join('\n');
  }
  const reasons = [...new Set(x.rules.flatMap((r) => REASONS.filter(([re]) => re.test(r)).map(([, t]) => t)))];
  const what = x.outcome === 'approve'
    ? `We can offer you credit of ${usd(x.limit)} on ${x.terms}${x.asked?.limit ? `, rather than the ${usd(x.asked.limit)}${x.asked.terms ? ` on ${x.asked.terms}` : ''} you asked for` : ''}.`
    : x.outcome === 'reduce' ? `We have changed your credit to ${usd(x.limit)} on ${x.terms}. Invoices already issued keep their terms.`
    : x.outcome === 'suspend' ? 'We have suspended your credit. Orders can be paid in advance.'
    : x.outcome === 'cash in advance' ? 'We are not able to offer credit terms at this time. We are glad to take orders paid in advance.'
    : 'We are not able to offer you trade credit at this time.';
  const lines = [...head, what, '', 'The main reasons:', ...(reasons.length ? reasons.map((r) => `- ${r}`) : ['- Our credit policy for this amount.']), ''];
  if (x.usedCreditReport || x.rules.some((r) => CREDIT_REPORT_RULES.test(r))) {
    lines.push(
      'Our decision was based in part on information in a consumer credit report on the business owner, obtained through',
      'CRS Credit API from TransUnion, Equifax and Experian. They did not make this decision and cannot explain why it was made.',
      'The owner may get a free copy of the report from them within 60 days of this letter, and may dispute anything in it',
      'that is inaccurate or incomplete.',
      '',
    );
  }
  lines.push(
    'The federal Equal Credit Opportunity Act prohibits creditors from discriminating against credit applicants on the basis',
    'of race, color, religion, national origin, sex, marital status or age (provided the applicant has the capacity to contract),',
    'because all or part of the applicant\'s income derives from any public assistance program, or because the applicant has',
    'in good faith exercised any right under the Consumer Credit Protection Act.',
  );
  return [...lines, ...foot].join('\n');
}
