# Wallet v2 live testnet checks

Run 15 Nov 2026, about 06:50 Accra time (UTC+0), with `npm run test:v2live` on the demo account
`vtwomwhgwkx5.pocket-7e2413.testnet`. The account runs the v2 wallet code directly (same wasm as
`vendor/pocket_wallet.wasm`, sha256 `7e3ecd0d…a856`), because deploying v2 as a global contract for
every new signup needs about 22 testnet NEAR and the NEAR faucet has answered 429 all morning.

The account was created, the code deployed and initialised in one transaction, with only a phone key:
it has never had a full access key. That also means nobody, including Pocket, can redeploy or delete it.

```
ok   create, deploy v2 code and initialise vtwomwhgwkx5.pocket-7e2413.testnet in one transaction https://testnet.nearblocks.io/txns/FbLM9mExFpx3G2gDPA7gxMa3Q2EfkAH4G9R2NZzv3d9T
ok   no full access key on the account: 1 key, the phone's function call key
ok*  the recovery key is not an access key at all; the contract lists it as an owner key
ok   get_config shows the recovery key as the owner key
ok   recovery key signs a stricter rule, Pocket relays it, applied at once ($50 a send) https://testnet.nearblocks.io/txns/GLENhnUkR3hLJTkKZqE5jm5BYujVUnBoLkXSwiPXFWZd
ok   the same signed owner message sent again is refused: Old or out of order owner message
ok   replayed straight to the chain with the phone key (Pocket skipped), the contract refuses it https://testnet.nearblocks.io/txns/46nW1rBLUwkKSeMjXexvUqP1hUmVHH69pstZgXG4GCJW
ok   a raise signed by a key that is not an owner key is refused on chain https://testnet.nearblocks.io/txns/8JNKFRpTWgYoiLofZEjtuNGPFBqGkSszQc48gngaHJU2
ok   the phone key cannot pass off its own signature as the recovery key's https://testnet.nearblocks.io/txns/J9XM3dzuiyMPfqWgnhGMkWjLgqDrvzGZjuGLTfQMstpt
ok   a raise signed by the recovery key waits for the 24 hour delay instead of applying https://testnet.nearblocks.io/txns/AyNLX6NUSRLVXdYc32enrV8KudU4hisNjz46NQ33sf7n
ok   the phone key cancels the pending raise during the wait https://testnet.nearblocks.io/txns/7tK5NumiUc5GnMbBzU4j48LVJLJtYb4V9aNnMkQAEbr5
ok   a NEAR send with no signed price is refused https://testnet.nearblocks.io/txns/2hfKLdFVrzRznjZKCkW5WazYhvEpXwqZ29Mkh1E7BqYJ
ok   a price of $0.000001 signed by someone else is refused https://testnet.nearblocks.io/txns/GwmjbsXBhswwpNtLPdTFW67V2NnqEcPd85BKssDDQ4ue
ok   an expired price, even one Pocket signed, is refused https://testnet.nearblocks.io/txns/4e4vvrqY7N7axELnxrwi8AX6CrAtz3ZdF5MgpTAY4HxM
ok   0.01 NEAR at the signed price $3.14 goes through and counts $0.0314 against the dollar day https://testnet.nearblocks.io/txns/4QFtxj4NUsYFcoy6wV5KN74ym8BhQaPfM6DdRPK75Er3
ok   after the owner lowers the dollar cap to $0.01 a send, the same 0.01 NEAR send is refused in dollars https://testnet.nearblocks.io/txns/Hqj3UNiGpKmZ7CdgwB2oqFcAGwq2RfhoBXgutZ61Yywu
ok   the recovery key adds a new phone key, limited to the device methods https://testnet.nearblocks.io/txns/9MkRdMQVXCQjJatA5QjkLUKQCRnchXZrXW95rEUA6Zi9
ok*  the recovery key removes the lost phone key at once https://testnet.nearblocks.io/txns/C98NEPT6WfAzsqzueZiQvxetrYph4XeR72ed7KMdap7m
```

`ok*`: the script printed FAIL for these two because of a bug in Pocket's own `viewAccessKey` helper (some RPC
nodes answer a missing key with an error inside the result, which the helper treated as a key). The chain was
right: the access key list shows the recovery key was never a key, and after `remove_key` the account holds
only the new phone key (the `owner_action` transaction above succeeded). The helper is fixed in this commit, and
that fix also closes a real app bug: Restore would have taken a v2 recovery key for a phone key.

The run stopped at that point (the same helper bug), so four checks did not run live: the removed phone key
can no longer send, adding a guardian owner key waits for the delay, the phone can cancel that change, and a send
to the drainer on the shared block list is refused. All four are covered by the Rust unit tests in
`contracts/wallet/src/tests.rs`, and the drainer refusal ran live on v1 in section 11 of `npm run test:onchain`.
A rerun needs about 2.4 testnet NEAR for another demo account.
