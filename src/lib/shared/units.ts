// Exact decimal <-> integer unit conversion with BigInt. No floats touch balances.
export function toUnits(amount: string | number, decimals: number): bigint {
  const s = typeof amount === 'number' ? amount.toFixed(Math.min(decimals, 12)) : amount.trim();
  if (!/^\d+(\.\d+)?$/.test(s)) throw new Error('Bad amount');
  const [w, f = ''] = s.split('.');
  const frac = (f + '0'.repeat(decimals)).slice(0, decimals);
  return BigInt(w) * 10n ** BigInt(decimals) + BigInt(frac || '0');
}
export function fromUnits(units: bigint | string, decimals: number, maxDp = decimals): string {
  const u = typeof units === 'string' ? BigInt(units) : units;
  const neg = u < 0n;
  const a = neg ? -u : u;
  const base = 10n ** BigInt(decimals);
  const w = a / base;
  let f = (a % base).toString().padStart(decimals, '0').slice(0, maxDp).replace(/0+$/, '');
  if (decimals === 0) f = '';
  return (neg ? '-' : '') + w.toString() + (f ? '.' + f : '');
}
export const unitsToNumber = (u: bigint | string, d: number) => Number(fromUnits(u, d, Math.min(d, 12)));
export const YOCTO = 10n ** 24n;
export const nearToYocto = (n: string | number) => toUnits(String(n), 24);
