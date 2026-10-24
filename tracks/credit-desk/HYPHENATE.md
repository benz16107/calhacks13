# Hyphenate: what they look for

Notes from Hyphenate's pre-event workshop on Oct 21 (Rajaswa Patil, founding engineer, with Pavan Kumar Surpaneni)
and its 21 slides. Times are positions in the Fathom recording. Fathom's transcript has no timestamps inside the
talk from 2:30 to 32:47, so times in that stretch come from the slide on screen and are rough, to about 30 seconds.

## What Hyphenate cares about

**How they judge**

1. **Four criteria** (slide 5, "What you win, and how to win it", about 10:30): "Is it real enough?", "Would you
   hire it?", "Did we see something new?", "Did it have a 'wow' moment?". The wow can be in the UI, the UX, or "some
   complex financial function that it's able to automate". "Even one or two wow moments" go a long way.
2. **"Would you hire it?" decides it** (Q&A, about 37:40). "This is really, like, make or break." The test, from
   about 11:30: as the CFO, would you hand the whole function to it "and not worry about how the work is
   happening", instead of a staff accountant or a contractor. Accountability, traceability, self-learning and
   self-improvement are "all of that really is to power this one question". He asked teams to explain why their
   system is a good hire.
3. **Precision over recall** (Q&A, about 53:10, answering why an agent might not be trusted). What it puts out
   must be right: "your precision of automation should be super high ... your recall can be slightly low". Work it
   is unsure of goes to a person: "I'm not going to process this particular piece of work because I'm lacking
   context". "You wouldn't hire a developer who's going to ship bugs with every PR."
4. **Strong and weak entries** (slide 19, "Strong vs. weak submissions", about 30:00 to 32:00). He said they will
   take this slide "super seriously while evaluating".
   - Strong: "A real company with a messy corner, and an answer key". "A few roles done deep, named in one line".
     "Asks at the right moment, and handles a no". "Limits enforced in code; a record of every call". "A moment on
     stage, and a score to back it".
   - Weak: "A chatbot over a spreadsheet, or a one-shot extractor". "Ten workflows, none of them deep". "Clean
     happy-path data that only works on the script". "An admin key, and 'the prompt tells it not to'". "Memory that
     ends with the context window; 'trust me'".
5. **What he added out loud on that slide.** A strong entry "will escalate to the humans at the right moment. It
   will ask for the context. It will escalate any issues. And it will handle a rejection as well." Weak is "if you
   just show all the happy parts ... all the examples are super simple". "You have to have certain adversarial
   examples to test the agent's limits and access." Back the wow moment "with good technical explanation".
6. **Depth over breadth** (slide 6, "What a finance team actually does", about 12:30, and the talk at about 31:00).
   "Pick a corner of one: one corner done deep beats ten done shallow." "Pick as few roles as you can, but go
   really deep ... Depth really matters." He warned against "an agent for every employee" systems that are not deep.

**What a system of work is**

7. **"The most important slide"** (slide 9, "Records hold the truth. A system of work holds the work.", about
   18:00 to 20:00). Systems of record (bank, ERP and ledger, contracts, CRM, inbox) "disagree with each other. You
   integrate with them; you don't replace them." The system of work holds "work items · decisions and reasons ·
   questions and approvals · learned policies · the log". Between the two sits a gateway: "One door. Every write
   checked." "This weekend, you're supposed to be building a system of work."
8. **One event touches many systems** (slide 7, "One refund touches five systems.", about 14:00). A refund moves
   billing, the bank, the ledger, the CRM and the forecast. "Every number has to agree with every other one, and
   nothing moves without the right sign-off."
9. **Four questions on day one** (slide 8, "Harnesses made agents capable.", about 15:30 to 17:30). World: "Where
   does it act?" Time: "What does it remember next quarter?" Team: "Who does it work with?" Limits: "What may it
   do, and can it prove why?" On time he meant "proper long-term episodic memory", not chat history.
10. **Why outcomes need proof** (slide 10, "SaaS pricing sells access. Outcome-based pricing sells work.", about
    20:30): "Billing per outcome means proving every outcome. That takes a system of work."
11. **Learns, improves, proves** (slide 11, "A good system of work learns, improves and proves.", about 21:30 to
    23:30). One running example: Acme pays INV-1042 $25 short, a $57,975 wire against $58,000.
    - Self-learning (slide 12, "Learn the job from the company's history.", about 24:00). The agent queries a year
      of payments against bank lines, finds that wires up to $50 short were booked to Bank Fees (214 precedents),
      and proposes a policy that a controller must approve. Slide 3 states the product claim: "You don't teach it.
      You don't write rules. It learns your business from the records you already produce."
    - Self-improving (slide 13, "Every correction becomes precedent.", about 25:30). A person corrects a match. The
      agent finds similar corrections, makes the rule general, and proposes it with the precedent ids, for
      approval. Talk: "it has to spot the pattern, it has to verify a back test, and then update its policies".
    - Audit trail (slide 14, "Months later, 'why?' is one query.", about 26:30). Every step is an event: the bank
      line, the invoice, the policy and its version, who approved, what changed. One query on the log by subject
      returns time, actor, change and why. "append-only · written with the change".
