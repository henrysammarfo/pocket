#!/usr/bin/env python3
"""Push Pocket's server env to Vercel by NAME (values from .env.local, never printed), for production and preview.
Usage: VERCEL_TOKEN=... python3 scripts/vercel-env.py [--team teamtitanlink] [--project pocket]"""
import json, os, sys, urllib.request, urllib.parse
args = sys.argv[1:]; team = args[args.index('--team') + 1] if '--team' in args else os.environ.get('VERCEL_SCOPE', 'teamtitanlink')
project = args[args.index('--project') + 1] if '--project' in args else os.environ.get('VERCEL_PROJECT', 'pocket')
tok = os.environ['VERCEL_TOKEN']
NAMES = ['NEXT_PUBLIC_POCKET_ROOT', 'SPONSOR_PRIVATE_KEY', 'RELAYER_PRIVATE_KEY', 'MAKER_PRIVATE_KEY', 'FAUCET_PRIVATE_KEY', 'GROQ_API_KEY', 'NEARAI_API_KEY', 'AI_PROVIDER', 'QUOTE_SECRET']
env = {}
for line in open('.env.local'):
    if '=' in line and not line.startswith('#'):
        k, v = line.rstrip('\n').split('=', 1); env[k.strip()] = v.strip()
def call(method, path, body=None):
    req = urllib.request.Request('https://api.vercel.com' + path, method=method, data=json.dumps(body).encode() if body else None,
                                 headers={'Authorization': 'Bearer ' + tok, 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req) as r: return json.load(r)
teams = call('GET', '/v2/teams?limit=50')['teams']; tid = next(t['id'] for t in teams if t['slug'] == team)
for n in NAMES:
    if not env.get(n): print('skip', n, '(not in .env.local)'); continue
    plain = n.startswith('NEXT_PUBLIC_') or n == 'AI_PROVIDER'
    call('POST', f'/v10/projects/{project}/env?teamId={tid}&upsert=true', {'key': n, 'value': env[n], 'type': 'plain' if plain else 'encrypted', 'target': ['production', 'preview']})
    print('set', n, '(production, preview)')
