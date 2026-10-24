# GurtOS Business: checkpoint for Ben's approval

GurtOS Business is the same desktop and design system as GurtOS Server (`../system.md`), plus people, rules and
accountability for a company. These screens are for Ben's approval before any Business screen is coded. The Figma page
is "GurtOS Business" in the [design file](https://www.figma.com/design/oppzH621OOOMA31rgLbxbM).

The company is Fogline Supply, the made-up coffee and cafe supplies wholesaler from the credit desk track. Its two
agent seats are the Credit analyst and the Collections clerk. The request is the credit desk's own case APP-1042:
Bright Harbor Catering asks for a $40,000 credit line on Net 30. All of it is sandbox data from the CRS and Capital One
Nessie test accounts.

## People

These are the people, seats and policy the Business core uses in its demo (branch `business`), so the frames show
real fields and the box's own sentences.

| Person | Role | Title | Limit | Approves for |
|---|---|---|---|---|
| Rosa Delgado | approver | Controller | $50,000 | Controller |
| Sam Ortiz | requester | Sales | | |
| Dana Brooks | admin | IT admin | | IT |
| Lee Morgan | auditor | Auditor | | |

The agent seats are the Credit analyst and the Collections clerk. Seats do the work and ask; only a person on a paired
phone answers a request. The policy is plain text, one rule per line, and the first rule that matches decides:

```
Fraud referrals go to the Controller.
Over $10,000 goes to the Controller.
Production changes go to IT.
Everything else goes to any approver.
```

## Screens

| PNG | Node | What it shows |
|---|---|---|
| `1a-people.png` | `111:119` | Settings, People: each person with role, title, paired phone, limit and what they approve for, then the two agent seats ("Asks, never approves"). Dana is signed in |
| `1b-add-a-person.png` | `111:642` | Add a person: name, title, role, limit and approves for. The next step is a one-time pairing code for their phone; until one is paired, they can't approve |
| `2-rules.png` | `112:508` | Settings, Rules: the four policy lines with their values highlighted to change, and a tester that shows the route sentence for a request ("Over $10,000 goes to the Controller. Rosa Delgado can approve it."). Under "Always on", the three rules nobody can turn off |
| `3-waiting-for-me-rosa-phone.png` | `119:1266` (phones `115:697`, `115:776`) | Rosa's phone. Waiting for me holds the $40,000 credit line, the $2,400 write-off and the fraud referral. The $40,000 request shows the Credit analyst agent's checks as evidence, "Requested by Sam Ortiz · prepared by Credit analyst agent", its route sentence, and Deny and Approve $40,000 |
| `4-audit.png` | `116:936` | The Audit app, opened by Lee (auditor). The timeline for one customer: asked by Sam, prepared by the Credit analyst, routed to Rosa, approved by Rosa, the limit set. Filters for dates, person, seat and app, Timeline and Table, Export CSV, and one entry with the audit columns (by, event, at, asked, seat, app, approver) |
| `5a-kill-switch-box.png` | `116:1208` | Dana on the box screen: Control Center's Kill switch card, and the confirmation that says what stops, what waits in the queue, what stays open and who can resume |
| `5b-kill-switch-phone.png` | `119:1370` (phones `115:919`, `115:978`) | The same on Dana's phone: the Kill switch page, then "Paused by Dana Brooks at 10:41" with Resume all agents and the stopped tasks |
| `5c-all-agents-paused.png` | `116:1474` | The box while paused, signed in as Rosa: the 6 paused tasks, the 3 requests she can still answer, and the notification "All agents paused by Dana Brooks" |
| `6-server-vs-business.png` | `119:1513` | The same $40,000 request twice. In Server, the one owner gets it on their phone and approves. In Business, the policy sends it to Rosa: Sam's phone shows it waiting with "You asked for this, so someone else has to answer it.", and Rosa's phone has Approve $40,000 |

## What Ben should check

- **The customer name.** The frames call APP-1042 Bright Harbor Catering, as the credit desk track does. The Business
  demo on branch `business` calls it Harbor Lane Bakery; one of the two should change.
- **Grace Ito.** The person being added in 1b (assistant controller, $10,000, approves for Controller) is invented.
- **Filtering to one customer.** The audit filters by person, seat, app and dates. The brief asked for one customer's
  timeline, so the frame keeps a customer filter the box doesn't have yet.
- **The $50,000 limit.** Above Rosa's limit, nobody can approve: the route sentence says "Nobody can approve it yet:
  it is $75,000, above Rosa Delgado's $50,000 limit."

## What the core has, and what it doesn't

The Business core on branch `business` (not merged yet) has people and roles with limits, pairing a phone to a person,
the policy and its route sentences, the refusals, the audit with its filters and CSV export, and the kill switch. It
has no customer filter for the audit.
