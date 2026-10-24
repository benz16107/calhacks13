// A line-for-line port of DABstep's scorer to TypeScript. The original is dabstep_benchmark/evaluation/scorer.py in
// the Space https://huggingface.co/spaces/adyen/DABstep (revision d4431c2e, CC BY 4.0), also saved by fetch.sh as
// data/scorer.py. scorer.test.ts runs DABstep's own test cases and compares this port with that file on random
// inputs. Python behaviour kept on purpose: str(float) decides how many decimals a number "has", round() is half-to-even, \w is Unicode, and
// difflib.SequenceMatcher (autojunk on) gives the 0.95 similarity.

const WORD = /[\p{L}\p{N}_]/u; // Python's \w for str patterns

/** Python's repr(float): shortest round-trip digits, exponent form below 1e-4 and from 1e16. */
function pyStr(n: number): string {
  const [m, e] = n.toExponential().split('e');
  const exp = Number(e);
  if (exp >= -4 && exp < 16) {
    if (Number.isInteger(n)) return `${n}.0`;
    return String(n); // JS also prints decimal digits in this range
  }
  const sign = exp < 0 ? '-' : '+';
  return `${m}e${sign}${String(Math.abs(exp)).padStart(2, '0')}`;
}

/** Python's round(x, n) for a non-negative float: exact ties go to the even digit. */
function pyRound(x: number, n: number): number {
  const s = x.toFixed(100), cut = s.indexOf('.') + 1 + n;
  const up = Number(x.toFixed(n)); // JS rounds an exact tie up
  if (!/^50*$/.test(s.slice(cut))) return up;
  const down = s.slice(0, n === 0 ? cut - 1 : cut);
  return Number(down.slice(-1)) % 2 === 0 ? Number(down) : up;
}

const isClose = (a: number, b: number) => Math.abs(a - b) <= Math.max(1e-4 * Math.max(Math.abs(a), Math.abs(b)), 1e-4);

export function isNumericWithCommas(value: string): boolean {
  return /^\$?(?:\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+[.,]\d+)$/.test(value.trim());
}

export function questionScorer(input1: string, input2: string): boolean {
  input1 = input1.trim().toLowerCase();
  input2 = input2.trim().toLowerCase();
  if (isNumericWithCommas(input1) || isNumericWithCommas(input2)) {
    const num1 = extractNumeric(input1), num2 = extractNumeric(input2);
    return num1 !== null && num2 !== null ? compareNumeric(num1, num2) : false;
  }
  if (/[;,]/.test(input1) || /[;,]/.test(input2)) return compareLists(input1, input2);
  const num1 = extractNumeric(input1), num2 = extractNumeric(input2);
  if (num1 !== null && num2 !== null) return compareNumeric(num1, num2);
  return compareStrings(input1, input2);
}

export function extractNumeric(value: string): number | null {
  const m = /(\d*\.\d+|\d+\.?\d*)%?/.exec(value.replaceAll(',', '').replaceAll('$', ''));
  return m ? parseFloat(m[1]) : null;
}

export function compareNumeric(num1: number, num2: number): boolean {
  if (num1 === num2) return true;
  if (num1 < 1 && num2 < 1) return isClose(num1, num2);
  const places = (n: number) => (pyStr(n).includes('.') ? pyStr(n).split('.').at(-1)!.length : 0);
  const roundTo = Math.min(places(num1), places(num2));
  if (pyRound(num1, roundTo) === pyRound(num2, roundTo)) return true;
  return isClose(num1, num2);
}

export function compareStrings(str1: string, str2: string): boolean {
  const strip = (s: string) => Array.from(s).filter((c) => WORD.test(c)).join('');
  if (strip(str1) === strip(str2)) return true;
  const words = (s: string) => s.toLowerCase().match(/[\p{L}\p{N}_]+/gu) ?? [];
  const words1 = words(str1), words2 = words(str2);
  if ((words1.length === 1 || words2.length === 1) && words1.length && words2.length) {
    const subset = (a: string[], b: string[]) => a.every((w) => b.includes(w));
    return subset(words1, words2) || subset(words2, words1);
  }
  return sequenceRatio(str1, str2) > 0.95;
}

export function compareLists(list1: string, list2: string): boolean {
  const items = (l: string) => l.trim().replace(/^\[|\]$/g, '').split(/[,;]/).map((s) => s.trim()).filter(Boolean).sort();
  const items1 = items(list1), items2 = items(list2);
  if (items1.length === items2.length && items1.every((x, i) => x === items2[i])) return true;
  if (items1.length !== items2.length) return false;
  return items1.every((x, i) => questionScorer(x, items2[i]));
}

/** difflib.SequenceMatcher(None, a, b).ratio(), including autojunk (strings of 200+ characters drop common characters). */
export function sequenceRatio(s1: string, s2: string): number {
  const a = Array.from(s1), b = Array.from(s2);
  const b2j = new Map<string, number[]>();
  b.forEach((c, j) => b2j.set(c, [...(b2j.get(c) ?? []), j]));
  if (b.length >= 200) for (const [c, js] of b2j) if (js.length > Math.floor(b.length / 100) + 1) b2j.delete(c);
  const longest = (alo: number, ahi: number, blo: number, bhi: number) => {
    let besti = alo, bestj = blo, bestsize = 0;
    let j2len = new Map<number, number>();
    for (let i = alo; i < ahi; i++) {
      const next = new Map<number, number>();
      for (const j of b2j.get(a[i]) ?? []) {
        if (j < blo) continue;
        if (j >= bhi) break;
        const k = (j2len.get(j - 1) ?? 0) + 1;
        next.set(j, k);
        if (k > bestsize) [besti, bestj, bestsize] = [i - k + 1, j - k + 1, k];
      }
      j2len = next;
    }
    // Extend the match over characters that were dropped as popular (no junk list here, so only those).
    while (besti > alo && bestj > blo && a[besti - 1] === b[bestj - 1]) [besti, bestj, bestsize] = [besti - 1, bestj - 1, bestsize + 1];
    while (besti + bestsize < ahi && bestj + bestsize < bhi && a[besti + bestsize] === b[bestj + bestsize]) bestsize++;
    return [besti, bestj, bestsize] as const;
  };
  let matches = 0;
  const queue: [number, number, number, number][] = [[0, a.length, 0, b.length]];
  while (queue.length) {
    const [alo, ahi, blo, bhi] = queue.pop()!;
    const [i, j, k] = longest(alo, ahi, blo, bhi);
    if (!k) continue;
    matches += k;
    if (alo < i && blo < j) queue.push([alo, i, blo, j]);
    if (i + k < ahi && j + k < bhi) queue.push([i + k, ahi, j + k, bhi]);
  }
  const total = a.length + b.length;
  return total ? (2 * matches) / total : 1;
}
