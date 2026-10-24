---
title: Turn on GurtOS Business
description: Turn a GurtOS Server or GurtOS Personal box into a GurtOS Business box with people, roles and an approval policy.
sidebar:
  badge:
    text: Preview
    variant: note
---

GurtOS Business is not a separate image. You install [GurtOS Server](/docs/get-started/install-server/) or
[GurtOS Personal](/docs/get-started/install-personal/), then turn Business on. People hold roles, and a policy written in
plain words sends each approval to the person who may answer it. The preview uses sandbox data.

## Steps

1. Open the box's own screen, or a phone paired as the owner. Only the owner can turn Business on.
2. Turn it on with the API, from a shell on the box (a **Company** group then appears in Settings):

   ```sh
   curl -s -X PUT http://127.0.0.1:7700/api/business \
     -H 'content-type: application/json' \
     -d '{"on": true, "company": "Example Supply", "policy": "Over $10,000 goes to the Controller.\nEverything else goes to any approver."}'
   ```

3. Add people with `POST /api/people {name, role, limitCents?, approvesFor?}`, then give each one a one-time pairing
   code with `POST /api/people/<id>/pair`. A phone or browser redeems it as usual, and every request with that device's
   token is that person.
4. `GET /api/system` now reports `edition: "business"`.

On a new box you can instead set `BOX_EDITION=business` in the service's environment before the first start.

Turning Business off (`{"on": false}`) keeps the people and the policy for next time.

## Roles

| Role | May |
|---|---|
| `owner` | Everything an admin may, plus settings, keys and apps |
| `admin` | People, the policy, pairing people's phones, the kill switch |
| `approver` | Answers what the policy sends to them, up to their limit |
| `requester` | Starts tasks and sees their own requests. Never answers one |
| `auditor` | Reads everything, including the audit. Cannot change anything |

See [Editions](/docs/introduction/editions/#gurtos-business) for what Business adds.

## Related

- [Approve from your phone](/docs/guides/approve-from-your-phone/)
- [Approvals and budgets](/docs/concepts/approvals-and-budgets/)
- [Use cases by edition](/docs/introduction/use-cases/)
