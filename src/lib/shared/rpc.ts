// Minimal NEAR JSON-RPC client with failover. Works in the browser and on the server.
// FastNEAR first (the old rpc.testnet.near.org endpoint now rate limits hard).
const DEFAULT = ['https://test.rpc.fastnear.com', 'https://rpc.testnet.near.org', 'https://near-testnet.drpc.org'];
export const RPC_URLS: string[] = (
  (typeof process !== 'undefined' && (process.env.NEXT_PUBLIC_NEAR_RPC_URLS || process.env.NEAR_RPC_URLS)) || ''
).split(',').map((s) => s.trim()).filter(Boolean).concat(DEFAULT).filter((u, i, a) => a.indexOf(u) === i);

let id = 0;
export async function rpc<T = any>(method: string, params: unknown): Promise<T> {
  let last: unknown;
  for (const url of RPC_URLS) {
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params }),
        signal: AbortSignal.timeout(method.startsWith('send_tx') || method === 'broadcast_tx_commit' ? 60000 : 12000),
        cache: 'no-store',
      });
      if (r.status === 429 || r.status >= 500) { last = new Error(url + ' ' + r.status); continue; }
      const j = await r.json();
      if (j.error) {
        const msg = JSON.stringify(j.error);
        if (/429|rate|TIMEOUT|timeout|Internal/i.test(msg) && !/InvalidTransaction|ActionError|FunctionCallError/.test(msg)) { last = new Error(msg); continue; }
        const e = new Error(j.error?.cause?.name || j.error?.message || msg) as Error & { data?: unknown };
        e.data = j.error;
        throw e;
      }
      return j.result as T;
    } catch (e) {
      if ((e as { data?: unknown }).data) throw e;
      last = e;
    }
  }
  throw last instanceof Error ? last : new Error('All NEAR RPC endpoints failed');
}

export async function view<T = any>(contract: string, method: string, args: object = {}): Promise<T> {
  const r = await rpc<{ result: number[] }>('query', {
    request_type: 'call_function', finality: 'optimistic', account_id: contract, method_name: method,
    args_base64: btoa(JSON.stringify(args)),
  });
  return JSON.parse(new TextDecoder().decode(new Uint8Array(r.result))) as T;
}

export async function viewAccount(account: string): Promise<{ amount: string; locked: string; code_hash: string; storage_usage: number } | null> {
  try {
    return await rpc('query', { request_type: 'view_account', finality: 'optimistic', account_id: account });
  } catch (e) {
    if (/UNKNOWN_ACCOUNT|does not exist/i.test(String((e as Error).message) + JSON.stringify((e as { data?: unknown }).data || ''))) return null;
    throw e;
  }
}

export async function viewAccessKey(account: string, publicKey: string): Promise<{ nonce: number; permission: unknown } | null> {
  try {
    return await rpc('query', { request_type: 'view_access_key', finality: 'optimistic', account_id: account, public_key: publicKey });
  } catch {
    return null;
  }
}
export const latestBlock = () => rpc<{ header: { height: number; hash: string } }>('block', { finality: 'final' });
