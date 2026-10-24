// Splits a bill, in cents, between people.
export function split(totalCents, people) {
  const share = Math.floor(totalCents / people);
  return Array(people).fill(share);
}
