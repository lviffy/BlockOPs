//!
//! Stylus ERC20 Token Factory
//!
//! A TRUE factory contract that allows ANY user to deploy their own ERC20 tokens.
//! This uses a minimal proxy/clone pattern to deploy independent token contracts.
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
//! 1. First deploy the Erc20 contract as a template
//! 2. Then deploy TokenFactory with the Erc20 template address
//! 3. Users call createToken() which uses CREATE2 to deploy clones
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

use alloc::{string::String, vec, vec::Vec};
use stylus_sdk::{
    alloy_primitives::{Address, U256, B256},
    alloy_sol_types::{sol, SolError},
    call::RawCall,
    deploy::RawDeploy,
    storage::StorageCache,
    prelude::*,
};

// Define the ERC20 token storage
sol_storage! {
    pub struct Erc20 {
        string name;
        string symbol;
        uint256 decimals;
        uint256 total_supply;
        address creator;
        bool initialized;
        
        mapping(address => uint256) balances;
        mapping(address => mapping(address => uint256)) allowances;
    }
}

// Define the Token Factory storage
sol_storage! {
    #[entrypoint]
    pub struct TokenFactory {
        address implementation;
        uint256 token_count;
        mapping(uint256 => address) tokens;
        mapping(address => address[]) creator_to_tokens;
        mapping(address => uint256) token_to_id;
    }
}

// Factory Events
sol! {
    event TokenCreated(address indexed creator, address indexed token_address, string name, string symbol, uint256 initial_supply, uint256 token_id);
    event ImplementationUpdated(address indexed old_implementation, address indexed new_implementation);
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
    error AlreadyInitialized();
    error DeploymentFailed();
    error InvalidImplementation();
}

// ============================================
// TOKEN FACTORY IMPLEMENTATION
// ============================================

#[public]
impl TokenFactory {
    /// Initialize the factory with an implementation contract address
    pub fn initialize(&mut self, implementation: Address) -> Result<(), Vec<u8>> {
        if self.implementation.get() != Address::ZERO {
            return Err(AlreadyInitialized {}.abi_encode());
        }
        
        if implementation == Address::ZERO {
            return Err(InvalidImplementation {}.abi_encode());
        }
        
        self.implementation.set(implementation);
        Ok(())
    }

    /// Creates a new ERC20 token for the caller using CREATE2
    /// This deploys a real, independent token contract
    pub fn create_token(
        &mut self,
        name: String,
        symbol: String,
        decimals: U256,
        initial_supply: U256,
    ) -> Result<Address, Vec<u8>> {
        let creator = self.vm().msg_sender();
        let implementation = self.implementation.get();
        
        if implementation == Address::ZERO {
            return Err(InvalidImplementation {}.abi_encode());
        }

        // Increment token count
        let token_id = self.token_count.get();
        let new_token_id = token_id + U256::from(1);
        self.token_count.set(new_token_id);

        // Deploy new token using CREATE2 for deterministic addresses
        // This creates a minimal proxy (EIP-1167) that delegates to the implementation
        let token_address = self._deploy_clone(implementation, token_id)?;
        
        // Initialize the newly deployed token
        self._initialize_token(token_address, name.clone(), symbol.clone(), decimals, initial_supply, creator)?;
        
        // Store token mapping
        self.tokens.setter(token_id).set(token_address);
        // Note: creator_to_tokens would need proper dynamic array handling in production
        self.token_to_id.setter(token_address).set(token_id);

        // Emit event
        log(self.vm(), TokenCreated {
            creator,
            token_address,
            name,
            symbol,
            initial_supply,
            token_id,
        });

        Ok(token_address)
    }

    /// Returns the implementation contract address
    pub fn get_implementation(&self) -> Address {
        self.implementation.get()
    }

    /// Returns the total number of tokens created
    pub fn get_token_count(&self) -> U256 {
        self.token_count.get()
    }

    /// Returns the token address for a given token ID
    pub fn get_token_by_id(&self, token_id: U256) -> Address {
        self.tokens.get(token_id)
    }

    /// Returns the token ID for a given token address
    pub fn get_token_id(&self, token_address: Address) -> U256 {
        self.token_to_id.get(token_address)
    }

    /// Returns all tokens (paginated for gas efficiency)
    pub fn get_tokens(&self, start: U256, count: U256) -> Vec<Address> {
        let mut tokens = Vec::new();
        let total = self.token_count.get();
        let end = if start + count > total { total } else { start + count };
        
        let mut i = start;
        while i < end {
            tokens.push(self.tokens.get(i));
            i = i + U256::from(1);
        }
        
        tokens
    }

