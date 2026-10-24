// Jira Service Management approvals. A risky box approval becomes a JSM request whose approvers decide it;
// the track waits for that decision and answers the box approval from it. Request types of the "Service request
// with approvals" kind start an approval by themselves. Their Approvers field decides who may answer.
type Jira = (method: string, p: string, body?: unknown) => Promise<any>;

export type JsmConfig = {
  serviceDesk: string;
  requestType: string;
  /** Spending above this many cents is risky. Without it, cost alone never makes an approval risky. */
  minCents?: number;
  /** Lowercase words in the question that make it risky. */
  match?: string[];
  /** Account ids of the approvers. Without it, the account the track signs in as. */
  approvers?: string[];
};

const MATCH = ['production', 'prod ', 'outside'];

export function isRisky(cfg: JsmConfig, a: { question: string; costCents: number }): boolean {
  const q = a.question.toLowerCase();
  return (cfg.minCents !== undefined && a.costCents > cfg.minCents) || (cfg.match ?? MATCH).some((w) => q.includes(w));
}

const label = (id: string) => `gurtos-approval-${id.replace(/[^\w-]/g, '-')}`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;


/** Open (or find, idempotent per approval id) a JSM request for a box approval. */
export async function openRequest(
  jira: Jira,
  cfg: JsmConfig,
  a: { approvalId: string; task: string; title: string; question: string; costCents: number; issue?: string },
): Promise<{ key: string }> {
  const tag = label(a.approvalId);
  const found = await jira('POST', '/rest/api/3/search/jql', { jql: `labels = "${tag}"`, fields: ['key'], maxResults: 1 });
  if (found?.issues?.[0]) return { key: found.issues[0].key };

  const description = [
    `The agent on task "${a.title}" (${a.task}) wants to: ${a.question}`,
    // The box prices everything in test money until a real payment rail is wired in.
    `Cost: ${money(a.costCents)} (test money).`,
    ...(a.issue ? [`Task issue: ${a.issue}`] : []),
    'Decide here. The agent waits.',
  ];
  const req = await jira('POST', '/rest/servicedeskapi/request', {
    serviceDeskId: cfg.serviceDesk,
    requestTypeId: cfg.requestType,
    requestFieldValues: { summary: `Approval needed: ${a.question}`.replace(/\s+/g, ' ').slice(0, 200), description: description.join('\n') },
  });
  const key: string = req.issueKey;
  await jira('PUT', `/rest/api/3/issue/${key}`, { fields: { labels: ['gurtos', tag] } });

  // An automation on the site fills Approvers a moment after create and would overwrite ours. So wait until it
  // has, set ours, and check again a few seconds later.
  const want = cfg.approvers ?? [(await jira('GET', '/rest/api/3/myself')).accountId];
  const set = async () => (await jira('GET', `/rest/api/3/issue/${key}?fields=customfield_10003`)).fields.customfield_10003 ?? [];
  const ours = (cur: { accountId: string }[]) => cur.length === want.length && want.every((w) => cur.some((c) => c.accountId === w));
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 10 && !(await set()).length; j++) await sleep(1000);
    if (!ours(await set())) await jira('PUT', `/rest/api/3/issue/${key}`, { fields: { customfield_10003: want.map((accountId) => ({ accountId })) } });
    await sleep(3000);
    if (ours(await set())) break;
  }
  return { key };
}

/** The JSM decision: pending until an approver decides. `by` is the approver who decided. */
export async function decision(jira: Jira, key: string): Promise<{ state: 'pending' | 'approved' | 'declined'; by?: { accountId: string; name: string } }> {
  const { values } = await jira('GET', `/rest/servicedeskapi/request/${key}/approval`);
  // A request with no approval yet, or a pending one, keeps the agent waiting. Any decline wins over approvals.
  const done = (values as any[]).filter((v) => v.finalDecision === 'approved' || v.finalDecision === 'declined');
  const pick = done.find((v) => v.finalDecision === 'declined') ?? (done.length === values.length ? done[0] : undefined);
  if (!pick) return { state: 'pending' };
  const state = pick.finalDecision as 'approved' | 'declined';
  const who = (pick.approvers as any[]).find((x) => x.approverDecision === state);
  return { state, by: who ? { accountId: who.approver.accountId, name: who.approver.displayName } : undefined };
}

/** Add a comment and close it when the box approval was answered elsewhere (portal, phone, panel). */
export async function settle(jira: Jira, key: string, text: string): Promise<void> {
  await jira('POST', `/rest/servicedeskapi/request/${key}/comment`, { body: text, public: true });
  const { transitions } = await jira('GET', `/rest/api/3/issue/${key}/transitions`);
  const t = transitions.find((x: any) => x.to.statusCategory?.key === 'done');
  if (t) await jira('POST', `/rest/api/3/issue/${key}/transitions`, { transition: { id: t.id } });
}
