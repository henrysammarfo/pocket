//! Pocket token: a plain NEP-141 fungible token with a fixed supply.
//!
//! The whole supply is minted once, in `new`, to `owner_id`. There is no mint
//! function, no owner powers after init and no upgrade method, so nobody can
//! create more tokens later. Used for pUSD (Pocket test dollar) and the paper
//! stock tokens (TSLAon and friends) on NEAR testnet. These tokens have no value.
//!
//! Based on the official near-contract-standards FungibleToken example.
use near_contract_standards::fungible_token::events::FtMint;
use near_contract_standards::fungible_token::metadata::{
    FungibleTokenMetadata, FungibleTokenMetadataProvider, FT_METADATA_SPEC,
};
use near_contract_standards::fungible_token::{
    FungibleToken, FungibleTokenCore, FungibleTokenResolver,
};
use near_contract_standards::storage_management::{
    StorageBalance, StorageBalanceBounds, StorageManagement,
};
use near_sdk::borsh::BorshSerialize;
use near_sdk::collections::LazyOption;
use near_sdk::json_types::U128;
use near_sdk::{
    env, log, near, require, AccountId, BorshStorageKey, NearToken, PanicOnDefault, PromiseOrValue,
};

#[derive(PanicOnDefault)]
#[near(contract_state)]
pub struct Contract {
    token: FungibleToken,
    metadata: LazyOption<FungibleTokenMetadata>,
}

#[derive(BorshSerialize, BorshStorageKey)]
#[borsh(crate = "near_sdk::borsh")]
enum StorageKey {
    FungibleToken,
    Metadata,
}

#[near]
impl Contract {
    /// One time init. Mints `total_supply` to `owner_id` and never again.
    #[init]
    pub fn new(owner_id: AccountId, total_supply: U128, metadata: FungibleTokenMetadata) -> Self {
        require!(!env::state_exists(), "Already initialized");
        metadata.assert_valid();
        require!(metadata.spec == FT_METADATA_SPEC, "Wrong metadata spec");
        let mut this = Self {
            token: FungibleToken::new(StorageKey::FungibleToken),
            metadata: LazyOption::new(StorageKey::Metadata, Some(&metadata)),
        };
        this.token.internal_register_account(&owner_id);
        this.token.internal_deposit(&owner_id, total_supply.into());
        FtMint {
            owner_id: &owner_id,
            amount: total_supply,
            memo: Some("fixed supply minted at init"),
        }
        .emit();
        this
    }
}

#[near]
impl FungibleTokenCore for Contract {
    #[payable]
    fn ft_transfer(&mut self, receiver_id: AccountId, amount: U128, memo: Option<String>) {
        self.token.ft_transfer(receiver_id, amount, memo)
    }

    #[payable]
    fn ft_transfer_call(
        &mut self,
        receiver_id: AccountId,
        amount: U128,
        memo: Option<String>,
        msg: String,
    ) -> PromiseOrValue<U128> {
        self.token.ft_transfer_call(receiver_id, amount, memo, msg)
    }

    fn ft_total_supply(&self) -> U128 {
        self.token.ft_total_supply()
    }

    fn ft_balance_of(&self, account_id: AccountId) -> U128 {
        self.token.ft_balance_of(account_id)
    }
}

#[near]
impl FungibleTokenResolver for Contract {
    #[private]
    fn ft_resolve_transfer(
        &mut self,
        sender_id: AccountId,
        receiver_id: AccountId,
        amount: U128,
    ) -> U128 {
        let (used_amount, burned_amount) =
            self.token
                .internal_ft_resolve_transfer(&sender_id, receiver_id, amount);
        if burned_amount > 0 {
            log!("Account @{} burned {}", sender_id, burned_amount);
        }
        used_amount.into()
    }
}

#[near]
impl StorageManagement for Contract {
    #[payable]
    fn storage_deposit(
        &mut self,
        account_id: Option<AccountId>,
        registration_only: Option<bool>,
    ) -> StorageBalance {
        self.token.storage_deposit(account_id, registration_only)
    }

    #[payable]
    fn storage_withdraw(&mut self, amount: Option<NearToken>) -> StorageBalance {
        self.token.storage_withdraw(amount)
    }

    #[payable]
    fn storage_unregister(&mut self, force: Option<bool>) -> bool {
        // Never allow force unregister, so no balance can be burned by accident.
        require!(force != Some(true), "Force unregister is disabled");
        self.token.internal_storage_unregister(force).is_some()
    }

    fn storage_balance_bounds(&self) -> StorageBalanceBounds {
        self.token.storage_balance_bounds()
    }

    fn storage_balance_of(&self, account_id: AccountId) -> Option<StorageBalance> {
        self.token.storage_balance_of(account_id)
    }
}

#[near]
impl FungibleTokenMetadataProvider for Contract {
    fn ft_metadata(&self) -> FungibleTokenMetadata {
        self.metadata.get().unwrap()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::{accounts, VMContextBuilder};
    use near_sdk::testing_env;

    fn meta() -> FungibleTokenMetadata {
        FungibleTokenMetadata {
            spec: FT_METADATA_SPEC.to_string(),
            name: "Pocket test dollar".to_string(),
            symbol: "pUSD".to_string(),
            icon: None,
            reference: None,
            reference_hash: None,
            decimals: 6,
        }
    }

    #[test]
    fn fixed_supply_goes_to_owner() {
        let mut ctx = VMContextBuilder::new();
        testing_env!(ctx.predecessor_account_id(accounts(0)).build());
        let c = Contract::new(accounts(1), U128(1_000_000), meta());
        assert_eq!(c.ft_total_supply().0, 1_000_000);
        assert_eq!(c.ft_balance_of(accounts(1)).0, 1_000_000);
        assert_eq!(c.ft_balance_of(accounts(2)).0, 0);
    }

    #[test]
    fn transfer_moves_balance() {
        let mut ctx = VMContextBuilder::new();
        testing_env!(ctx.predecessor_account_id(accounts(1)).build());
        let mut c = Contract::new(accounts(1), U128(1_000), meta());
        testing_env!(ctx
            .attached_deposit(c.storage_balance_bounds().min)
            .predecessor_account_id(accounts(2))
            .build());
        c.storage_deposit(None, None);
        testing_env!(ctx
            .attached_deposit(NearToken::from_yoctonear(1))
            .predecessor_account_id(accounts(1))
            .build());
        c.ft_transfer(accounts(2), U128(250), None);
        assert_eq!(c.ft_balance_of(accounts(1)).0, 750);
        assert_eq!(c.ft_balance_of(accounts(2)).0, 250);
        assert_eq!(c.ft_total_supply().0, 1_000);
    }
}
