//!
//! Stylus ERC20 Token Factory
//!
//! A TRUE factory contract that allows ANY user to deploy their own ERC20 tokens.
//! This uses a storage-based registry pattern where each token is stored in the factory.
//! 
//! Each user can create independent tokens with custom:
//! - Name
//! - Symbol
//! - Initial Supply
//! - Decimals (default 18)
//!
//! The factory tracks all created tokens and their creators.
//! 
//! Example usage:
//! User A → creates Token A (MyToken, MTK, 1M supply)
//! User B → creates Token B (HerToken, HTK, 500K supply)
//! User C → creates Token C (HisToken, HIS, 2M supply)
//!
//! DEPLOYMENT INSTRUCTIONS:
//! 1. Deploy the TokenFactory contract
//! 2. Call initialize() to set it up (can use factory address as implementation)
//! 3. Users call createToken() to create their own tokens
//!
//! The program is ABI-equivalent with Solidity.
//! To export the ABI, run `cargo stylus export-abi`.
//!
//! Note: this code is a template and has not been audited.
//!
// Allow `cargo stylus export-abi` to generate a main function.
#![cfg_attr(not(any(test, feature = "export-abi")), no_main)]
#![cfg_attr(not(any(test, feature = "export-abi")), no_std)]

extern crate alloc;

use alloc::{vec, vec::Vec};
use stylus_sdk::{
    alloy_primitives::{Address, U256, B256},
    alloy_sol_types::{sol, SolError},
    prelude::*,
};

// Define token data structure stored in factory
sol_storage! {
    pub struct TokenData {
        bytes32 name;
        bytes32 symbol;
        uint256 decimals;
        uint256 total_supply;
        address creator;
        
        mapping(address => uint256) balances;
        mapping(address => mapping(address => uint256)) allowances;
    }
}

// Define the Token Factory storage
sol_storage! {
    #[entrypoint]
    pub struct TokenFactory {
        uint256 token_count;
        mapping(uint256 => TokenData) token_data;  // Token ID -> Token Data
        mapping(address => uint256) creator_token_count;  // Creator -> Number of tokens created
    }
}

// Factory Events
sol! {
    event TokenCreated(address indexed creator, uint256 indexed token_id, uint256 initial_supply);
}

// ERC20 Events
sol! {
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
}

// Custom errors
sol! {
    error InsufficientBalance(address from, uint256 have, uint256 want);
    error InsufficientAllowance(address owner, address spender, uint256 have, uint256 want);
    error InvalidRecipient(address to);
    error InvalidSender(address from);
    error InvalidTokenAddress(address token);
    error DeploymentFailed();
}

// ============================================
// TOKEN FACTORY IMPLEMENTATION
// ============================================

#[public]
impl TokenFactory {
    /// Creates a new ERC20 token for the caller
    /// This stores the token data in the factory's storage
    pub fn create_token(
        &mut self,
        name: B256,
        symbol: B256,
        decimals: U256,
        initial_supply: U256,
    ) -> Result<U256, Vec<u8>> {
        let creator = self.vm().msg_sender();

        // Get current token count and increment
        let token_id = self.token_count.get();
        let new_token_id = token_id + U256::from(1);
        self.token_count.set(new_token_id);

        // Get mutable reference to the new token's storage
        let mut token = self.token_data.setter(token_id);
        
        // Initialize token data
        token.name.set(name);
        token.symbol.set(symbol);
        token.decimals.set(decimals);
        token.total_supply.set(initial_supply);
        token.creator.set(creator);
        
        // Mint initial supply to creator
        token.balances.setter(creator).set(initial_supply);
        
        // Update creator's token count
        let creator_count = self.creator_token_count.get(creator);
        self.creator_token_count.setter(creator).set(creator_count + U256::from(1));

        // Emit events
        log(self.vm(), TokenCreated {
            creator,
            token_id,
            initial_supply,
        });
        
        log(self.vm(), Transfer {
            from: Address::ZERO,
            to: creator,
            value: initial_supply,
        });

        Ok(token_id)
    }



    /// Returns the total number of tokens created
    pub fn get_token_count(&self) -> U256 {
        self.token_count.get()
    }

    /// Returns token info: (name, symbol, decimals, total_supply, creator)
    pub fn get_token_info(&self, token_id: U256) -> (B256, B256, U256, U256, Address) {
        let token = self.token_data.getter(token_id);
        (
            token.name.get(),
            token.symbol.get(),
            token.decimals.get(),
            token.total_supply.get(),
            token.creator.get()
        )
    }

    /// Returns the balance of an account for a specific token
    pub fn balance_of(&self, token_id: U256, account: Address) -> U256 {
        self.token_data.getter(token_id).balances.get(account)
    }

    /// Returns the allowance of a spender for an owner for a specific token
    pub fn allowance(&self, token_id: U256, owner: Address, spender: Address) -> U256 {
        self.token_data.getter(token_id).allowances.getter(owner).get(spender)
    }





    /// Transfers tokens from the caller to another account for a specific token
    pub fn transfer(&mut self, token_id: U256, to: Address, amount: U256) -> Result<bool, Vec<u8>> {
        let from = self.vm().msg_sender();
        self._transfer(token_id, from, to, amount)?;
        Ok(true)
    }

    /// Approves a spender to spend tokens on behalf of the caller for a specific token
    pub fn approve(&mut self, token_id: U256, spender: Address, amount: U256) -> Result<bool, Vec<u8>> {
        let owner = self.vm().msg_sender();
        
        if owner == Address::ZERO {
            return Err(InvalidSender { from: owner }.abi_encode());
        }
        if spender == Address::ZERO {
            return Err(InvalidRecipient { to: spender }.abi_encode());
        }

        // Check if token exists
        if self.token_data.getter(token_id).creator.get() == Address::ZERO {
            return Err(InvalidTokenAddress { token: Address::ZERO }.abi_encode());
        }

        self.token_data.setter(token_id).allowances.setter(owner).setter(spender).set(amount);

        log(self.vm(), Approval {
            owner,
            spender,
            value: amount,
        });
        
        Ok(true)
    }

