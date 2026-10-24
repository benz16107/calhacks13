# GurtOS Business: checkpoint for Ben's approval

GurtOS Business is the same desktop and design system as GurtOS Server (`../system.md`), plus people, rules and
accountability for a company. These screens are for Ben's approval before any Business screen is coded. The Figma page
is "GurtOS Business" in the [design file](https://www.figma.com/design/oppzH621OOOMA31rgLbxbM).

The company is Fogline Supply, the made-up coffee and cafe supplies wholesaler from the credit desk track. Its two
agent seats are the Credit analyst and the Collections clerk. The request is the credit desk's own case APP-1042:
Bright Harbor Catering asks for a $40,000 credit line on Net 30. All of it is sandbox data from the CRS and Capital One
Nessie test accounts.

## People

These are the people Ben approved at the checkpoint, and the people, seats and policy the Business core uses
(branch `business`), so the frames show real fields and the box's own sentences.

| Person | Role | Title | Limit | Approves for |
|---|---|---|---|---|
| Rosa Delgado | approver | Controller | $50,000 | Controller, Fraud reviewer |
| Sam Chen | requester | Sales | | |
| Priya Nair | admin | IT admin | | IT |
| Owen Clarke | auditor | Auditor | | |

The agent seats are the Credit analyst and the Collections clerk. Seats do the work and ask; only a person on a paired
phone answers a request. "Clears fraud flags" on People means Rosa approves for the fraud reviewer. The policy is
plain text, one rule per line. The first rule that matches decides, and a "can't be approved" line applies wherever
it sits:

```
Fraud referrals go to the fraud reviewer for approval.
Requests over $50,000 can't be approved in GurtOS.
Requests over $10,000 go to the Controller for approval.
Production changes go to IT for approval.
Everything else goes to any approver.
```

## Screens

| PNG | Node | What it shows |
|---|---|---|
| `1a-people.png` | `111:119` | Settings, People: each person with role, title, paired phone, limit and what they approve for, then the two agent seats ("Asks, never approves"). Priya is signed in |
| `1b-add-a-person.png` | `111:642` | Add a person: name, title, role, limit and approves for. After Add, GurtOS shows a QR code to pair their phone; until one is paired, they can't approve |
| `2-rules.png` | `112:508` | Settings, Rules: the five policy lines with their values highlighted to change, and a tester that shows the route sentence for a request ("Requests over $10,000 go to the Controller for approval. Rosa Delgado can approve it."). Under "Always on", the three rules nobody can turn off |
| `3-waiting-for-me-rosa-phone.png` | `119:1266` (phones `115:697`, `115:776`) | Rosa's phone. Waiting for me holds the $40,000 credit line, the $2,400 write-off and the fraud referral. The $40,000 request shows the Credit analyst agent's checks as evidence, "Requested by Sam Chen · prepared by Credit analyst agent", its route sentence, and Deny and Approve $40,000 |
| `4-audit.png` | `116:936` | The Audit app, opened by Owen (auditor). The search "Bright Harbor Catering" shows one customer's timeline: asked by Sam, prepared by the Credit analyst, routed to Rosa, approved by Rosa, the limit set. Filters for dates, person, seat and app, Timeline and Table, Export CSV, and one entry with the audit columns (by, event, at, asked, seat, app, approver) |
| `5a-kill-switch-box.png` | `116:1208` | Priya on the box screen: Control Center's Kill switch card, and the confirmation that says what stops, what waits in the queue, what stays open and who can resume |
| `5b-kill-switch-phone.png` | `119:1370` (phones `115:919`, `115:978`) | The same on Priya's phone: the Kill switch page, then "Paused by Priya Nair at 10:41" with Resume all agents and the stopped tasks |
| `5c-all-agents-paused.png` | `116:1474` | The box while paused, signed in as Rosa: the 6 paused tasks, the 3 requests she can still answer, and the notification "All agents paused by Priya Nair" |
| `6-server-vs-business.png` | `119:1513` | The same $40,000 request twice. In Server, the one owner gets it on their phone and approves. In Business, the policy sends it to Rosa: Sam's phone shows it waiting with "You asked for this, so someone else has to answer it.", and Rosa's phone has Approve $40,000 |

## Notes

- **Grace Ito**, the person being added in 1b (assistant controller, $10,000, approves for Controller), is invented.
- Real screens from the Business core will be in `portal/screenshots/business/` once that branch is merged.

## What the core has

The Business core on branch `business` has people and roles with limits, pairing a phone to a person (a QR code
right after Add), the policy and its route sentences, the refusals, the audit with free-text search, filters and CSV
export, and the kill switch.
