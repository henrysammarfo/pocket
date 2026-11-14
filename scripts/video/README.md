# Demo video build

`npm run video` (or `bash scripts/video/make.sh`) records the live site and builds `video/pocket-demo.mp4`, 1920x1080 H.264 with AAC, plus `poster.png`, `pocket-demo.srt` and `timeline.json`. No keys are needed. It signs up a fresh testnet account on the site it records.

| File | Does |
| --- | --- |
| `record.mjs` | Phone journey (sign up, wallet, chat, voice note, plan card, hold to approve, receipt, settings) through a Chromium screencast at phone size, then a desktop pass. Writes clips and `events.json` with a timestamp for every step. `ONLY=desktop` redoes only the desktop pass |
| `cards.mjs` | Title, problem, NEAR, tests and end cards with the Pocket logo, captions, the phone bezel and masks |
| `script.json` | Scenes, cut points, zooms and the voiceover lines |
| `build.py` | Voiceover with edge-tts (en-US-AndrewMultilingualNeural), cuts, zooms on the phone, crossfades, captions, loudness, final encode |

Needs Node 20+, Python 3, ffmpeg, `npx playwright install chromium` and `pip install edge-tts`. Set `BASE` to record another deployment. No music is used.
