import 'server-only';
// Storage. Neon Postgres when DATABASE_URL is set (hosted), in memory otherwise (local and judge runs).
// Holds rate limit counters, daily send totals and the activity index. Balances and receipts
// always come from the chain, so losing this store never loses money or receipts.
import { neon } from '@neondatabase/serverless';
import { DATABASE_URL } from './env';

export type Activity = { account: string; kind: 'send' | 'receive' | 'buy' | 'sell' | 'faucet' | 'signup'; tx: string; data: Record<string, unknown>; at: number };

interface Store {
  incr(key: string, ttlSec: number, by?: number): Promise<number>;
  get(key: string): Promise<number>;
  addActivity(a: Activity): Promise<void>;
  activity(account: string, limit?: number): Promise<Activity[]>;
}

class Memory implements Store {
  kv = new Map<string, { n: number; exp: number }>();
  acts: Activity[] = [];
  async incr(key: string, ttl: number, by = 1) {
    const e = this.kv.get(key);
    const now = Date.now();
    const n = (e && e.exp > now ? e.n : 0) + by;
    this.kv.set(key, { n, exp: e && e.exp > now ? e.exp : now + ttl * 1000 });
    return n;
  }
  async get(key: string) { const e = this.kv.get(key); return e && e.exp > Date.now() ? e.n : 0; }
  async addActivity(a: Activity) { this.acts.unshift(a); if (this.acts.length > 5000) this.acts.length = 5000; }
  async activity(account: string, limit = 50) { return this.acts.filter((a) => a.account === account).slice(0, limit); }
}

class Neon implements Store {
  sql = neon(DATABASE_URL);
  ready: Promise<unknown>;
  constructor() {
    this.ready = (async () => {
      await this.sql`create table if not exists pocket_counters (key text primary key, n numeric not null, expires_at timestamptz not null)`;
      await this.sql`create table if not exists pocket_activity (id bigserial primary key, account text not null, kind text not null, tx text not null, data jsonb not null, at timestamptz not null default now())`;
      await this.sql`create index if not exists pocket_activity_account on pocket_activity (account, at desc)`;
      await this.sql`create unique index if not exists pocket_activity_uniq on pocket_activity (account, tx, kind)`;
    })();
  }
  async incr(key: string, ttl: number, by = 1) {
    await this.ready;
    const r = await this.sql`insert into pocket_counters (key, n, expires_at) values (${key}, ${by}, now() + make_interval(secs => ${ttl}))
      on conflict (key) do update set n = case when pocket_counters.expires_at < now() then ${by} else pocket_counters.n + ${by} end,
      expires_at = case when pocket_counters.expires_at < now() then now() + make_interval(secs => ${ttl}) else pocket_counters.expires_at end
      returning n`;
    return Number(r[0].n);
  }
  async get(key: string) {
    await this.ready;
    const r = await this.sql`select n from pocket_counters where key = ${key} and expires_at > now()`;
    return r.length ? Number(r[0].n) : 0;
  }
  async addActivity(a: Activity) {
    await this.ready;
    await this.sql`insert into pocket_activity (account, kind, tx, data, at) values (${a.account}, ${a.kind}, ${a.tx}, ${JSON.stringify(a.data)}, ${new Date(a.at).toISOString()}) on conflict do nothing`;
  }
  async activity(account: string, limit = 50) {
    await this.ready;
    const r = await this.sql`select account, kind, tx, data, at from pocket_activity where account = ${account} order by at desc limit ${limit}`;
    return r.map((x) => ({ account: x.account, kind: x.kind, tx: x.tx, data: x.data, at: new Date(x.at).getTime() })) as Activity[];
  }
}

const g = globalThis as unknown as { __pocketStore?: Store };
export const store: Store = g.__pocketStore || (g.__pocketStore = DATABASE_URL ? new Neon() : new Memory());
export const storeKind = DATABASE_URL ? 'neon' : 'memory';

export async function limit(key: string, max: number, ttlSec: number) {
  const n = await store.incr('rl:' + key, ttlSec);
  if (n > max) throw new HttpError(429, 'Too many requests. Try again later.');
}
export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
