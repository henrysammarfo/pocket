#!/usr/bin/env bash
# Rebuilds the demo video from the live site. Needs Node 20+, Python 3, ffmpeg, Playwright Chromium and edge-tts (pip install edge-tts).
# Usage: BASE=https://your-pocket-url OUT_DIR=video bash scripts/video/make.sh
set -euo pipefail
D="${OUT_DIR:-video}"
OUT="$D/raw" node scripts/video/record.mjs
OUT="$D/cards" node scripts/video/cards.mjs
python3 scripts/video/build.py "$D/raw" "$D/cards" "$D"
echo "Done: $D/pocket-demo.mp4"
