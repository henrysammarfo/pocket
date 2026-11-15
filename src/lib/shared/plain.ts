/** The account's own refusal reason in plain words (for example "Over your 24 hour limit for NEAR."), without the raw error. */
export function plainFailure(failures: string[]): string {
  const all = failures.join(' ');
  const m = /panicked: ([^"\\]{3,200})/.exec(all);
  if (m) return m[1].trim().replace(/^Smart contract /, '');
  if (/NotEnoughBalance|LackBalance/i.test(all)) return 'Not enough money in the account for this.';
  return 'It was refused and nothing moved.';
}