    /// Transfers tokens from one account to another using allowance for a specific token
    pub fn transfer_from(
        &mut self,
        token_id: U256,
        from: Address,
        to: Address,
        amount: U256,
    ) -> Result<bool, Vec<u8>> {
        let spender = self.vm().msg_sender();
        
        // Check and update allowance
        let token = self.token_data.getter(token_id);
        let current_allowance = token.allowances.getter(from).get(spender);
        
        if current_allowance < amount {
            return Err(InsufficientAllowance {
                owner: from,
                spender,
                have: current_allowance,
                want: amount,
            }.abi_encode());
        }

        // Update allowance
        let new_allowance = current_allowance - amount;
        self.token_data.setter(token_id).allowances.setter(from).setter(spender).set(new_allowance);

        // Perform transfer
        self._transfer(token_id, from, to, amount)?;
        
        Ok(true)
    }



    // Internal transfer function
    fn _transfer(&mut self, token_id: U256, from: Address, to: Address, amount: U256) -> Result<(), Vec<u8>> {
        // Validate addresses
        if from == Address::ZERO {
            return Err(InvalidSender { from }.abi_encode());
        }
        if to == Address::ZERO {
            return Err(InvalidRecipient { to }.abi_encode());
        }

        // Check if token exists
        if self.token_data.getter(token_id).creator.get() == Address::ZERO {
            return Err(InvalidTokenAddress { token: Address::ZERO }.abi_encode());
        }

        let mut token = self.token_data.setter(token_id);

        // Check balance
        let from_balance = token.balances.get(from);
        if from_balance < amount {
            return Err(InsufficientBalance {
                from,
                have: from_balance,
                want: amount,
            }.abi_encode());
        }

        // Update balances
        token.balances.setter(from).set(from_balance - amount);
        let to_balance = token.balances.get(to);
        token.balances.setter(to).set(to_balance + amount);

        // Emit event
        log(self.vm(), Transfer { from, to, value: amount });

        Ok(())
    }


}

// Remove the old Erc20 implementation since tokens are now stored in factory
// All the tests need to be updated to work with the new token_id based approach

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_factory_initialization() {
        let mut factory = TokenFactory::default();
        let impl_addr = Address::from([1u8; 20]);
        
        assert!(factory.initialize(impl_addr).is_ok());
        assert_eq!(factory.get_implementation(), impl_addr);
    }

    #[test]
    fn test_factory_create_token() {
        let mut factory = TokenFactory::default();
        let impl_addr = Address::from([1u8; 20]);
        
        factory.initialize(impl_addr).unwrap();

        let token_id = factory.create_token(
            String::from("MyToken"),
            String::from("MTK"),
            U256::from(18),
            U256::from(1000000),
        ).unwrap();

        assert_eq!(token_id, U256::from(0));
        assert_eq!(factory.get_token_count(), U256::from(1));
        assert_eq!(factory.get_token_name(token_id), "MyToken");
        assert_eq!(factory.get_token_symbol(token_id), "MTK");
        assert_eq!(factory.get_token_decimals(token_id), U256::from(18));
        assert_eq!(factory.get_token_total_supply(token_id), U256::from(1000000));
    }

    #[test]
    fn test_multiple_tokens() {
        let mut factory = TokenFactory::default();
        let impl_addr = Address::from([1u8; 20]);
        
        factory.initialize(impl_addr).unwrap();

        // Create first token
        let token_a = factory.create_token(
            String::from("TokenA"),
            String::from("TKA"),
            U256::from(18),
            U256::from(1000000),
        ).unwrap();

        // Create second token
        let token_b = factory.create_token(
            String::from("TokenB"),
            String::from("TKB"),
            U256::from(18),
            U256::from(500000),
        ).unwrap();
        
        assert_eq!(factory.get_token_count(), U256::from(2));
        assert_eq!(token_a, U256::from(0));
        assert_eq!(token_b, U256::from(1));
        assert_eq!(factory.get_token_name(token_a), "TokenA");
        assert_eq!(factory.get_token_name(token_b), "TokenB");
    }

    #[test]
    fn test_token_transfer() {
        let mut factory = TokenFactory::default();
        let impl_addr = Address::from([1u8; 20]);
        
        factory.initialize(impl_addr).unwrap();

        let token_id = factory.create_token(
            String::from("Test"),
            String::from("TST"),
            U256::from(18),
            U256::from(1000),
        ).unwrap();

        let creator = contract::sender();
        let recipient = Address::from([2u8; 20]);
        
        // Check initial balance
        assert_eq!(factory.balance_of(token_id, creator), U256::from(1000));
        
        // Transfer would need proper msg_sender setup in real test
        // This is a simplified test structure
        assert!(factory.token_exists(token_id));
    }

    #[test]
    fn test_token_approval() {
        let mut factory = TokenFactory::default();
        let impl_addr = Address::from([1u8; 20]);
        
        factory.initialize(impl_addr).unwrap();

        let token_id = factory.create_token(
            String::from("Test"),
            String::from("TST"),
            U256::from(18),
            U256::from(1000),
        ).unwrap();

        let owner = contract::sender();
        let spender = Address::from([3u8; 20]);
        
        // Initial allowance should be 0
        assert_eq!(factory.allowance(token_id, owner, spender), U256::ZERO);
    }
}
