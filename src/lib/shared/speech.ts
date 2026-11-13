// Tidy messy speech before the rules parser reads it: fillers, stutters, repeated words,
// spoken numbers, and common Ghanaian English and Pidgin phrasing. The AI gets the raw text too.
const FILLERS = /\b(u+m+|u+h+|e+r+m*|a+h+|hmm+|mm+|eh+|ei+|chale|charley|abeg|please|pls|herh|you know|i mean|like|so|okay so|ok so|basically|actually|right|kind of|sort of|ehm|erm)\b[,.]?/gi;
const ONES: Record<string, number> = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 };
const TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fourty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };

function words2num(s: string) {
  return s.replace(/\b((?:(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fourty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|and|a)[\s-]*)+)\b/gi, (m) => {
    const toks = m.toLowerCase().split(/[\s-]+/).filter((t) => t && t !== 'and');
    if (!toks.some((t) => t in ONES || t in TENS || t === 'hundred' || t === 'thousand') || (toks.length === 1 && toks[0] === 'a')) return m;
    let total = 0, cur = 0, any = false;
    for (const t of toks) {
      if (t === 'a') { cur = cur || 1; continue; }
      if (t in ONES) { cur += ONES[t]; any = true; } else if (t in TENS) { cur += TENS[t]; any = true; }
      else if (t === 'hundred') { cur = (cur || 1) * 100; any = true; } else if (t === 'thousand') { total += (cur || 1) * 1000; cur = 0; any = true; }
    }
    return any ? ' ' + String(total + cur) + ' ' : m;
  });
}
export function cleanSpeech(raw: string) {
  let s = ' ' + raw.replace(/\s+/g, ' ') + ' ';
  s = s.replace(/[“”"]/g, '');
  s = s.replace(FILLERS, ' ');
  s = s.replace(/\b(\w+)(?:[\s,.]+\1\b)+/gi, '$1');           // "my my my" -> "my"
  s = s.replace(/\b(\w)-\1(\w+)/gi, '$1$2');                   // "s-send" -> "send"
  s = words2num(s);
  s = s.replace(/\b(make you|make i|i wan|i want to|i wanna|i would like to|can you|could you|help me)\s+/gi, '');
  s = s.replace(/\b(mama|mommy|mom|mother|ma)\b/gi, 'mum').replace(/\b(dada|daddy|papa|father)\b/gi, 'dad');
  s = s.replace(/\b(dollars?|bucks|usd|cedis?|ghana cedis)\b/gi, 'dollars');
  s = s.replace(/\$\s+(\d)/g, '$$$1').replace(/(\d)\s+(\.\d)/g, '$1$2');
  s = s.replace(/\bput\s+(?:am|it)\s+(?:for|in)\b/gi, 'put in').replace(/\b(for|inside)\s+(tesla|apple|nvidia)\b/gi, 'in $2');
  return s.replace(/\s+([,.?!])/g, '$1').replace(/\s+/g, ' ').trim();
}
