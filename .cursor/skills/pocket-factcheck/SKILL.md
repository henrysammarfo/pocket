---
name: pocket-factcheck
description: Fact-check POCKET claims via memory, official docs, Tavily, and TinyFish. Use before integrations or architecture claims.
---

# POCKET Fact-check

1. Read `memory/FACT_CHECK.md` and `memory/CURRENT_STATE.md`.
2. Fetch official docs (prefer `llms.txt` indexes).
3. Tavily: `POST https://api.tavily.com/search` with `TAVILY_API_KEY`.
4. TinyFish: `X-API-Key: $TINYFISH_API_KEY` against `https://agent.tinyfish.ai` (Fetch/Search/Agent per docs.tinyfish.ai).
5. Record claim → source → verdict in `memory/FACT_CHECK.md`.
6. Never store secret values in memory files.
