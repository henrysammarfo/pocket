// Chat answers stock prices from Pocket's own feeds and knows today's real date.
import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const complete = vi.fn();
vi.mock('@/lib/server/llm', () => ({ anyUp: () => true, complete: (b: unknown) => complete(b) }));
vi.mock('@/lib/server/web', () => ({ webUp: () => false, webAnswer: vi.fn() }));
vi.mock('@/lib/server/store', () => ({ limit: async () => {} }));
vi.mock('@/lib/server/prices', () => ({ tokenPrices: vi.fn(), sharePrices: vi.fn() }));
import { priceAsk, dateAsk, priceReply, dateReply, dateFacts } from '@/lib/shared/facts';
import { chat, SYSTEM, type Live } from '@/lib/server/brain';

const live: Live = {
  tokens: { TSLAon: { price: 251.37, change24h: 1, updatedAt: Date.now() }, NEAR: { price: 3.21, change24h: 0, updatedAt: Date.now() } },
  shares: { TSLA: { price: 250.12, change: 1, changePct: 0.4, lastTrade: 'Nov 14, 2026 4:00 PM ET', marketStatus: 'Closed', source: 'Nasdaq.com', spark: [], prevClose: 249, fetchedAt: Date.now() } },
};
const ctx = { dollars: 100, pusd: 100, usdc: 0, near: 0.05, holdings: {}, keep: 0, limit: 200, usedToday: 0, prices: {}, tz: 'Africa/Accra' };
const NOW = new Date('2026-11-15T04:54:00Z');

describe('stock price questions', () => {
  it.each([
    ['what is the price of tesla', 'TSLA'], ['How much is Tesla stock?', 'TSLA'], ['tesla price', 'TSLA'], ["what's TSLA trading at", 'TSLA'],
    ['how much does apple cost now', 'AAPL'], ['price of the s&p 500', 'SPY'], ['nvidia share price today', 'NVDA'],
  ])('%s is a price question for %s', (q, t) => expect(priceAsk(q)).toBe(t));
  it.each(['buy $20 of tesla', 'send mum 20 dollars', 'hello', 'compare the price of tesla and apple'])('%s is not a single price question', (q) => expect(priceAsk(q)).toBeNull());
  it('answers with the share price and the token price, never a refusal', () => {
    const r = priceReply('TSLA', live.shares.TSLA, live.tokens.TSLAon)!;
    expect(r).toContain('$250.12');
    expect(r).toContain('$251.37');
    expect(r).toContain('Nasdaq.com');
    expect(r).not.toMatch(/can(no|')t|unable|sorry/i);
  });
  it('says so plainly when there is no live price, and never invents one', () => expect(priceReply('TSLA', null, null)).toBeNull());
  it('chat answers Tesla from live data without asking the model', async () => {
    complete.mockReset();
    const out = await chat({ messages: [{ role: 'user', content: 'What is the price of Tesla?' }], ctx, live, now: NOW });
    expect(complete).not.toHaveBeenCalled();
    expect(out.reply).toContain('$250.12');
  });
  it('chat with no live price says it could not get one instead of guessing', async () => {
    const out = await chat({ messages: [{ role: 'user', content: 'tesla price' }], ctx, live: { tokens: {}, shares: {} }, now: NOW });
    expect(out.reply).toMatch(/could not get a live Tesla price/);
    expect(out.reply).not.toMatch(/\$\d/);
  });
});

describe('today\'s date', () => {
  it.each(['what is the date', "what's today's date", 'what day is it', 'what year is it', 'what time is it now'])('%s is a date question', (q) => expect(dateAsk(q)).toBe(true));
  it('answers in the user time zone', () => {
    expect(dateReply(NOW, 'Africa/Accra')).toBe('It is Sunday, 15 November 2026 at 4:54 am (Africa/Accra).');
    expect(dateReply(NOW, 'Asia/Tokyo')).toMatch(/Sunday, 15 November 2026 at 1:54 pm/);
  });
  it('a bad time zone falls back to UTC', () => expect(dateFacts(NOW, 'not a zone!').zone).toBe('UTC'));
  it('chat answers the date directly', async () => {
    complete.mockReset();
    const out = await chat({ messages: [{ role: 'user', content: 'what is the date today' }], ctx, now: NOW });
    expect(complete).not.toHaveBeenCalled();
    expect(out.reply).toContain('15 November 2026');
  });
  it('the system prompt carries the real date, the UTC time, a no guessing rule and live prices', () => {
    const p = SYSTEM(ctx, [], false, live, NOW);
    expect(p).toContain('Sunday, 15 November 2026');
    expect(p).toContain('2026-11-15 04:54 UTC');
    expect(p).toMatch(/never say any other date is today/);
    expect(p).toMatch(/Do not state deadlines/);
    expect(p).toContain('TSLA 251.37');
    expect(p).toContain('Tesla 250.12');
    expect(p).toMatch(/Never refuse/);
  });
  it('the model gets that prompt on other questions', async () => {
    complete.mockReset();
    complete.mockResolvedValue({ j: { choices: [{ message: { content: 'The deadline you told me is Friday.' } }] }, prov: { label: 'x', private: false }, model: 'm', usd: 0 });
    await chat({ messages: [{ role: 'user', content: 'how many days until my exam' }], ctx, live, now: NOW });
    const sys = complete.mock.calls[0][0].messages[0].content as string;
    expect(sys).toContain('Sunday, 15 November 2026');
  });
});

import { requestAsk } from '@/lib/shared/facts';
describe('request link from chat', () => {
  it.each([
    ['Make a request link for $15 from my brother for rent', '15', 'rent'],
    ['request money: $12.50 for lunch', '12.50', 'lunch'],
    ['Make me a request for 40 dollars for school fees', '40', 'school fees'],
    ['payment link $8', '8', ''],
  ])('%s', (t, amount, note) => expect(requestAsk(t)).toEqual({ amount, note }));
  it.each(['send $15 to mum', 'what is a request?', 'request link please', 'Buy $20 of Tesla'])('not a request with an amount: %s', (t) => expect(requestAsk(t)).toBeNull());
});
