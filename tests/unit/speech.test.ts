import { describe, expect, it } from 'vitest';
import { cleanSpeech } from '@/lib/shared/speech';
import { parseCommand } from '@/lib/shared/plan';

// Messy speech the way people really talk: fillers, stutters, repeats, Pidgin and spoken numbers.
const cases: [string, RegExp][] = [
  ['ehm so i i want to like send send @admin uh five dollars please', /send/i],
  ['abeg send @admin 5 dollars', /send/i],
  ['um put put ten dollars in in tesla', /tesla|tsla/i],
];
describe('cleanSpeech', () => {
  for (const [raw, want] of cases) {
    it(`cleans: ${raw}`, () => {
      const c = cleanSpeech(raw);
      expect(c).toMatch(want);
      expect(c).not.toMatch(/\b(ehm|um|uh)\b/i);
      expect(c).not.toMatch(/\b(\w+) \1\b/i);
    });
  }
  it('turns messy speech into a parseable plan', () => {
    const steps = parseCommand(cleanSpeech('ehm so i i want to like send send @admin uh five dollars please'));
    expect(steps?.length).toBe(1);
  });
});
describe('cleanSpeech, from a real Whisper transcript', () => {
  it('reads "E H M ... send send at admin" as a send to @admin', () => {
    const c = cleanSpeech('E H M. So I want to, like, send send at admin or $5, and put 10 in tesla abeg.');
    expect(c).toMatch(/@admin/);
    expect(c).not.toMatch(/\bE H M\b/i);
  });
});
