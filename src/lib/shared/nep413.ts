// NEP-413 off chain message signing, as the NEAR Intents verifier checks it.
// Spec: https://github.com/near/NEPs/blob/master/neps/nep-0413.md
// hash = sha256( borsh(u32 tag = 2^31 + 413) || borsh({ message, nonce[32], recipient, callbackUrl: Option<string> }) )
import { ed25519 } from '@noble/curves/ed25519.js';
import { sha256 } from '@noble/hashes/sha2.js';
import bs58 from 'bs58';

const TAG = 2 ** 31 + 413;
const enc = new TextEncoder();

function u32(n: number) {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n, true);
  return b;
}
function str(s: string) {
  const bytes = enc.encode(s);
  return concat(u32(bytes.length), bytes);
}
export function concat(...parts: Uint8Array[]) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

export type Nep413Payload = { message: string; nonce: string /* base64, 32 bytes */; recipient: string; callbackUrl?: string };

export function nep413Hash(p: Nep413Payload): Uint8Array {
  const nonce = b64decode(p.nonce);
  if (nonce.length !== 32) throw new Error('nonce must be 32 bytes');
  const cb = p.callbackUrl == null ? new Uint8Array([0]) : concat(new Uint8Array([1]), str(p.callbackUrl));
  return sha256(concat(u32(TAG), str(p.message), nonce, str(p.recipient), cb));
}

export type SignedNep413 = {
  standard: 'nep413';
  payload: { message: string; nonce: string; recipient: string };
  public_key: string;
  signature: string;
};

export function signNep413(p: Nep413Payload, secretKey: Uint8Array): SignedNep413 {
  const sig = ed25519.sign(nep413Hash(p), secretKey.slice(0, 32));
  const pub = ed25519.getPublicKey(secretKey.slice(0, 32));
  return {
    standard: 'nep413',
    payload: { message: p.message, nonce: p.nonce, recipient: p.recipient },
    public_key: 'ed25519:' + bs58.encode(pub),
    signature: 'ed25519:' + bs58.encode(sig),
  };
}

export function verifyNep413(s: SignedNep413): boolean {
  try {
    const pub = bs58.decode(s.public_key.replace(/^ed25519:/, ''));
    const sig = bs58.decode(s.signature.replace(/^ed25519:/, ''));
    return ed25519.verify(sig, nep413Hash(s.payload), pub);
  } catch {
    return false;
  }
}

export function b64encode(b: Uint8Array) {
  let s = '';
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s);
}
export function b64decode(s: string) {
  const bin = atob(s);
  const b = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
  return b;
}

// Random 32 byte legacy nonce. The verifier treats nonces that start with the
// versioned magic prefix 5628f6c6 specially, so we never produce that prefix.
export function randomNonce(): string {
  const n = crypto.getRandomValues(new Uint8Array(32));
  if (n[0] === 0x56 && n[1] === 0x28) n[0] ^= 0xff;
  return b64encode(n);
}

// Keys in NEAR string form. Secret is "ed25519:" + base58(seed32 || pub32).
export function keyFromString(sk: string) {
  const raw = bs58.decode(sk.replace(/^ed25519:/, ''));
  const seed = raw.slice(0, 32);
  const pub = ed25519.getPublicKey(seed);
  return { seed, pub, publicKey: 'ed25519:' + bs58.encode(pub), secretKey: 'ed25519:' + bs58.encode(concat(seed, pub)) };
}
export function newKey() {
  const seed = ed25519.utils.randomSecretKey();
  const pub = ed25519.getPublicKey(seed);
  return keyFromString('ed25519:' + bs58.encode(concat(seed, pub)));
}
