// A web source for a credit decision: what an applicant's website and Google Maps listing say about the business,
// set against what the applicant claimed. The web can disagree with the application; that is the point.

export type Claimed = { name?: string; phone?: string; address?: string; zip?: string; yearStarted?: number; website?: string };
export type Place = { title?: string; address?: string; phone?: string; website?: string; totalScore?: number; reviewsCount?: number; permanentlyClosed?: boolean; temporarilyClosed?: boolean };
export type Disagreement = { field: string; claimed: string; found: string };

const digits = (s = '') => s.replace(/\D/g, '').slice(-10);
const words = (s = '') => new Set(s.toLowerCase().replace(/\b(llc|inc|co|corp|company|ltd|the|and)\b/g, ' ').split(/[^a-z0-9]+/).filter((w) => w.length > 2));
const PHONE = /\(?\b\d{3}\)?[-. ]?\d{3}[-. ]?\d{4}\b/g;

/** The year a business says it started, from "since 2011", "founded in 2011", "est. 2011". */
export const sinceYear = (text = '') => Number(text.match(/\b(?:since|founded(?: in)?|established(?: in)?|est\.?)\s*(?:in\s*)?((?:19|20)\d\d)\b/i)?.[1]) || undefined;

export function compare(claimed: Claimed, site: { text: string } | undefined, place: Place | undefined): Disagreement[] {
  const out: Disagreement[] = [];
  const add = (field: string, c: string, f: string) => out.push({ field, claimed: c, found: f });
  const name = claimed.name;
  if (name && place?.title) {
    const [a, b] = [words(name), words(place.title)];
    if (a.size && b.size && ![...a].some((w) => b.has(w))) add('business name', name, `Google Maps lists "${place.title}"`);
  }
  if (claimed.phone) {
    const found = [place?.phone, ...(site?.text.match(PHONE) ?? [])].filter(Boolean).map((p) => digits(p));
    if (found.length && !found.includes(digits(claimed.phone))) add('phone', claimed.phone, `the web shows ${[...new Set(found)].join(', ')}`);
  }
  if ((claimed.zip || claimed.address) && place?.address) {
    const zip = claimed.zip ?? '';
    const street = claimed.address?.match(/\d+/)?.[0];
    if (!(zip && place.address.includes(zip)) && !(street && place.address.includes(street))) add('address', [claimed.address, zip].filter(Boolean).join(' '), `Google Maps lists "${place.address}"`);
  }
  const year = sinceYear(site?.text);
  if (claimed.yearStarted && year && Math.abs(year - claimed.yearStarted) > 1) add('year started', String(claimed.yearStarted), `the website says since ${year}`);
  if (place?.permanentlyClosed) add('open for business', 'open', 'Google Maps marks it permanently closed');
  if (!claimed.website && !place && !site) add('web presence', 'a business with customers', 'no website and no Google Maps listing found');
  else if (claimed.website && !site?.text) add('website', claimed.website, 'the site gave no readable page');
  return out;
}