12. **How to build it** (slides 15 to 18, about 27:30 to 30:00).
    - Environment (slide 15, "Sync the systems of record into one shape."): sync with a cursor per source and
      stable ids, so a re-sync never duplicates. "Every golden row traces to its raw row."
    - People and agents (slide 16, "Map who may do what, to which record."): a table of role, resource and allowed
      action, checked on every call, with a check-and-cross table of attempts. "No role can 'post': only the
      gateway does." An actor cannot approve what it proposed. Talk: "the AI agent cannot approve something on its
      own ... cannot record something to the ledger on its own".
    - Tools (slide 17, "The agent's tools are CRUD on the work."): a state machine, NEW, PROPOSED, NEEDS_INFO
      (ask and answer), APPROVED, POSTED. "The harness sees tools, not tables or keys." Delete is "never: a
      reversal is a new transition".
    - Log (slide 18, "Log every transition as a diff."): each entry has actor, action, allowed or not, reason, the
      diff, and evidence as source row ids. "Append-only: fixes are new events. Same commit as the change itself.
      Denied attempts are logged too." The example entry carries the approver's reason, "intermediary fee".
13. **Fixing a closed period** (Q&A, about 48:00): "A reversal and a repost ... You're not allowed to delete
    records", and link the fix "back to the initial wrong event so that the auditor and the regulator is aware".
14. **Why the trail matters** (Q&A, about 48:30 to 50:40). Auditors pull any past event and ask about it, on a
    deadline. Judgment calls such as accruals are "very subjective", so "you have to be able to defend your
    number ... Can you defend your assumptions well?"
15. **Data** (Q&A, about 40:06 and 42:27). They "always prefer" simulated data "custom tailored to the point that
    you're trying to make". Their examples of messy data: a customer starts paying several invoices with one
    payment, which turns matching into one-to-many; invoices from several countries with FX and different layouts;
    a contract that is changed or cancelled after revenue was booked.
16. **Scope** (Q&A, about 41:00 and 46:14). Corporate finance only; personal finance does not count. Any industry.
    Their customers include Groupon and an ice cream maker whose drivers collect cash.
17. **The product pitch** (platform video, about 5:30 to 7:30). Agents "escalate judgment calls when necessary";
    "every judgment call your team makes only sharpens it"; "audit ready by default". One of its flows: "Payments
    match as they land, even one deposit spread across a dozen invoices."

The talk says nothing about the video format. That comes from the written brief only.

## What this means for the credit desk

- **Would you hire it.** Have: run `73c47b` caught 14 of 14 with no false alarms and decided all 6 applications as
  the key does, in 13 minutes for about $4.67. Do: state the hire case in one paragraph in the video and the
  README. Say what the desk replaces (a credit analyst and a clerk at a 12-customer wholesaler), what a run costs,
  and what it will not do alone. Put the simple rule's $153,000 beside the desk's $8,000 approved, $83,500 sent to
  the controller and $20,000 stopped.
- **Precision over recall.** Gap: in `73c47b` the analyst called INV-24111 "359 days late", which is wrong, and the
  scorer does not check whether a finding's conclusion is right (Known limits in `README.md`). By their measure a
  wrong statement costs more than a miss. Do: tell the seats to send items they are unsure of to the controller,
  or mark them unresolved, instead of stating them. Report wrong outputs as their own number, next to caught out
  of planted.
