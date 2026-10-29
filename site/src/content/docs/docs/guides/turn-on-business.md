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

1. Only the owner can turn Business on, and Settings has no switch for it yet. Use the API from a shell on the box, or
   with the token of a phone paired as the owner. A release build of GurtOS Server has no shell. Use a debug build, or
   set `BOX_EDITION=business` before the box first starts (see below).
2. Turn it on. A **Company** group then appears in Settings, with **People**, **Rules** and **Kill switch**:

   ```sh
   curl -s -X PUT http://127.0.0.1:7700/api/business \
     -H 'content-type: application/json' \
     -d '{"on": true, "company": "Example Supply", "policy": "Over $10,000 goes to the Controller.\nEverything else goes to any approver."}'
   ```

3. Add people. In Settings, **People**, choose **Add a person…**, fill in the sheet and choose **Add**. The pairing sheet
   opens next, with a QR code and a one-time code. For someone already added, open them and choose **Pair a phone…**.
   Or use the API, as the owner or an admin: `POST /api/people {name, role, title?, limitCents?, approvesFor?}`. An
   approver needs `limitCents`, in US cents, and `approvesFor`, the names the policy uses. This adds the Controller from the policy above:

   ```sh
   curl -s -X POST http://127.0.0.1:7700/api/people \
     -H 'content-type: application/json' \
     -d '{"name": "Rosa Delgado", "role": "approver", "title": "Controller", "limitCents": 5000000, "approvesFor": ["Controller"]}'
   ```

   The answer is the person, with an `id` such as `rosa`. Give each person a one-time pairing code with
   `POST /api/people/<id>/pair`. The code lasts 5 minutes. A phone or browser redeems it as usual, and every request
   with that device's token is that person. Until someone approves for a name in the policy, a rule that sends requests
   there goes to the owner, and `GET /api/business` lists a warning.
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
