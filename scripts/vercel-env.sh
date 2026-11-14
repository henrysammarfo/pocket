#!/usr/bin/env bash
# Push Pocket's server env to a Vercel project by NAME, reading values from .env.local, then redeploy.
# Values are piped on stdin, never printed. Needs VERCEL_TOKEN (or a logged in vercel CLI).
# Usage: VERCEL_TOKEN=... VERCEL_SCOPE=teamtitanlink ./scripts/vercel-env.sh [preview|production]
set -euo pipefail
TARGET="${1:-preview}"; SCOPE="${VERCEL_SCOPE:-teamtitanlink}"; PROJECT="${VERCEL_PROJECT:-pocket}"
T=(); [ -n "${VERCEL_TOKEN:-}" ] && T=(--token "$VERCEL_TOKEN")
npx -y vercel link --yes --project "$PROJECT" --scope "$SCOPE" "${T[@]}" >/dev/null
NAMES="NEXT_PUBLIC_POCKET_ROOT SPONSOR_PRIVATE_KEY RELAYER_PRIVATE_KEY MAKER_PRIVATE_KEY FAUCET_PRIVATE_KEY GROQ_API_KEY NEARAI_API_KEY AI_PROVIDER QUOTE_SECRET"
for n in $NAMES; do
  v=$(grep -E "^${n}=" .env.local | head -1 | cut -d= -f2- || true)
  [ -z "$v" ] && { echo "skip $n (not in .env.local)"; continue; }
  npx -y vercel env rm "$n" "$TARGET" --yes --scope "$SCOPE" "${T[@]}" >/dev/null 2>&1 || true
  printf '%s' "$v" | npx -y vercel env add "$n" "$TARGET" --scope "$SCOPE" "${T[@]}" >/dev/null && echo "set $n ($TARGET)"
done
echo "redeploying"; P=(); [ "$TARGET" = production ] && P=(--prod); npx -y vercel deploy "${P[@]}" --yes --scope "$SCOPE" "${T[@]}" | tail -1
