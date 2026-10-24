# Fogline Supply Co.

Made-up company for the credit desk demo. Every person, business and number here is fictional.

## The business

- **Legal name:** Fogline Supply Co. (a California corporation, founded 2011)
- **Where:** 2240 Livingston St, Oakland, CA 94606. One warehouse.
- **What it sells:** coffee (its own house roast), tea and syrups, oat milk, baking staples (flour, butter), and
  the disposables cafes and restaurants burn through: hot and cold cups, lids, sleeves, clamshells, bags, napkins,
  gloves, sanitizer.
- **Who buys:** independent cafes, bakeries, restaurants, caterers and food trucks. Bay Area customers get Fogline's
  own trucks. Customers elsewhere in the US get freight.
- **Size:** 26 employees, about $8.1M revenue in fiscal 2025, about 140 active customers, 38 of them on trade credit.
  Average open receivables about $410,000.

## People and seats

| Seat | Who | What they may do |
|---|---|---|
| Credit analyst | agent | Checks new business customers, proposes risk band, terms and limit, approves limits up to $10,000, declines |
| Collections clerk | agent | Issues and corrects invoices, applies payments, sends reminders, places holds, releases orders for current customers |
| Controller | Rosa Delgado (human) | Approves limits above $10,000 and any terms with public records, decides fraud referrals, releases credit holds, writes off |
| Sales | M. Chen, J. Park | Bring in customers and enter orders. No credit decisions. |
| Owner | Martin Hale | Not in the credit process |

The two agent seats never approve their own proposals. Anything above the analyst's authority, and every fraud
referral, waits for the controller.

## Terms Fogline offers

- **Net 30:** the default for established customers.
- **2/10 Net 30:** 2% off when paid within 10 days of the invoice date. Offered to a few long-standing customers.
- **Net 15:** for newer or riskier accounts.
- **Cash in advance:** for anyone who does not qualify for terms.

New customers who want terms sign a credit application with a personal guarantee from the owner and consent to a
credit check on that owner. That is why the desk pulls consumer credit, identity and fraud data on the guarantor
through CRS.

## Current trade customers in this case

The case `cases/fogline-2026-10` holds 12 of the 38 trade accounts (one of them is a duplicate record).

| ID | Customer | City | Terms | Limit |
|---|---|---|---|---|
| C-1001 | Golden Gate Bagel Co. | San Francisco | Net 30 | 20,000 |
| C-1002 | Harborview Oyster House | Sausalito | Net 30 | 30,000 |
| C-1003 | Mission Street Taqueria Inc. | San Francisco | Net 30 | 10,000 |
| C-1004 | Greenleaf Juice Co. | Berkeley | Net 30 | 8,000 |
| C-1005 | Telegraph Ave Pizza LLC | Oakland | Net 30 | 15,000 |
| C-1006 | Bluebird Bakery & Cafe | Alameda | 2/10 Net 30 | 12,000 |
| C-1007 | Sunset Noodle Bar LLC | San Francisco | Net 30 | 10,000 |
| C-1008 | Fruitvale Food Truck Collective | Oakland | Net 15 | 5,000 |
| C-1009 | Rockridge Ramen | Oakland | 2/10 Net 30 | 9,000 |
| C-1010 | Dogpatch Deli | San Francisco | Net 30 | 7,500 |
| C-1011 | Sunset Noodle Bar | San Francisco | Net 30 | 10,000 |
| C-1012 | Piedmont Provisions Catering | Oakland | Net 30 | 25,000 |

## Credit policy in brief

The full draft is `rules/credit-rules.draft.yaml`. In short:

1. Check the owner's identity and fraud signals before anything else. One failed fraud check stops the application.
2. Band the applicant on the lowest score any bureau returns. A bad mark at any bureau counts.
3. Size the limit at no more than 10% of revenue Fogline can verify, and no more than the band allows.
4. The analyst approves up to $10,000. Above that, the controller decides.
5. Collect on a fixed schedule by days past due, but fix a wrong invoice or payment before chasing it.
6. Review every customer's limit every 12 months.

## Systems

- **Ledger:** CSV exports from Fogline's accounting system (customers, invoices, invoice lines, payments, open orders).
- **Bank:** Capital One's Nessie sandbox. Fogline's operating account receives customer payments; each trade customer
  has a Nessie account whose bills are Fogline's invoices. Applicants share their own Nessie account statements.
- **Credit data:** CRS Credit API sandbox (credit reports, identity verification, Fraud Finder, PitchPoint).
