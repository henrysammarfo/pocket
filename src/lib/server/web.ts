import 'server-only';
// Live web answers and product finds.
// First choice: NEAR AI Cloud's built in web_search on the private TEE chat model, through the stateless
// Responses API with store: false (NEAR AI keeps no request, response or history). The search itself is
// run by NEAR AI through Brave Search, so the query leaves the enclave for the search provider, but it is
// not tied to the user and Pocket stores nothing. Spend counts toward the NEAR AI daily cap.
// Fallback: Groq browser_search on gpt-oss (not private), when NEAR AI is resting or at its daily cap.
// Links: Groq returns the pages it opened, so only those are shown. NEAR AI returns no URLs, so the model
// lists them and Pocket opens each one and drops any that do not exist, because models invent URLs.
import { groq, nearai, isUp, underCap, record, rest } from './llm';
import { limit } from './store';

export type Source = { title: string; url: string };
export type Product = { title: string; url: string; store: string; price?: string; rating?: string; image?: string };
export type WebOut = { reply: string; sources: Source[]; products: Product[]; usd: number; private: boolean; provider: string };

// A separate model for search keeps chat inside its own free tier token budget.
export const SEARCH_MODEL = process.env.SEARCH_MODEL || 'openai/gpt-oss-20b';
export const webUp = () => (!!nearai || !!groq) && process.env.WEB_SEARCH !== 'off';
const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
const okUrl = (u: string) => /^https:\/\/[^\s"'<>]+$/.test(u) && !/exa\.ai\/search/.test(u);

// Parse the search tool output: result lists look like "【0†Title†www.site.com】", opened pages
// look like "URL: https://..." followed by "# Title" and "Price: 42.95 USD.".
export function parseTools(tools: { arguments?: string; output?: string }[]) {
  const sources: Source[] = []; const products: Product[] = [];
  for (const t of tools || []) {
    const out = String(t.output || '').replace(/^L\d+: ?/gm, '');
    const um = out.match(/URL:\s*(https:\/\/\S+)/);
    if (um && okUrl(um[1])) {
      const url = um[1].replace(/[)\].,]+$/, '');
      const title = (out.match(/^# (.+)$/m)?.[1] || host(url)).trim().slice(0, 140);
      sources.push({ title, url });
      const price = out.match(/Price:\s*([\d.,]+\s*[A-Z]{3})/)?.[1];
      if (price) products.push({ title, url, store: host(url), price, rating: out.match(/Rated ([\d.]+) from ([\d,]+) reviews/)?.slice(1).join(' from ') });
    }
  }
  const seen = new Set<string>();
  return { sources: sources.filter((s) => !seen.has(s.url) && seen.add(s.url)), products };
}

// Product photo from the page's own Open Graph tags. Many big stores block servers, so this is best effort.
async function ogImage(url: string): Promise<string | undefined> {
  try {
    const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36', accept: 'text/html', 'accept-language': 'en-US,en;q=0.9' }, signal: AbortSignal.timeout(4500), redirect: 'follow' });
    if (!r.ok) return;
    const h = (await r.text()).slice(0, 300000);
    const m = h.match(/<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]+content=["']([^"']+)["']/i) || h.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:image|twitter:image)["']/i);
    const alt = h.match(/data-old-hires="(https:[^"]+)"/) || h.match(/"hiRes":"(https:[^"]+)"/) || h.match(/"image"\s*:\s*"(https:[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/i);
    const img = (m?.[1] || alt?.[1])?.replace(/&amp;/g, '&');
    return img && /^https:\/\//.test(img) ? img : undefined;
  } catch { return; }
}

const clean = (t: string) => t.replace(/【[^】]*】/g, '').replace(/<https?:\/\/[^>]+>/g, '').replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '$1').replace(/https?:\/\/\S+/g, '').replace(/\u202f/g, ' ').replace(/ [\u2013\u2014-] /g, ', ').replace(/[\u2013\u2014]/g, ', ').replace(/\n{3,}/g, '\n\n').trim();

