# Design references, Pocket on Otari

Every surface on the Otari branch traces to a named source. Sites are from Henry's list (/workspace/playbooks/design-sites.md and the design-reference-sites skill). Rules come from the hack-team-standards and design-taste-guide skills, Hallmark Floor and Emil Kowalski's skills.

| Surface | Component / file | Reference | What was taken |
|---|---|---|---|
| Token base, DESIGN.md | `DESIGN.md`, `src/styles/otari-ui.css` `:root` | getdesign.md "Wise" analysis (`npx getdesign add wise`), styles.refero.design format | sage canvas, white rounded cards, one dark green action colour, full warning and danger families with separate ink and background; mapped onto Pocket's own Beebah values from `src/styles.css` |
| 1. AI receipt strip (signature) | `AiReceiptStrip.tsx` `.pk-receipt*` | 60fps.design #2112 "Run Receipt Signature Interaction"; Pocket's own `.receipt-card` payment receipt | the AI answer gets a receipt like a payment: dashed rule, chip line, unfold into a slip |
| Receipt slip unfold | `.pk-receipt-details` | 60fps.design #2121 "CRED Printing Tickets Shuffle Interaction"; Emil Kowalski `animate` (200 ms, scale .95, ease-out, origin top left) | torn top edge, dotted leaders, monospaced figures, unfold from the strip |
| Served by backup state | `.pk-receipt.is-backup`, `.pk-receipt-flag` | Wise analysis warning family; Otari headers `Otari-Fallback`, `Otari-Attempt-Count` (Plan A, A5) | amber rule plus "attempt N" flag, no alarm red |
| 2. Lighter model note | receipt chip with feather icon | Plan A A8 "one-line note, no alarm colour" | neutral outlined chip |
| 3. Allowance used up, assistant resting | `AiNotice.tsx` `.pk-notice.is-info/.is-warn` | ui.watermelon.sh dashboard alert blocks; Wise analysis semantic surfaces | icon tile, title plus one plain sentence, money-still-works copy, calm tone |
| 4. Message stopped, safety check offline | `.pk-notice.is-danger/.is-warn` | same; Plan A A8 copy | danger only for the stopped message |
| 5. All models failed with retry | `.pk-notice-btn` | shadcn/ui button states; Emil Kowalski press 120 ms scale .97 | 44 px pill retry |
| 6. Review: which model read it | `.pk-chip` in "How Pocket read your last payment message" | Pocket's existing chip row; 60fps.design "Plasma Duo Style Bottom Sheet" (#2126) for the sheet motion spec in DESIGN.md | quiet ringed chip, 8 px radius |
| 7. Computed in sandbox badge | receipt chip `data-kind="code"` | Plan A A6 code execution row | forest outline badge, label "Computed in sandbox" |
| 8. ECB currency answer | receipt chip "Read www.ecb.europa.eu" plus slip row "European Central Bank daily reference rates (ecb.europa.eu)" | Plan A A6 web fetch row; ECB eurofxref-daily.xml | source cited in the strip and the slip |
| 9. Allowance meter | `AllowanceCard.tsx` `.pk-allow*`, `.pk-meter` | ui.watermelon.sh dashboard usage meters; Revolut plan meter (60fps.design #2119 "Revolut Select Plan") | mono percentage, flat 10 px track, real 80 percent tick from `allowance.ts` |
| 9. Resilience drill | `DrillCard.tsx` `.pk-drill*`, `.pk-tag` | Plan A A6 routing row; shadcn/ui card | Test tag, one primary action, result with its own receipt |
| AI activity list | `AiActivityList.tsx` `.pk-ai-*` | ui.watermelon.sh dashboard list rows | 60 px rows, mono timestamps |
| Live tool chips | `LiveToolChips` `.pk-live-tools` | 60fps.design "Loading" pattern, Emil Kowalski (no animation on high-frequency actions) | breathing icon only, text stays still |
| Fonts | `public/fonts/ui-fonts.css` | hack-team-standards LG legal check (self host fonts) | Manrope and Plus Jakarta Sans now self hosted, Google Fonts link removed |

MotionSites and dvklab heroes: not used on this branch. There is no landing page or hero work in Plan A (A7 says so), and MotionSites media must not enter this repo.
