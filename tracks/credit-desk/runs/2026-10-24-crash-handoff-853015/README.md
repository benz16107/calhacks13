# A half-done handoff survives a power cut

Run `853015`, the October case with scripted seats, on a throwaway box on the test VM, 2026-10-24.

1. The analyst prepared the fraud referral for APP-1043 and the AP clerk referred B-3315 (the lookalike bank change)
   to the controller. Both requests were routed to Rosa and unanswered; both seats were `waiting`.
   (`../../screenshots/handoff-1-before-the-plug.png`)
2. The plug: the box's whole process group and every task user's processes were killed at once and the task mounts
   dropped, with no clean shutdown. 67 events were in the log.
3. The box booted at 10:15:05 UTC with `cleanStart: false` and resumed both waiting seats. The same two requests
   were still pending in the window. (`handoff-2-after-the-reboot.png`)
4. Rosa approved both in the window. The analyst went on to Bright Harbor's $40,000, which she also approved, and
   all three seats finished. (`handoff-3-finished.png`)

Checked from the log (`log.jsonl`, the box's own action log for this run):

| Check | Result |
|---|---|
| Each request asked once | 3 requests, each asked once (the same key after the reboot returned the same request) |
| Each request answered once | 3 answers, one each |
| Each credit decision recorded once | APP-1043 fraud hold once, APP-1042 approval once |
| Each bill paid once | B-3304 once in the log, and once at the bank: one Nessie withdrawal tagged with this run |
| A tool call repeated after the reboot | none: no (task, key) pair appears twice |
| Keys in the log | none of CRS_USERNAME, CRS_PASSWORD, NESSIE_API_KEY, FACTORY_API_KEY |

Why it holds: the log is fsynced per line and the core rebuilds every task and request from it at boot; a seat's
finished steps are skipped on resume; an answered tool key returns its logged result instead of running again; a
request asked again with the same key returns the same request; and `pay_bill` checks the bank for this run's
payment of that bill before paying, because Nessie takes no idempotency key.
