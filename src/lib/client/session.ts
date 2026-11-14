'use client';
// The device key. It is made in this browser, stays in this browser, and signs every move.
// Stored in localStorage on this device (testnet app). Back it up from Profile.
import { useEffect, useState, useSyncExternalStore } from 'react';
import { keyFromString } from '../shared/nep413';

export type Session = { account: string; username: string; secretKey: string; publicKey: string; createdAt: number };
export type Profile = { name: string; email: string; avatar: string };
export type Contact = { id: string; name: string; address: string; network: 'near' | 'sol' | 'eth' | 'pol'; kind: 'pocket' | 'wallet'; sends?: number; lastAt?: number };
export type Rules = { keep: number; limit: number; passkey: boolean; passkeyId?: string; speak?: boolean };

const K = { session: 'pocket-session', profile: 'pocket-profile', contacts: 'pocket-contacts', rules: 'pocket-rules', activity: 'pocket-activity', chat: 'pocket-chat' };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const read = <T,>(k: string, d: T): T => { if (typeof localStorage === 'undefined') return d; try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : d; } catch { return d; } };
const write = (k: string, v: unknown) => { localStorage.setItem(k, JSON.stringify(v)); cacheBust++; emit(); };
let cacheBust = 0;
const snapCache = new Map<string, { b: number; v: unknown }>();
function useLS<T>(k: string, d: T): T {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); const s = (e: StorageEvent) => e.key === k && (cacheBust++, cb()); addEventListener('storage', s); return () => { listeners.delete(cb); removeEventListener('storage', s); }; },
    () => { const c = snapCache.get(k); if (c && c.b === cacheBust) return c.v as T; const v = read(k, d); snapCache.set(k, { b: cacheBust, v }); return v; },
    () => d,
  );
}

export const getSession = () => read<Session | null>(K.session, null);
export const setSession = (s: Session | null) => (s ? write(K.session, s) : (localStorage.removeItem(K.session), cacheBust++, emit()));
export const useSession = () => useLS<Session | null>(K.session, null);
export const seedOf = (s: Session) => keyFromString(s.secretKey).seed;

export const DEFAULT_PROFILE: Profile = { name: '', email: '', avatar: 'email' };
export const useProfile = () => useLS<Profile>(K.profile, DEFAULT_PROFILE);
export const setProfile = (p: Partial<Profile>) => write(K.profile, { ...read(K.profile, DEFAULT_PROFILE), ...p });

export const useContacts = () => useLS<Contact[]>(K.contacts, []);
export const getContacts = () => read<Contact[]>(K.contacts, []);
export function saveContact(c: Omit<Contact, 'id'>) {
  const list = getContacts().filter((x) => !(x.address === c.address && x.network === c.network));
  const n = { ...c, id: crypto.randomUUID() };
  write(K.contacts, [n, ...list]);
  return n;
}
export function bumpContact(address: string) {
  write(K.contacts, getContacts().map((c) => (c.address === address ? { ...c, sends: (c.sends || 0) + 1, lastAt: Date.now() } : c)));
}
export const removeContact = (id: string) => write(K.contacts, getContacts().filter((c) => c.id !== id));
export const findContact = (q: string) => { const s = q.trim().toLowerCase(); return getContacts().find((c) => c.name.toLowerCase() === s); };

export const DEFAULT_RULES: Rules = { keep: 0, limit: 200, passkey: false };
export const useRules = () => useLS<Rules>(K.rules, DEFAULT_RULES);
export const getRules = () => read<Rules>(K.rules, DEFAULT_RULES);
export const setRules = (r: Partial<Rules>) => write(K.rules, { ...getRules(), ...r });

export type LocalActivity = { tx: string; kind: string; data: Record<string, unknown>; at: number };
export const useLocalActivity = () => useLS<LocalActivity[]>(K.activity, []);
export const addLocalActivity = (a: LocalActivity) => write(K.activity, [a, ...read<LocalActivity[]>(K.activity, []).filter((x) => x.tx !== a.tx || x.kind !== a.kind)].slice(0, 200));

export type WebSource = { title: string; url: string };
export type WebProduct = { title: string; url: string; store: string; price?: string; rating?: string; image?: string };
export type ChatMsg = { role: 'user' | 'assistant'; content: string; at: number; plan?: unknown; blocked?: unknown; meta?: string[]; confirm?: unknown; chips?: string[]; voice?: boolean; photo?: string; done?: boolean; sources?: WebSource[]; products?: WebProduct[] };
// Many chats, like ChatGPT. 'main' keeps the old single chat. Each chat's messages live under their own key.
export type ThreadInfo = { id: string; title: string; at: number };
const TK = { cur: 'pocket-thread', list: 'pocket-threads' };
const chatKey = (id: string) => (id === 'main' ? K.chat : K.chat + ':' + id);
export const useThreadId = () => useLS<string>(TK.cur, 'main');
export const getThreadId = () => read<string>(TK.cur, 'main');
export const setThreadId = (id: string) => write(TK.cur, id);
export const useThreads = () => useLS<ThreadInfo[]>(TK.list, []);
export const getThreads = () => read<ThreadInfo[]>(TK.list, []);
export const setThreads = (t: ThreadInfo[]) => write(TK.list, t.slice(0, 60));
export const newThreadId = () => 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
export function touchThread(id: string, title?: string) {
  const list = getThreads(); const old = list.find((t) => t.id === id);
  setThreads([{ id, title: old?.title || (title || 'New chat').replace(/\s+/g, ' ').trim().slice(0, 48), at: Date.now() }, ...list.filter((t) => t.id !== id)]);
}
export function dropThread(id: string) { localStorage.removeItem(chatKey(id)); setThreads(getThreads().filter((t) => t.id !== id)); }
export function renameThreadLocal(id: string, title: string) { setThreads(getThreads().map((t) => (t.id === id ? { ...t, title: title.trim().slice(0, 48) || t.title } : t))); }
export function clearChats() { for (const t of getThreads()) localStorage.removeItem(chatKey(t.id)); localStorage.removeItem(K.chat); localStorage.removeItem(TK.list); localStorage.removeItem(TK.cur); cacheBust++; emit(); }
export function useChat() { const id = useThreadId(); return useLS<ChatMsg[]>(chatKey(id), []); }
export const getChat = () => read<ChatMsg[]>(chatKey(getThreadId()), []);
export const setChat = (m: ChatMsg[], id = getThreadId()) => write(chatKey(id), m.slice(-60));

export function useLive<T>(fn: () => Promise<T>, deps: unknown[], everyMs = 0) {
  const [s, setS] = useState<{ data: T | null; error: string | null; at: number }>({ data: null, error: null, at: 0 });
  useEffect(() => {
    let dead = false;
    const run = () => fn().then((data) => !dead && setS({ data, error: null, at: Date.now() })).catch((e) => !dead && setS((p) => ({ ...p, error: String(e?.message || e) })));
    run();
    const t = everyMs ? setInterval(run, everyMs) : null;
    const on = () => run();
    addEventListener('pocket:refresh', on);
    return () => { dead = true; if (t) clearInterval(t); removeEventListener('pocket:refresh', on); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return s;
}
export const refreshAll = () => dispatchEvent(new Event('pocket:refresh'));
