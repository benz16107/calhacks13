# A one-week pilot of GurtOS Business

This plan takes one company desk from "installed" to "an agent decides on its own" in a week, without handing
the agent anything before it has earned it. It uses shadow mode: for the week, every decision the agent seat
would make goes to a person first, and the box counts how often the person decides the same. The example is
Fogline Supply's collections clerk (the credit desk app); any seat and any app whose tools declare `decides`
works the same way. The API details are in [core/README.md](../core/README.md), "Business edition".

## Day 0: install and turn Business on

1. Install GurtOS Server on the box (see the README's Install section) and add one model key.
2. Turn on the app the desk uses (Credit desk) in the App Center, with the keys it lists.
3. Turn Business on from the box's screen, as the owner: `PUT /api/business {"on": true, "company": "Fogline Supply"}`.
   `BOX_EDITION=business` does the same on a new box.

## Day 0: people and roles

Add each person with a role in Settings > People, or `POST /api/people`, and pair each person's phone. For Fogline:

| Person | Role | Approves |
|---|---|---|
| Rosa Delgado, Controller | approver, up to $50,000 | the Controller, the fraud reviewer |
| Priya Nair, IT admin | admin | IT. She also runs the pilot: people, rules, shadow mode, the kill switch |
| Sam Chen, Sales | requester | nothing. He asks the agents for work |
| Owen Clarke, Auditor | auditor | nothing. He reads the audit |

Name the agent seats with `PUT /api/business {"seats": [...]}`: Credit analyst, Collections clerk.

## Day 0: the policy

Write who approves what, one rule per line, and the bar each seat must clear to go live:

```
Fraud referrals go to the fraud reviewer for approval.
Requests over $50,000 can't be approved in GurtOS.
Requests over $10,000 go to the Controller for approval.
Everything else goes to any approver.
The Collections clerk goes live after 20 suggestions with 95% agreement.
```

Check a few requests with "Who would approve this?" in Settings > Rules before the week starts.

## Days 1 to 5: shadow for a week

Put the seat in shadow: the switch in Settings > People, or `PUT /api/business {"shadow": ["Collections clerk"]}`.

- The seat works as usual. Each time it would record a decision, the box asks instead: "Shadow: the Collections
  clerk would record "friendly reminder" for INV-24110 ($1,200 is 12 days past due). Do you decide the same?"
- The policy sends the question to the right person, the same as any request. They answer on their phone.
  Yes records the decision as theirs. No records a disagreement, and the agent moves on.
- Each day, the admin reads the seat's row in Settings > People ("Shadow · 18 of 20 agreed (90%)") and the
  disagreements listed under it, each with who decided otherwise (`GET /api/business`, `pilot`). A disagreement is either the agent's mistake (fix the seat's prompt or the rules file)
  or a judgement call the company wants a person to keep (write a rule that sends it to that person).

## Day 5: the go-live check

The seat is ready when the policy's bar is met: its row says "Ready to go live", and `GET /api/business` has
`ready: true` in the seat's `pilot` entry. Before taking it live, the admin also checks:

- Every disagreement has an answer: a fix, or a rule that keeps that kind of decision with a person.
- The rules still send what the agent may not do alone to a person ("Requests over $10,000 go to the Controller").
  Going live ends the suggestions, not the approvals.
- The audit (`GET /api/audit?seat=Collections%20clerk`) shows who decided each suggestion.

Then the admin turns shadow off for that seat. The box never does this by itself: widening what an agent does
alone is a person's decision, and the log records who made it.

## Rollback

One setting puts the seat back in shadow: the switch, or `PUT /api/business {"shadow": ["Collections clerk"]}`.
Its next decision is a suggestion again, and its earlier agreement record is kept. To stop every agent at once,
use the kill switch (Settings > Kill switch, or `POST /api/pause`). Either change is in the log with the name of
the person who made it.