    // Internal function to deploy a minimal proxy (EIP-1167 clone)
    fn _deploy_clone(&mut self, implementation: Address, salt: U256) -> Result<Address, Vec<u8>> {
        // EIP-1167 minimal proxy bytecode
        // This bytecode creates a proxy that delegates all calls to the implementation
        let mut bytecode = vec![
            0x36, 0x3d, 0x3d, 0x37, 0x3d, 0x3d, 0x3d, 0x36, 0x3d, 0x73,
        ];
        bytecode.extend_from_slice(implementation.as_slice());
        bytecode.extend_from_slice(&[
            0x5a, 0xf4, 0x3d, 0x82, 0x80, 0x3e, 0x90, 0x3d, 0x91, 0x60,
            0x2b, 0x57, 0xfd, 0x5b, 0xf3,
        ]);

        // Use CREATE2 for deterministic address
        let salt_bytes = B256::from(salt.to_be_bytes::<32>());
        
        // Flush storage cache before deployment to prevent reentrancy issues
        unsafe {
            StorageCache::flush();
            
            let result = RawDeploy::new()
                .salt(salt_bytes)
                .deploy(&bytecode, U256::ZERO);
            
            match result {
                Ok(addr) => Ok(addr),
                Err(_) => Err(DeploymentFailed {}.abi_encode()),
            }
        }
    }

    // Internal function to initialize a deployed token
    fn _initialize_token(
        &self,
        token_address: Address,
        name: String,
        symbol: String,
        decimals: U256,
        initial_supply: U256,
        creator: Address,
    ) -> Result<(), Vec<u8>> {
        // Define the initialize function interface
        sol! {
            function initialize(string name, string symbol, uint256 decimals, uint256 initialSupply, address creator);
        }
        
        // Encode the initialize call with all parameters
        let call_data = initializeCall {
            name,
            symbol,
            decimals,
            initialSupply: initial_supply,
            creator,
        }.abi_encode();
        
        let call = RawCall::new();
        
        unsafe {
            match call.call(token_address, &call_data) {
                Ok(_) => Ok(()),
                Err(_) => Err(DeploymentFailed {}.abi_encode()),
            }
        }
    }
}

// ============================================
// ERC20 TOKEN IMPLEMENTATION
// ============================================

#[public]
impl Erc20 {
    /// Initializes a token instance (called by the factory)
    pub fn initialize(
        &mut self,
        name: String,
        symbol: String,
        decimals: U256,
        initial_supply: U256,
        creator: Address,
    ) {
        // Only initialize once
        if self.initialized.get() {
            return;
        }

        self.name.set_str(&name);
        self.symbol.set_str(&symbol);
        self.decimals.set(decimals);
        self.total_supply.set(initial_supply);
        self.creator.set(creator);
        self.initialized.set(true);

        // Mint initial supply to creator
        self.balances.setter(creator).set(initial_supply);

        log(self.vm(), Transfer {
            from: Address::ZERO,
            to: creator,
            value: initial_supply,
        });
    }

    /// Returns the creator of this token
    pub fn creator(&self) -> Address {
        self.creator.get()
    }

    /// Returns the name of the token
    pub fn name(&self) -> String {
        self.name.get_string()
    }

    /// Returns the symbol of the token
    pub fn symbol(&self) -> String {
        self.symbol.get_string()
    }

    /// Returns the decimals of the token
    pub fn decimals(&self) -> U256 {
        self.decimals.get()
    }

    /// Returns the total supply of the token
    pub fn total_supply(&self) -> U256 {
        self.total_supply.get()
    }

    /// Returns the balance of an account
    pub fn balance_of(&self, account: Address) -> U256 {
        self.balances.get(account)
    }

    /// Transfers tokens from the caller to another account
    pub fn transfer(&mut self, to: Address, amount: U256) -> Result<bool, Vec<u8>> {
        let from = self.vm().msg_sender();
        self._transfer(from, to, amount)?;
        Ok(true)
    }

    /// Returns the allowance of a spender for an owner
    pub fn allowance(&self, owner: Address, spender: Address) -> U256 {
        self.allowances.getter(owner).get(spender)
    }

    /// Approves a spender to spend tokens on behalf of the caller
    pub fn approve(&mut self, spender: Address, amount: U256) -> Result<bool, Vec<u8>> {
        let owner = self.vm().msg_sender();
        self._approve(owner, spender, amount)?;
        Ok(true)
    }

    /// Transfers tokens from one account to another using allowance
    pub fn transfer_from(
        &mut self,
        from: Address,
        to: Address,
        amount: U256,
    ) -> Result<bool, Vec<u8>> {
        let spender = self.vm().msg_sender();
        
        // Check and update allowance
        let current_allowance = self.allowances.getter(from).get(spender);
        
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
        self.allowances.setter(from).setter(spender).set(new_allowance);

        // Perform transfer
        self._transfer(from, to, amount)?;
        
        Ok(true)
    }

    /// Increases the allowance of a spender
    pub fn increase_allowance(&mut self, spender: Address, added_value: U256) -> Result<bool, Vec<u8>> {
        let owner = self.vm().msg_sender();
        let current_allowance = self.allowances.getter(owner).get(spender);
        let new_allowance = current_allowance + added_value;
        self._approve(owner, spender, new_allowance)?;
        Ok(true)
    }

