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
  addMemory(account: string, text: string): Promise<Memo>;
  memories(account: string): Promise<Memo[]>;
  deleteMemory(account: string, id: string): Promise<void>;
  addChat(account: string, m: ChatRow): Promise<void>;
  chats(account: string, limit?: number): Promise<ChatRow[]>;
  clearChat(account: string): Promise<void>;
}
export type Memo = { id: string; text: string; at: number };
export type ChatRow = { role: 'user' | 'assistant'; content: string; at: number; meta?: Record<string, unknown> | null };
const rid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

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
  mem = new Map<string, Memo[]>();
  chat = new Map<string, ChatRow[]>();
  async addMemory(account: string, text: string) { const m = { id: rid(), text, at: Date.now() }; this.mem.set(account, [...(this.mem.get(account) || []), m].slice(-50)); return m; }
  async memories(account: string) { return this.mem.get(account) || []; }
  async deleteMemory(account: string, id: string) { this.mem.set(account, (this.mem.get(account) || []).filter((m) => m.id !== id)); }
  async addChat(account: string, m: ChatRow) { this.chat.set(account, [...(this.chat.get(account) || []), m].slice(-200)); }
  async chats(account: string, limit = 40) { return (this.chat.get(account) || []).slice(-limit); }
  async clearChat(account: string) { this.chat.delete(account); }
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
class Neon implements Store {
  sql = neon(DATABASE_URL);
  ready: Promise<unknown>;
  constructor() {
    this.ready = (async () => {
      await this.sql`create table if not exists pocket_counters (key text primary key, n numeric not null, expires_at timestamptz not null)`;
      await this.sql`create table if not exists pocket_activity (id bigserial primary key, account text not null, kind text not null, tx text not null, data jsonb not null, at timestamptz not null default now())`;
      await this.sql`create index if not exists pocket_activity_account on pocket_activity (account, at desc)`;
      await this.sql`create unique index if not exists pocket_activity_uniq on pocket_activity (account, tx, kind)`;
      await this.sql`create table if not exists pocket_memory (id text primary key, account text not null, text text not null, at timestamptz not null default now())`;
      await this.sql`create index if not exists pocket_memory_account on pocket_memory (account, at)`;
      await this.sql`create table if not exists pocket_chat (id bigserial primary key, account text not null, role text not null, content text not null, meta jsonb, at timestamptz not null default now())`;
      await this.sql`create index if not exists pocket_chat_account on pocket_chat (account, id desc)`;
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

Neon.prototype.addMemory = async function (this: Neon, account: string, text: string) {
  await this.ready; const m = { id: rid(), text, at: Date.now() };
  await this.sql`insert into pocket_memory (id, account, text, at) values (${m.id}, ${account}, ${text}, ${new Date(m.at).toISOString()})`;
  await this.sql`delete from pocket_memory where account = ${account} and id not in (select id from pocket_memory where account = ${account} order by at desc limit 50)`;
  return m;
};
Neon.prototype.memories = async function (this: Neon, account: string) {
  await this.ready; const r = await this.sql`select id, text, at from pocket_memory where account = ${account} order by at asc`;
  return r.map((x) => ({ id: x.id, text: x.text, at: new Date(x.at).getTime() }));
};
Neon.prototype.deleteMemory = async function (this: Neon, account: string, id: string) { await this.ready; await this.sql`delete from pocket_memory where account = ${account} and id = ${id}`; };
Neon.prototype.addChat = async function (this: Neon, account: string, m: ChatRow) {
  await this.ready; await this.sql`insert into pocket_chat (account, role, content, meta, at) values (${account}, ${m.role}, ${m.content}, ${m.meta ? JSON.stringify(m.meta) : null}, ${new Date(m.at).toISOString()})`;
};
Neon.prototype.chats = async function (this: Neon, account: string, limit = 40) {
  await this.ready; const r = await this.sql`select role, content, meta, at from pocket_chat where account = ${account} order by id desc limit ${limit}`;
  return r.reverse().map((x) => ({ role: x.role, content: x.content, meta: x.meta, at: new Date(x.at).getTime() }));
};
Neon.prototype.clearChat = async function (this: Neon, account: string) { await this.ready; await this.sql`delete from pocket_chat where account = ${account}`; };
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging, @typescript-eslint/no-empty-object-type
interface Neon extends Pick<Store, 'addMemory' | 'memories' | 'deleteMemory' | 'addChat' | 'chats' | 'clearChat'> {}

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
