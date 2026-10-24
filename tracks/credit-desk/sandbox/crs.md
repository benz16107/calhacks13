# CRS Credit API: what the credit desk uses

Checked live against the CRS sandbox on 2026-10-23: six applicants, seven checks each, 42 calls. Every result
matched the CRS persona the applicant uses. The raw answers, with each call's `RequestID`, are in `crs-responses/`.
`crs-check.ts` runs the same calls again.

Sources: https://calhacks.crscreditapi.com and the CRS MCP server package
(`@crscreditapi/crs-calhacks-mcp-server` 1.1.2: its README, product guides, OpenAPI spec and `personas.json`).

## Keys

`CRS_USERNAME` and `CRS_PASSWORD` are in the box vault, `/etc/box/vault.env`, on both test VMs. All five products
the desk uses are turned on for the account: every call above returned data.

The MCP server for Claude Code (docs tools work without credentials; only `debug_request` needs them):

```sh
claude mcp add crs-calhacks -e CRS_USERNAME=... -e CRS_PASSWORD=... -- npx -y @crscreditapi/crs-calhacks-mcp-server@latest
```

## Run the checks

On a test VM, as root so the script can read the vault, from a copy of `tracks/credit-desk`:

```sh
sudo node sandbox/crs-check.ts /tmp/crs-out cases/fogline-2026-10
```

It logs in once and stops on a failed login. Repeated failed logins disable the account with no warning, so never
retry a failed login in a loop. It writes one file per check: the route, the body sent, the HTTP status, the
`RequestID` and the response.

## Calls

Base URL `https://api-sandbox.stitchcredit.com/api`. `POST /users/login` with `{"username","password"}` returns a
`token`; send `Authorization: Bearer <token>`. `g` is the guarantor, `a` the application.

| Check | Request | Body built from the application |
|---|---|---|
| Credit report, each bureau | `POST /transunion/credit-report/standard/tu-prequal-fico9`, `/equifax/credit-report/standard/efx-prequal-vantage4`, `/experian/credit-report/standard/exp-prequal-vantage4` | `firstName: g.first_name, lastName: g.last_name, ssn: g.ssn, addresses: [{borrowerResidencyType: "Current", addressLine1: g.home_address.line1, city, state, postalCode: g.home_address.zip}]` |
| Identity | `POST /transunion/identity-manager-verification/basic` | `firstName, lastName, ssn, dob: g.dob, street1: g.home_address.line1, city, state, zip` |
| Fraud | `POST /fraud-finder/fraud-finder` | `firstName, lastName, phoneNumber: g.phone, email: g.email, ipAddress: a.submitted_from_ip, address: {addressLine1, city, state, postalCode}` |
| Public records | `POST /pp/fcrablj/data` | `terms: {term: [{person: {firstName, lastName, ssn}}]}` |
| Phone owner | `POST /accurate-append/reverse` | `phoneNumber: g.phone` |

Not used, on purpose (rule CHK-2): criminal and eviction searches. They are not relevant to trade credit.

## How to read the answers

- **Credit reports return errors as HTTP 200.** `errorMessages` is null on success. File status is
  `creditFiles[].creditFileDetail.creditFileResultStatusType`: `FileReturned`, `NoFileReturnedNoHit`,
  `NoFileReturnedCreditFreeze`.
- **Score** is `scores[].scoreValue`, a string. Model names differ by bureau: TransUnion `TransUnionVantageScore4.0`,
  Experian `VantageScore 4.0`, and Equifax returns two entries (`Vantage 4.0` and `02958`) with the same value.
- **Bad marks:** read `summaries.derogatorySummary` (`collectionsCount`, `chargeOffsCount`, `_90DayLates`) or a
  tradeline's `derogatoryDataIndicator` and `currentRatingType`. **Do not use `chargeOffAmount`**: in the sandbox's
  Experian files every tradeline carries 931, clean ones too.
- **Inquiries:** `inquiries[]`, each with an `inquiryDate`.
- **Identity:** `addOnProducts[0].idManagerVerification.messages[]`, each `{code, text, source}`. Empty means
  verified. Seen live: 2201 "INPUT SSN NOT ASSOCIATED WITH INPUT NAME", 2202 "INPUT DATE OF BIRTH DOES NOT MATCH FILE",
  2101 "INPUT CURRENT ADDRESS DOES NOT MATCH FILE CURRENT ADDRESS". CRS's notes add 2301 (deceased) and 2401 (fraud
  alert). KBA is not mocked.