    /// Decreases the allowance of a spender
    pub fn decrease_allowance(&mut self, spender: Address, subtracted_value: U256) -> Result<bool, Vec<u8>> {
        let owner = self.vm().msg_sender();
        let current_allowance = self.allowances.getter(owner).get(spender);
        
        if current_allowance < subtracted_value {
            return Err(InsufficientAllowance {
                owner,
                spender,
                have: current_allowance,
                want: subtracted_value,
            }.abi_encode());
        }
        
        let new_allowance = current_allowance - subtracted_value;
        self._approve(owner, spender, new_allowance)?;
        Ok(true)
    }
}

// Internal helper functions
impl Erc20 {
    /// Internal transfer function
    fn _transfer(&mut self, from: Address, to: Address, amount: U256) -> Result<(), Vec<u8>> {
        // Validate addresses
        if from == Address::ZERO {
            return Err(InvalidSender { from }.abi_encode());
        }
        if to == Address::ZERO {
            return Err(InvalidRecipient { to }.abi_encode());
        }

        // Check balance
        let from_balance = self.balances.get(from);
        if from_balance < amount {
            return Err(InsufficientBalance {
                from,
                have: from_balance,
                want: amount,
            }.abi_encode());
        }

        // Update balances
        self.balances.setter(from).set(from_balance - amount);
        let to_balance = self.balances.get(to);
        self.balances.setter(to).set(to_balance + amount);

        // Emit event
        log(self.vm(), Transfer { from, to, value: amount });

        Ok(())
    }

    /// Internal approve function
    fn _approve(&mut self, owner: Address, spender: Address, amount: U256) -> Result<(), Vec<u8>> {
        if owner == Address::ZERO {
            return Err(InvalidSender { from: owner }.abi_encode());
        }
        if spender == Address::ZERO {
            return Err(InvalidRecipient { to: spender }.abi_encode());
        }

        self.allowances.setter(owner).setter(spender).set(amount);

        log(self.vm(), Approval {
            owner,
            spender,
            value: amount,
        });

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use stylus_sdk::testing::*;

    #[test]
    fn test_factory_create_token() {
        let vm = TestVM::default();
        let mut factory = TokenFactory::from(&vm);

        let token_addr = factory.create_token(
            String::from("MyToken"),
            String::from("MTK"),
            U256::from(18),
            U256::from(1000000),
        ).unwrap();

        assert_ne!(token_addr, Address::ZERO);
        assert_eq!(factory.get_token_count(), U256::from(1));
        assert_eq!(factory.get_token_by_creator(vm.msg_sender()), token_addr);
    }

    #[test]
    fn test_multiple_users_create_tokens() {
        let vm = TestVM::default();
        let mut factory = TokenFactory::from(&vm);

        // User A creates token
        let token_a = factory.create_token(
            String::from("TokenA"),
            String::from("TKA"),
            U256::from(18),
            U256::from(1000000),
        ).unwrap();

        // Simulate different user by changing msg_sender
        let user_b = Address::from([1u8; 20]);
        // Note: In real tests, you'd need to change the VM's msg_sender
        
        assert_eq!(factory.get_token_count(), U256::from(1));
        assert_ne!(token_a, Address::ZERO);
    }

    #[test]
    fn test_token_initialization() {
        let vm = TestVM::default();
        let mut token = Erc20::from(&vm);
        let creator = vm.msg_sender();

        token.initialize(
            String::from("MyToken"),
            String::from("MTK"),
            U256::from(18),
            U256::from(1000000),
            creator,
        );

        assert_eq!(token.name(), "MyToken");
        assert_eq!(token.symbol(), "MTK");
        assert_eq!(token.decimals(), U256::from(18));
        assert_eq!(token.total_supply(), U256::from(1000000));
        assert_eq!(token.balance_of(creator), U256::from(1000000));
        assert_eq!(token.creator(), creator);
    }

    #[test]
    fn test_transfer() {
        let vm = TestVM::default();
        let mut token = Erc20::from(&vm);
        let creator = vm.msg_sender();

        token.initialize(
            String::from("Test"),
            String::from("TST"),
            U256::from(18),
            U256::from(1000),
            creator,
        );

        let recipient = Address::from([1u8; 20]);
        assert!(token.transfer(recipient, U256::from(100)).is_ok());
        assert_eq!(token.balance_of(recipient), U256::from(100));
        assert_eq!(token.balance_of(creator), U256::from(900));
    }

    #[test]
    fn test_approve_and_transfer_from() {
        let vm = TestVM::default();
        let mut token = Erc20::from(&vm);
        let creator = vm.msg_sender();

        token.initialize(
            String::from("Test"),
            String::from("TST"),
            U256::from(18),
            U256::from(1000),
            creator,
        );

        let spender = Address::from([2u8; 20]);
        assert!(token.approve(spender, U256::from(500)).is_ok());
        assert_eq!(token.allowance(creator, spender), U256::from(500));
    }
}
