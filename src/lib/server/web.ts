import 'server-only';
// Live web answers and product finds. Uses the provider's own web search tool (Groq browser_search
// on gpt-oss), so no extra key is needed. Only links that came back from the real search are shown;
// links the model writes itself are dropped, because models invent product URLs.
import { AI } from './env';

export type Source = { title: string; url: string };
export type Product = { title: string; url: string; store: string; price?: string; rating?: string; image?: string };
export type WebOut = { reply: string; sources: Source[]; products: Product[]; usd: number };

// A separate model for search keeps chat inside its own free tier token budget.
export const SEARCH_MODEL = process.env.SEARCH_MODEL || 'openai/gpt-oss-20b';
export const webUp = () => AI.provider === 'groq' && !!AI.apiKey && /gpt-oss/.test(AI.model) && process.env.WEB_SEARCH !== 'off';
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

export async function webAnswer(query: string, kind: 'web' | 'product', now: string): Promise<WebOut> {
  const sys = kind === 'product'
    ? `Today is ${now}. Find real products for the user with the search tool, then open the two or three best product pages so you can read their price. Reply in two to four short plain sentences naming the products and prices you actually read. No tables, no markdown, no links, no citation marks. Never use dashes as punctuation. Prices are for information only; Pocket cannot buy for the user.`
    : `Today is ${now}. Use the search tool for anything about current events, news, sports, weather, prices or facts that may have changed. Reply in two to four short plain sentences with what you found and when it happened. No tables, no markdown, no links, no citation marks. Never use dashes as punctuation.`;
  const r = await fetch(AI.baseUrl.replace(/\/$/, '') + '/chat/completions', {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${AI.apiKey}` }, signal: AbortSignal.timeout(45000),
    body: JSON.stringify({ model: SEARCH_MODEL, reasoning_effort: 'low', max_tokens: 1200, tools: [{ type: 'browser_search' }], messages: [{ role: 'system', content: sys }, { role: 'user', content: query.slice(0, 400) }] }),
  });
  if (r.status === 429) throw new Error('search rate limited ' + (r.headers.get('retry-after') || ''));
  if (!r.ok) throw new Error('search ' + r.status + ' ' + (await r.text()).slice(0, 160));
  const j = await r.json();
  const m = j.choices?.[0]?.message || {};
  const usd = ((j.usage?.prompt_tokens || 0) * AI.inUsd + (j.usage?.completion_tokens || 0) * AI.outUsd) / 1e6;
  const { sources, products } = parseTools(m.executed_tools || []);
  const top = products.slice(0, 4);
  if (kind === 'product') await Promise.all(top.map(async (p) => { p.image = await ogImage(p.url); }));
  return { reply: clean(String(m.content || '')) || 'I searched but could not find a clear answer.', sources: sources.slice(0, 4), products: kind === 'product' ? top : [], usd };
}
