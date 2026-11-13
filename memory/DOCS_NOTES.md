# NEAR docs notes (checked while building)
* NEP-366 meta transactions: user signs `DelegateAction` (prefix 2^30 + 366, sha256), relayer wraps it in `SignedDelegate`. Delegate nonce must exceed the access key nonce; `max_block_height` bounds validity. Relayer must restrict receivers and methods (we allow list).
* NEP-413 off chain signatures: borsh payload with tag 2^31 + 413, 32 byte nonce, recipient. Verifier v0.4.x rejects nonces starting with the versioned prefix `0x5628f6c6`, so random nonces avoid `0x5628`.
* NEAR Intents verifier (`defuse`): `execute_intents` takes signed payloads; message JSON `{signer_id, deadline, intents}`; `transfer` and `token_diff` intents; deposits are `ft_transfer_call` with `msg` = receiving account; named accounts register keys with `add_public_key` (1 yocto).
* NEP-141 storage: receivers need `storage_deposit` (USDC testnet 0.00125 NEAR) before `ft_transfer`; transfers need 1 yocto.
* Circle USDC on NEAR testnet: `3e2210e1184b45b64c8a434c0a7e7b23cc04ea7eb7a6c3c32520d03d4afcb8af`.
* Eth implicit accounts (`0x` + 40 hex) are valid NEAR accounts; Pocket asks the network for 0x and never guesses.
* Groq docs (console.groq.com/docs): production models gpt-oss-120b, gpt-oss-20b, whisper-large-v3 (+turbo); llama 3.x deprecated Aug 2026. Whisper bills at least 10 s per request, max 25 MB on free tier, verbose_json gives no_speech_prob per segment (used to drop hallucinated words). 429 returns retry-after.
