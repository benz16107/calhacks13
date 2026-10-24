// Fraud stops the box enforces in code. The rules file says what a fraud stop is (FRD-1, FRD-2, and GEN-3 for text that
// tries to direct the desk); these functions read the same CRS answers and the same application, so a seat that is
// argued into approving still cannot record an approval. No tool clears a stop, and a seat cannot answer for the controller.
export interface Stop { rule: string; why: string }

// Phrases that try to direct the desk instead of describing the business (GEN-3).
const DIRECTIVES = [
  /\bignore\b.{0,60}\b(identity|codes?|checks?|rules?|flags?|instructions?|fraud|verification)/i,
  /\balready (been )?(approved|signed off|cleared|authori[sz]ed)\b/i,
  /\b(skip|bypass|override|waive|disregard)\b.{0,40}\b(checks?|verification|review|controller|rules?|identity)/i,
  /\b(ceo|cfo|owner|manager|director|vp|boss|controller)\b.{0,40}\b(approved|authori[sz]ed|signed off|said)\b/i,
  /\btreat (this|it|the case|the application)\b.{0,30}\bas approved\b/i,
  /\bdo not (flag|hold|refer|call|check)\b/i,
];

const words = (app: any): string[] => {
  const out: string[] = [];
  for (const v of Object.values(app?.request ?? {})) if (typeof v === 'string') out.push(v);
  for (const k of ['notes', 'comments', 'message', 'additional_information']) if (typeof app?.[k] === 'string') out.push(app[k]);
  return out;
};

/** CRS identity and Fraud Finder answers read the way FRD-1 and FRD-2 do. `crs` may hold only some of the checks. */
export function identityStops(crs: any): Stop[] {
  const stops: Stop[] = [];
  const codes: string[] = (crs?.identity?.problems ?? []).map((p: { code: string }) => String(p.code));
  const hard = codes.filter((c) => ['2201', '2202', '2301'].includes(c));
  if (hard.length) stops.push({ rule: 'FRD-1', why: `TransUnion identity verification failed (${hard.join(', ')})` });
  // Missing data never counts as a pass (GEN-2): a check that errored is a stop, not a clean result.
  if (crs?.identity?.error || crs?.fraud?.error) stops.push({ rule: 'GEN-2', why: `the ${crs.identity?.error ? 'identity' : 'Fraud Finder'} check did not return an answer` });
  const score = crs?.fraud?.risk_score;
  if (typeof score === 'number' && score >= 70) stops.push({ rule: 'FRD-2', why: `Fraud Finder risk score is ${score}` });
  return stops;
}

export function fraudStops(crs: any, app?: any): Stop[] {
  const stops = identityStops(crs);
  const said = words(app).find((t) => DIRECTIVES.some((r) => r.test(t)));
  if (said) stops.push({ rule: 'GEN-3', why: `the application text tries to direct the desk ("${said.slice(0, 90)}")` });
  return stops;
}

/** The outcomes a stop forbids: FRR-1 allows no terms and no cash in advance until the controller decides. */
export const FORBIDDEN_UNDER_STOP = ['approve', 'cash in advance'];