- **Fraud Finder:** `risk.score` (0 to 100; rule FRD-2 stops at 70), `risk.phone` (`line_type`, `prepaid`,
  `owner.*_match`), `eam.date_first_seen` for the email, `risk.postal.ip_postal_distance` as text ("5 miles",
  "> 1000 miles"), `email_validation.status`. The field you send is `ipAddress`; one named `ip` is ignored.
- **PitchPoint:** `DetailedBLJReport.BankruptciesFound`, `JudgmentsFound`, `LiensFound`. Details are under
  `Results.Judgments.JudgmentRecord` (`TotalJudgmentAmount`, `Status`, `Plaintiff`, `FilingDate`) and
  `Results.Liens.LienRecord` (`TotalLienAmount`, `Status`). A single record comes back as an object, not a list.
- **Phone owner:** `data.records[]`. Empty means no one is on file for that number.
- **Every response has a `RequestID` header.** Log it with the decision (rule CHK-3). `GET /users/retention/{id}`
  shows what was sent and returned.
- Identical requests return cached results.

## The sandbox only knows 20 fake people

It returns canned results only for its personas; anything else goes to the real vendor and comes back empty. So every
applicant's guarantor is copied from a persona; all 20 are in `crs-personas.json`. Copy the name, SSN, date of birth,
address, phone and email as written. **Letter case does not matter:** "Grace Nakamura, 1850 Solano Ave, Berkeley"
returned the same report as the upper-case version (tested 2026-10-23).

## Live results, 2026-10-23

| Application | Guarantor | TU / EFX / EXP | Inquiries | Identity | Fraud Finder | Public records | Phone owner | Desk conclusion |
|---|---|---|---|---|---|---|---|---|
| APP-1041 Kettle & Crumb Cafe | P19 Grace Nakamura | 770 / 770 / 770 | 2 | verified | 9 | none | her | Approve 8,000 Net 30 (analyst) |
| APP-1042 Bright Harbor Catering | P01 Margaret Okafor | 790 / 790 / 790 | 1 | verified | 11 | none | her | Propose 40,000; controller approves |
| APP-1043 Pacific Crest Provisions | **P13 Kayla Brennan** | 640 / 640 / 640, 3 accounts | **9, Aug 19 to Sep 12** | **fails: 2201, 2202, 2101** | **88**: prepaid VoIP, owner does not match, email first seen Oct 15, IP over 1,000 miles away | none | **no one** | **Fraud hold**, though a simple rule approves 20,000 |
| APP-1044 Saffron Table Catering | P08 Priya Venkatesan | 690 / 690 / 690 | 2 | verified | 10 | **12,300 judgment, unsatisfied; 7,450 Illinois tax lien, unreleased** | her | Band C, 7,500 Net 15; controller |
| APP-1045 Castellanos Panaderia | P17 Elena Castellanos | **760 / no file / 700 with one collection** | 1 | verified | 11 | none | her | Band B, 15,000; controller |
| APP-1046 Lakeshore Diner | P02 Daniel Whitfield | 815 / 815 / 815 | 1 | verified | 9 | none | him | 21,000 on verified revenue; controller |

Spare personas for a judge's own case: P05 subprime (decline), P06 Chapter 7 discharged, P07 Chapter 13 open,
P12 identity mismatch (a second fraud case), P14 deceased SSN, P15 frozen TransUnion file, P16 fraud alert (KBA step-up),
P20 file with no score. Their expected results are in `crs-personas.json`; these eight were not called.

## Business credit

The CRS page lists "business credit: a company's debt picture and its state filings", but no sandbox route in the MCP
server or its OpenAPI spec covers it. Until CRS says otherwise, `sources/business_credit.json` in the case is simulated
and labeled so.

## Questions for the CRS booth

1. Is business credit (company debt and state filings) available in the CalHacks sandbox? Which route and which test companies?
2. Every tradeline in the sandbox's Experian files has `chargeOffAmount` 931. Is that intended?
3. For the Identity/Fraud prize, do you want to see the fraud stop rules themselves, or only the catch?