async function groqWeb(query: string, kind: 'web' | 'product', now: string): Promise<WebOut> {
  // Groq's free tier allows about 8K tokens a minute per model and one search uses about 6K, so share it fairly.
  await limit('web:groq:min', Number(process.env.WEB_GLOBAL_PER_MIN || 3), 60);
  const sys = kind === 'product'
    ? `Today is ${now}. Find real products for the user with the search tool, then open the two or three best product pages so you can read their price. Reply in two to four short plain sentences naming the products and prices you actually read. No tables, no markdown, no links, no citation marks. Never use dashes as punctuation. Prices are for information only; Pocket cannot buy for the user.`
    : `Today is ${now}. Use the search tool for anything about current events, news, sports, weather, prices or facts that may have changed. Reply in two to four short plain sentences with what you found and when it happened. No tables, no markdown, no links, no citation marks. Never use dashes as punctuation.`;
  const r = await fetch(groq!.baseUrl + '/chat/completions', {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${groq!.key}` }, signal: AbortSignal.timeout(45000),
    body: JSON.stringify({ model: SEARCH_MODEL, reasoning_effort: 'low', max_tokens: 1200, tools: [{ type: 'browser_search' }], messages: [{ role: 'system', content: sys }, { role: 'user', content: query.slice(0, 400) }] }),
  });
  if (r.status === 429) throw new Error('search rate limited ' + (r.headers.get('retry-after') || ''));
  if (!r.ok) throw new Error('search ' + r.status + ' ' + (await r.text()).slice(0, 160));
  const j = await r.json();
  const m = j.choices?.[0]?.message || {};
  const usd = ((j.usage?.prompt_tokens || 0) * 0.075 + (j.usage?.completion_tokens || 0) * 0.3) / 1e6;
  console.info(JSON.stringify({ ai: 'groq', model: SEARCH_MODEL, kind: 'search', tin: j.usage?.prompt_tokens || 0, tout: j.usage?.completion_tokens || 0 }));
  const { sources, products } = parseTools(m.executed_tools || []);
  const top = products.slice(0, 4);
  if (kind === 'product') await Promise.all(top.map(async (p) => { p.image = await ogImage(p.url); }));
  return { reply: clean(String(m.content || '')) || 'I searched but could not find a clear answer.', sources: sources.slice(0, 4), products: kind === 'product' ? top : [], usd, private: false, provider: 'Groq' };
}

// A URL the model wrote is kept only if the page exists. Big stores often block servers (403, 429, 503),
// which still proves the page is there; 404, 410 and network failures drop it.
async function exists(url: string) {
  if (!okUrl(url)) return false;
  try {
    const r = await fetch(url, { method: 'GET', headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36', accept: 'text/html' }, signal: AbortSignal.timeout(4500), redirect: 'follow' });
    r.body?.cancel().catch(() => {});
    return r.ok || [401, 403, 429, 503].includes(r.status);
  } catch { return false; }
}

// Pure: split the model's text into the answer and its SOURCES / PRODUCTS lines. Exported for tests.
export function parseNear(text: string) {
  const t = String(text || '');
  const i = t.search(/^\s*\**SOURCES:?\**\s*$/im); const j = t.search(/^\s*\**PRODUCTS:?\**\s*$/im);
  const cut = [i, j].filter((x) => x >= 0); const body = cut.length ? t.slice(0, Math.min(...cut)) : t;
  const block = (start: number) => (start < 0 ? [] : t.slice(start).split('\n').slice(1).map((l) => l.replace(/^[-*\d.\s]+/, '').trim()).filter((l) => l.includes('|') && /https:\/\//.test(l)));
  const urlOf = (l: string) => (l.match(/https:\/\/[^\s|)\]]+/)?.[0] || '').replace(/[.,]+$/, '');
  const srcLines = block(i).filter((l) => j < 0 || i > j || t.indexOf(l) < j);
  const sources = srcLines.map((l) => ({ title: l.split('|')[0].replace(/\*\*/g, '').trim().slice(0, 140), url: urlOf(l) })).filter((s) => s.url);
  const products = block(j).map((l) => { const p = l.split('|').map((x) => x.replace(/\*\*/g, '').trim()); const url = urlOf(l); return { title: p[0].slice(0, 140), price: p[1] && /\d/.test(p[1]) ? p[1].slice(0, 30) : undefined, store: p[2] && !/^https?:/.test(p[2]) ? p[2].slice(0, 40) : host(url), url }; }).filter((p) => p.url);
  const seen = new Set<string>();
  return { body: body.replace(/\*\*/g, '').trim(), sources: sources.filter((s) => !seen.has(s.url) && seen.add(s.url)), products };
}

// NEAR AI's search sometimes returns no results, and the model then says it cannot look things up.
const UNABLE = /(unable|not able|cannot|can't|could not|couldn't) (to )?(access|retrieve|find|fetch|get|look up)|no (search )?results|technical (limitation|issue)/i;

async function nearaiWeb(query: string, kind: 'web' | 'product', now: string): Promise<WebOut> {
  const p = nearai!;
  const instructions = `Today is ${now}. Use web_search for this. After searching, always write your final answer: two to four short plain sentences with what you found and when it happened. No tables, no markdown, no links or citation marks in the sentences. Never use dashes as punctuation. Then on a new line write SOURCES: and up to 4 lines, each "title | url", using exact URLs from the search results.${kind === 'product' ? ' Then on a new line write PRODUCTS: and up to 4 lines, each "name | price | store | url", using exact product page URLs from the search results.' : ''}`;
  const r = await fetch(p.baseUrl.replace(/\/$/, '') + '/responses', {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${p.key}` }, signal: AbortSignal.timeout(45000),
    body: JSON.stringify({ model: p.chat, store: false, reasoning: { effort: 'low' }, max_output_tokens: 1500, max_tool_calls: 3, instructions, input: query.slice(0, 400), tools: [{ type: 'web_search', count: 5 }] }),
  });
  if (!r.ok) { rest(p.id + 'chat', r); throw new Error('nearai search ' + r.status); }
  const j = await r.json();
  const out: { type: string; content?: { text?: string; annotations?: { type?: string; url?: string; title?: string }[] }[]; action?: { sources?: { url?: string; title?: string }[] } }[] = j.output || [];
  const searches = out.filter((o) => o.type === 'web_search_call').length;
  const text = out.filter((o) => o.type === 'message').map((o) => (o.content || []).map((c) => c.text || '').join('')).join('\n').trim();
  const tin = j.usage?.input_tokens || 0, tout = j.usage?.output_tokens || 0;
  // Brave search is billed per request (about $0.005, from https://cloud-api.near.ai/v1/services).
  const usd = (tin * p.inUsd + tout * p.outUsd) / 1e6 + searches * Number(process.env.NEARAI_SEARCH_USD || 0.005);
  await record(p, p.chat + ' web_search', usd, tin, tout);
  const parsed = parseNear(text);
  // Use the API's own citations too when it sends them (url_citation annotations, or the sources on a search
  // call), so links come from the search, not only from the SOURCES lines the model writes.
  const cited = [
    ...out.flatMap((o) => (o.content || []).flatMap((c) => (c.annotations || []).filter((a) => a.type === 'url_citation' && a.url).map((a) => ({ title: String(a.title || host(a.url!)).slice(0, 140), url: String(a.url) })))),
    ...out.flatMap((o) => (o.action?.sources || []).filter((x) => x.url).map((x) => ({ title: String(x.title || host(x.url!)).slice(0, 140), url: String(x.url) }))),
  ];
  for (const c of cited) if (!parsed.sources.some((x) => x.url === c.url)) parsed.sources.push(c);
  // The model sometimes ends right after searching with an empty message; the caller retries once.
  if (!clean(parsed.body)) throw new Error('nearai search gave an empty answer');
  if (searches && !parsed.sources.length && UNABLE.test(parsed.body)) throw new Error('nearai search found nothing');
  const [okS, okP] = await Promise.all([Promise.all(parsed.sources.slice(0, 4).map((s) => exists(s.url))), Promise.all(parsed.products.slice(0, 4).map((x) => exists(x.url)))]);
  const sources = parsed.sources.slice(0, 4).filter((_, k) => okS[k]);
  const top: Product[] = parsed.products.slice(0, 4).filter((_, k) => okP[k]);
  if (kind === 'product') await Promise.all(top.map(async (x) => { x.image = await ogImage(x.url); }));
  return { reply: clean(parsed.body).replace(/\s+([.,;:])/g, '$1').replace(/(\.\s*){2,}/g, '. ').trim() || 'I searched but could not find a clear answer.', sources, products: kind === 'product' ? top : [], usd, private: true, provider: 'NEAR AI Cloud' };
}

