# CRS Credit API: what the credit desk uses

Read on 2026-10-23 from https://calhacks.crscreditapi.com and the CRS MCP server package
(`@crscreditapi/crs-calhacks-mcp-server` 1.1.2: its README, product guides, OpenAPI spec and `personas.json`).
**Nothing was called.** No sandbox credentials exist yet.

## Keys Ben needs

| What | Where to get it | Store as |
|---|---|---|
| CRS sandbox username and password | https://calhacks.crscreditapi.com, "Get started": enter your email, follow the invite email to the CRS portal. A second email links the Postman collection. | `CRS_USERNAME`, `CRS_PASSWORD` in a git-ignored `.env` on the test VM |

When the account arrives, ask the CRS booth to confirm these products are on it (a `401` from one means it is off):

- `credit_report` with configs `tu-prequal-fico9`, `efx-prequal-vantage4`, `exp-prequal-vantage4`
- `tu_identity_verification` (role `ROLE_TU_TV`)
- `fraud_finder` (role `ROLE_ATDATA`, config `fraud-finder`)
- `pitchpoint_blj`
- `accurate_append` (optional, for the reverse phone check)

The MCP server for Claude Code (docs tools work without credentials; only `debug_request` needs them):

```sh
claude mcp add crs-calhacks -e CRS_USERNAME=... -e CRS_PASSWORD=... -- npx -y @crscreditapi/crs-calhacks-mcp-server@latest
```

## Calls

Base URL `https://api-sandbox.stitchcredit.com/api`. Log in once with `POST /users/login`
(`{"username","password"}`), keep the `token`, send `Authorization: Bearer <token>`. Repeated failed logins disable the
account with no warning, so never retry a failed login in a loop.

The desk runs these on the owner who signs the personal guarantee (`guarantor` in the application). `g` is the
guarantor, `a` the application.

| Check | Request | Body built from the application |
|---|---|---|
| Credit report, each bureau | `POST /transunion/credit-report/standard/tu-prequal-fico9`, `/equifax/credit-report/standard/efx-prequal-vantage4`, `/experian/credit-report/standard/exp-prequal-vantage4` | `firstName: g.first_name, lastName: g.last_name, ssn: g.ssn, addresses: [{borrowerResidencyType: "Current", addressLine1: g.home_address.line1, city, state, postalCode: g.home_address.zip}]` |
| Identity | `POST /transunion/identity-manager-verification/basic` | `firstName, lastName, ssn, dob: g.dob, street1: g.home_address.line1, city, state, zip` |
| Fraud | `POST /fraud-finder/fraud-finder` | `firstName, lastName, phoneNumber: g.phone, email: g.email, ipAddress: a.submitted_from_ip, address: {addressLine1, city, state, postalCode}` |
| Public records | `POST /pp/fcrablj/data` | `terms: {term: [{person: {firstName, lastName, ssn}}]}` |
| Phone owner (optional) | `POST /accurate-append/reverse` | `phoneNumber: g.phone` |

Not used, on purpose (rule CHK-2): criminal and eviction searches. They are not relevant to trade credit, and pulling
data the decision does not need is a bad look for the "responsible" judging criterion.

How to read the answers:

- **Credit reports return errors as HTTP 200.** Check `errorMessages` in the body first. A bureau with no file comes
  back as `NoFileReturnedNoHit`; a frozen file as `NoFileReturnedCreditFreeze`.
- **Identity:** `addOnProducts[0].idManagerVerification.messages[]`. Empty means verified. Codes 2201, 2202, 2301 and
  2401 mean SSN issued to another name, SSN issued before the date of birth, deceased, fraud alert. KBA is not mocked.
- **Fraud Finder:** `risk.score` 0 to 100, higher is riskier (rule FRD-2 stops at 70). Also `risk.phone.owner`,
  `eam.date_first_seen`, `risk.postal.ip_postal_distance`. The field is `ipAddress`; a field named `ip` is ignored.
- **Every response has a `RequestID` header.** Log it with the decision (rule CHK-3). `GET /users/retention/{id}`
  shows what was sent and returned; retry 5xx there with backoff.
- Identical requests return cached results.

## The sandbox only knows 20 fake people

It returns canned results only when the body contains every field of one of its personas, exactly as CRS wrote them
(upper case names and addresses). Anything else goes to the real vendor and comes back empty. So every applicant's
guarantor block is copied from a persona; all 20 are in `crs-personas.json` next to this file.

| Application | Business | Guarantor (persona) | What CRS should return | Desk conclusion |
|---|---|---|---|---|
| APP-1041 | Kettle & Crumb Cafe, Berkeley | P19 Grace Nakamura, small-business owner | 770 at all three, identity PASS, Fraud Finder 9, no records | Approve 8,000 Net 30 (analyst) |
| APP-1042 | Bright Harbor Catering, San Jose | P01 Margaret Okafor, prime | 790 at all three, PASS, 11, no records | Propose 40,000; controller approves |
| APP-1043 | Pacific Crest Provisions LLC | **P13 Kayla Brennan, synthetic identity** | 640 thin file, **identity FAIL**, **Fraud Finder 88** (email 3 days old, phone not hers, prepaid VoIP), no records, reverse phone no match | **Fraud hold**, though a simple rule approves 20,000 |
| APP-1044 | Saffron Table Catering, Chicago | P08 Priya Venkatesan | 690, PASS, 10, **12,300 judgment and 7,450 state tax lien** | Band C, 7,500 Net 15; controller |
| APP-1045 | Castellanos Panaderia, Dallas | P17 Elena Castellanos, bureau divergence | **TU 760, Equifax no file, Experian 700 with a charge-off**, PASS, 11 | Band B, 15,000; controller |
| APP-1046 | Lakeshore Diner, Austin | P02 Daniel Whitfield, super-prime | 815 at all three, PASS, 9, no records | 21,000 on verified revenue; controller |

Spare personas for a judge's own case: P05 subprime (decline), P06 Chapter 7 discharged, P07 Chapter 13 open,
P12 identity mismatch (a second fraud case), P14 deceased SSN, P15 frozen TransUnion file, P16 fraud alert (KBA step-up),
P20 file with no score. Expected results for each are in `crs-personas.json`.

## Business credit

The CRS page lists "business credit: a company's debt picture and its state filings", but none of the sandbox routes in
the MCP server or its OpenAPI spec cover it. Until CRS says otherwise, `sources/business_credit.json` in the case is
simulated and labeled so. Ask at the booth (question below).

## Questions for the CRS booth

1. Is business credit (company debt and state filings) available in the CalHacks sandbox? Which route and which test companies?
2. Do the personas' bodies have to match in upper case, or is matching case-insensitive?
3. Can a sandbox account have all of credit report, TruValidate, Fraud Finder, PitchPoint and AccurateAppend turned on?
4. Do the credit reports for P13 really carry the 9 inquiries in 60 days that the persona summary describes?
5. For the Identity/Fraud prize, do you want to see the fraud stop rules themselves, or only the catch?
