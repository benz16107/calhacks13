# GurtOS Business: checkpoint for Ben's approval

GurtOS Business is the same desktop and design system as GurtOS Server (`../system.md`), plus people, rules and
accountability for a company. These screens are for Ben's approval before any Business screen is coded. The Figma page
is "GurtOS Business" in the [design file](https://www.figma.com/design/oppzH621OOOMA31rgLbxbM).

The company is Fogline Supply, the made-up coffee and cafe supplies wholesaler from the credit desk track. Its two
agent seats are the Credit analyst and the Collections clerk. The request is the credit desk's own case APP-1042:
Bright Harbor Catering asks for a $40,000 credit line on Net 30. All of it is sandbox data from the CRS and Capital One
Nessie test accounts.

## People

| Person | Role | Can approve | Notes |
|---|---|---|---|
| Rosa Delgado | Controller | Up to $50,000 | The only one who clears fraud flags. From the credit desk profile |
| Sam Chen | Sales | Nothing | Asks for credit for customers |
| Priya Nair | IT admin | Nothing | Manages people, devices and rules, and holds the kill switch |
| Owen Clarke | Auditor | Nothing | Reads the audit log and exports it |
| Credit analyst | Agent seat | Up to $10,000 on its own | Above that it prepares and proposes |
| Collections clerk | Agent seat | Nothing | Can't change limits or terms |

The rules: requests over $10,000 go to the Controller; nobody approves their own request; an agent never approves an
agent.

## Screens

| PNG | Node | What it shows |
|---|---|---|
| `1a-people.png` | `111:119` | Settings, People: each person with their role, the phone they approve from and their approval limit, then the two agent seats and what each may do. Priya is signed in |
| `1b-add-a-person.png` | `111:642` | Add a person: name, email, role (Approver), "Approves up to $10,000", and a "Can clear fraud flags" switch. The new person can't approve until a phone is paired to them |
| `2-rules.png` | `112:508` | Settings, Rules. A tester at the top ("A credit line of $40,000 asked for by Sam Chen" goes to Rosa, and why). Then the rules as sentences with editable values: "Requests over $10,000 go to the Controller for approval." Each says who changed it last. Under "Always on", three locked rules nobody can turn off, admins included |
| `3-waiting-for-me-rosa-phone.png` | `119:1266` (phones `115:697`, `115:776`) | Rosa's phone. Waiting for me lists two credit lines over $10,000 and a fraud flag. Sam's $40,000 request shows the Credit analyst agent's checks as evidence, "Requested by Sam Chen · prepared by Credit analyst agent", and Deny and Approve $40,000 |
| `4-audit.png` | `116:936` | The Audit app, opened by Owen (read-only). Filtered to one customer, Bright Harbor Catering: asked by Sam at 14:05, prepared by the agent at 14:06, routed to Rosa at 14:07, approved by Rosa at 16:40, the limit set. Filters for dates, people, agents and kinds, Timeline and Table, Export CSV, and one entry's detail |
| `5a-kill-switch-box.png` | `116:1208` | Priya on the box screen: Control Center's Kill switch card, and the confirmation that says what stops (6 tasks), what stays open (3 requests) and who can resume |
| `5b-kill-switch-phone.png` | `119:1370` (phones `115:919`, `115:978`) | The same on Priya's phone: the Kill switch page, then the paused state with Resume all agents and the stopped tasks |
| `5c-all-agents-paused.png` | `116:1474` | The box while paused, signed in as Rosa: "All agents are paused", the requests she can still answer, the 6 paused tasks, and the notification "All agents paused by Priya Nair" |
| `6-server-vs-business.png` | `119:1513` | The same $40,000 request twice. In Server, the one owner gets it on their phone and approves. In Business, the rule sends it to Rosa: Sam's phone shows it waiting with no Approve button ("You can't approve this: you asked for it"), and Rosa's phone has Approve $40,000 |

## What Ben should check

- **Names.** The brief named Rosa, Sam, an IT admin and an auditor. Sam's surname (Chen), Priya Nair, Owen Clarke and
  Dana Whitfield (the person being added in 1b, with a `fogline.example` email) are invented here. The credit desk
  profile calls its sales reps M. Chen and J. Park, so "Sam Chen" fits it, but any name can change.
- **Who resumes.** Only an IT admin can resume after the kill switch. The Controller can still answer requests while
  agents are paused, because answering starts nothing.
- **The $50,000 ceiling.** Rosa's limit is $50,000, so the rules say requests above it can't be approved in GurtOS at
  all. The credit desk's APP-1046 ($45,000) stays under it.

## What the core doesn't have yet

Business needs APIs the core doesn't have: people and roles with approval limits, rules that route an approval to a
role, a check that the asker and the preparer can't approve, pause and resume for every agent at once, and an audit
log filter by customer with CSV export. Approvals already record who answered.