// NEAR AI first (private). An answer is only used with at least one checked link (a source, or a product for
// product searches); otherwise that one request goes to Groq search, which returns real result URLs.
export async function webAnswer(query: string, kind: 'web' | 'product', now: string): Promise<WebOut> {
  let near: WebOut | null = null;
  if (nearai && isUp(nearai) && (await underCap(nearai))) {
    for (let tries = 0; tries < 2; tries++) {
      try { near = await nearaiWeb(query, kind, now); break; }
      catch (e) { const msg = e instanceof Error ? e.message : 'error'; console.warn(JSON.stringify({ ai: 'nearai', kind: 'search', fallback: tries === 1 || !/empty/.test(msg), error: msg.slice(0, 120) })); if (!/empty/.test(msg) || !isUp(nearai) || !(await underCap(nearai))) break; }
    }
  }
  const linked = (w: WebOut) => (kind === 'product' ? w.products.length > 0 : w.sources.length > 0);
  if (near && linked(near)) return near;
  if (near) console.warn(JSON.stringify({ ai: 'nearai', kind: 'search', fallback: true, error: 'no checked source links' }));
  if (!groq) { if (near) return near; throw new Error('no web search provider is available'); }
  try { return await groqWeb(query, kind, now); }
  catch (e) { if (near) return near; throw e; }
}