- **Handles a no.** Gap: every live run had a script answer yes. On a no the tool records "sent back by the
  controller" with limit 0, and the seat prompts say nothing about what to do next. Do: in the demo and the video,
  deny one proposal (APP-1045's $15,000, say) and show the analyst come back inside its authority, or decline with
  a DCL-1 notice.
- **Asks for context, not only a yes.** Gap: `box_ask` gets approve or deny. `Approval` in `core/contract.ts` has
  no reason and no free-text answer, so the controller cannot say why, and the desk cannot ask "is this deposit
  for INV-24098?". Ask the core thread for an optional reason on an answer.
- **Limits in code, and refused attempts in the log.** Have: tools per seat, CHK-1, rule ids checked against the
  file, the controller gate inside the tool, keys only in the vault and none in the log. That answers "an admin
  key" and "the prompt tells it not to". Gap: `callTool` in `core/box.ts` throws "this task may not use ..."
  before it writes to the log, so a seat reaching for another seat's tool leaves no trace. Slide 18 says denied
  attempts are logged too. Ask the core thread. Do: show a seat, tool and allowed table like slide 16, with the
  demo's refused attempts in it.
- **"Why?" is one query.** Have: every call and result is in the log, and each decision carries rule ids, figures,
  CRS request ids and who approved. Gap: there is no lookup by subject. Do: add a route such as
  `GET /t/credit-desk/why?subject=APP-1043` that returns, in time order and across runs, the CRS calls with request
  ids, the flags, the proposal, the question, the controller's answer and who gave it, and the decision. Use it as
  the "an auditor asks in February" beat.
- **Reversal, not edit.** Have: case files never change, and corrections are log entries. Gap: "correct record" is
  free text, not a reversal and repost tied to the wrong row. Do: give it the original row id and the new values,
  for PMT-8812 (off INV-24089, onto INV-24098) and INV-24117 (a credit memo against the duplicate).
- **Memory past one run.** Gap: each run starts fresh, and the rules file is the only memory. Their weak list names
  "Memory that ends with the context window". Smallest fix: feed the controller's past answers on the same
  subjects from the log into the next run as precedents, and show a second run citing the first.
- **Learning and improving.** Gap: the rules were written by hand and reviewed with Mana. The desk does not learn
  them from Fogline's history or from corrections, which is Hyphenate's core claim. If time allows, add one learned
  policy: a seat finds a pattern in past records, proposes a rule with its precedent count, and the controller
  approves it into a new rules version. Describe the Mana review as a person-guided rule review, not as learning.
- **Depth over breadth.** The AP clerk (E15 and E16 are already in the answer key on this branch) is a third seat.
  The slides favour one corner done deep. E16, the bank change from an email on a lookalike domain, is worth
  having: it is adversarial, it matches "bank changes" on their Payables tile, and it tests GEN-3. Add the AP seat
  only with the same depth (tools enforced, controller gate, scored). If time is short, a no, the why query and
  precision matter more.
- **Their messy-data example.** Gap: no payment in the case covers more than one invoice. Their running example is
  one deposit split across several invoices by its memo. One such deposit in Nessie would match it directly.
- **A real company, an answer key, a score.** Have: Fogline, 16 planted errors, 9 items that look wrong but are fine,
  and `POST /t/credit-desk/score`. This is their slide 19 wording almost word for word. Keep the score on screen.
- **Their own scenario at the table.** Have: any case folder that passes `check-case.ts`. Limit: the guarantor must
  be one of CRS's 20 test people, so a judge's own applicant gets no CRS answer. Say so first and have the persona
  list ready.
- **The moment.** Have: APP-1043, which the simple rule approves for $20,000. Open on it, then show the score and
  the why trail behind it, since they asked for a wow backed "with good technical explanation".
- **The gateway.** Partial: the tools in the core are the only door, and Nessie is read only. The desk records
  decisions and actions in the log but posts nothing to a system of record. Say that plainly.
- **Corporate finance, simulated data built for the point.** Have.

## Sources

- Recording: "CalHacks x Hyphenate Pre-event Workshop", Oct 21, 56:47,
  https://fathom.video/share/UQKfEaP_BUs_ACNWzcPNP_XhmV843z-Y. The transcript came from the share page's
  copy-transcript link. Slide times came from frames of the video.
- Slides: "Beyond Agentic Harnesses · Hyphenate CalHacks Workshop.pdf", 21 pages, posted by Pavan Kumar Surpaneni in
  #cohost-hyphenate on Oct 21. Slide titles: "Introducing Hyphenate." (1), "The next 60 minutes" (2), "Introducing
  Hyphenate: The Autonomous Finance Platform" (3), "The Hyphenated Enterprise: autonomous systems for finance." (4),
  "What you win, and how to win it." (5), "What a finance team actually does." (6), "One refund touches five
  systems." (7), "Harnesses made agents capable." (8), "Records hold the truth. A system of work holds the work."
  (9), "SaaS pricing sells access. Outcome-based pricing sells work." (10), "A good system of work learns, improves
  and proves." (11), "Learn the job from the company's history." (12), "Every correction becomes precedent." (13),
  "Months later, 'why?' is one query." (14), "Sync the systems of record into one shape." (15), "Map who may do
  what, to which record." (16), "The agent's tools are CRUD on the work." (17), "Log every transition as a diff."
  (18), "Strong vs. weak submissions." (19), "Your weekend with Hyphenate." (20), "Questions?" (21).
- #cohost-hyphenate, read in full (29 messages, Oct 5 to Oct 23). Besides the recording and the slides: you enter
  the track by picking it at submission (Rudraksh Awasthi, Oct 22).

<!-- The story and the feature map are added by the credit desk thread. -->
