// Recipient detection, from research/crypto-send.md. Pocket never guesses the network for an ambiguous address.
export type Detected =
  | { kind: 'near-named'; account: string }
  | { kind: 'near-implicit'; account: string }
  | { kind: 'evm-or-near'; address: string }
  | { kind: 'solana'; address: string }
  | { kind: 'username'; username: string }
  | { kind: 'unsupported'; reason: string }
  | { kind: 'mainnet'; reason: string }
  | { kind: 'empty' };

const B58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
export function detect(input: string, root: string): Detected {
  const s = input.trim();
  if (!s) return { kind: 'empty' };
  if (s.startsWith('@')) {
    const u = s.slice(1).toLowerCase();
    return /^[a-z0-9_-]{2,32}$/.test(u) ? { kind: 'username', username: u } : { kind: 'unsupported', reason: 'Usernames use letters, numbers, dash and underscore.' };
  }
  const low = s.toLowerCase();
  if (/^[a-f0-9]{64}$/.test(low)) return { kind: 'near-implicit', account: low };
  if (/^0x[a-f0-9]{40}$/.test(low)) return { kind: 'evm-or-near', address: low };
  if (/\.near$/.test(low)) return { kind: 'mainnet', reason: 'That is a NEAR mainnet name. Pocket only runs on testnet, so nothing real can move.' };
  if (/^(([a-z\d]+[-_])*[a-z\d]+\.)+testnet$/.test(low) && low.length <= 64) return { kind: 'near-named', account: low };
  if (/^(bc1|tb1)[a-z0-9]{20,}$/.test(low) || /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(s)) return { kind: 'unsupported', reason: 'That looks like a Bitcoin address. Pocket cannot send USDC to Bitcoin.' };
  if (/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(s)) return { kind: 'unsupported', reason: 'That looks like a Tron address. Pocket does not support Tron.' };
  if (B58.test(s)) return { kind: 'solana', address: s };
  if (/^[a-z0-9_-]{2,32}$/.test(low)) return { kind: 'username', username: low };
  return { kind: 'unsupported', reason: 'Pocket could not read this address.' };
}
export const usernameToAccount = (u: string, root: string) => `${u.toLowerCase()}.${root}`;
export const accountToUsername = (a: string, root: string) => (a.endsWith('.' + root) && a.split('.').length === root.split('.').length + 1 ? a.slice(0, -root.length - 1) : null);
export const short = (a: string, n = 4) => (a.length > n * 2 + 3 ? a.slice(0, n) + '…' + a.slice(-n) : a);
