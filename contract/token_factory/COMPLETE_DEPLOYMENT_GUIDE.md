# Complete ERC20 Token Factory Deployment Guide

## Overview

This Token Factory allows **ANY user** to deploy their own independent ERC20 tokens using the **EIP-1167 Minimal Proxy Pattern**. Each token is a real, separate contract with its own storage and functionality.

## How It Works

### Architecture

```
┌─────────────────────┐
│  Token Factory      │ ← Users interact here
└──────────┬──────────┘
           │
           │ CREATE2 (deploys clones)
           ▼
     ┌─────────┬─────────┬─────────┐
     │ Token A │ Token B │ Token C │  ← Each is a real contract
     └─────────┴─────────┴─────────┘
           │         │         │
           │         │         │
           ▼         ▼         ▼
     ┌─────────────────────────────┐
     │  ERC20 Implementation       │ ← Shared logic (template)
     └─────────────────────────────┘
```

### Key Components

1. **ERC20 Implementation Contract**: The template contract with all token logic
2. **Token Factory Contract**: Creates minimal proxies (clones) of the implementation
3. **Cloned Token Contracts**: Independent tokens deployed for each user via CREATE2

## Deployment Steps

### Step 1: Deploy the ERC20 Implementation (Template)

First, compile and deploy the `Erc20` contract as a standalone implementation:

```bash
cd contract/token_factory

# Build the implementation contract
cargo stylus check

# Deploy the implementation
cargo stylus deploy \
  --private-key-path=./deployer-key.txt \
  --endpoint=https://your-arbitrum-endpoint.com
```

**Save the deployed address!** You'll need it for the factory.

Example: `0x1234567890123456789012345678901234567890`

### Step 2: Deploy the Token Factory

Deploy the `TokenFactory` contract:

```bash
# The factory deployment
cargo stylus deploy \
  --private-key-path=./deployer-key.txt \
  --endpoint=https://your-arbitrum-endpoint.com
```

**Save this address too!** This is what users will interact with.

Example: `0xABCDEF1234567890ABCDEF1234567890ABCDEF12`

### Step 3: Initialize the Factory

Call the `initialize()` function on the factory with the implementation address:

```javascript
// Using ethers.js v6
const factory = await ethers.getContractAt(
  "TokenFactory", 
  "0xABCDEF1234567890ABCDEF1234567890ABCDEF12"
);

await factory.initialize("0x1234567890123456789012345678901234567890");
```

Or using cast:

```bash
cast send 0xABCDEF1234567890ABCDEF1234567890ABCDEF12 \
  "initialize(address)" \
  0x1234567890123456789012345678901234567890 \
  --private-key $PRIVATE_KEY \
  --rpc-url $RPC_URL
```

## User Interaction

### Creating a Token

Any user can now create their own token:

```javascript
// User A creates their token
const tx = await factory.create_token(
  "MyAwesomeToken",           // name
  "MAT",                      // symbol
  18,                         // decimals (18 is standard)
  ethers.parseEther("1000000") // initial supply (1M tokens)
);

const receipt = await tx.wait();

// Get the new token address from event
const event = receipt.logs.find(log => log.eventName === "TokenCreated");
const tokenAddress = event.args.token_address;

console.log(`Token deployed at: ${tokenAddress}`);
```

### Interacting with the Token

Once created, users can interact with their token using standard ERC20 functions:

```javascript
const token = await ethers.getContractAt("Erc20", tokenAddress);

// Check balance
const balance = await token.balance_of(userAddress);

// Transfer tokens
await token.transfer(recipientAddress, ethers.parseEther("100"));

// Approve spender
await token.approve(spenderAddress, ethers.parseEther("50"));

// Transfer from
await token.transfer_from(fromAddress, toAddress, ethers.parseEther("25"));
```

## Verification

### Verify Each Component

1. **Verify Implementation Contract** deployment
2. **Verify Factory Contract** is initialized with correct implementation
3. **Verify Token Creation** by calling `create_token()` and checking the event

### Test Script

```javascript
// test-factory.js
import { ethers } from "ethers";

async function testFactory() {
  const provider = new ethers.JsonRpcProvider("YOUR_RPC_URL");
  const wallet = new ethers.Wallet("YOUR_PRIVATE_KEY", provider);
  
  const factory = await ethers.getContractAt(
    "TokenFactory",
    "FACTORY_ADDRESS",
    wallet
  );
  
  // Check implementation
  const impl = await factory.get_implementation();
  console.log("Implementation:", impl);
  
  // Create a token
  console.log("Creating token...");
  const tx = await factory.create_token(
    "TestToken",
    "TST",
    18,
    ethers.parseEther("1000000")
  );
  
  const receipt = await tx.wait();
  console.log("Token created! Transaction:", receipt.hash);
  
  // Get token count
  const count = await factory.get_token_count();
  console.log("Total tokens created:", count.toString());
  
  // Get the token address
  const tokenAddr = await factory.get_token_by_id(count - 1n);
  console.log("New token address:", tokenAddr);
  
  // Interact with the token
  const token = await ethers.getContractAt("Erc20", tokenAddr, wallet);
  const name = await token.name();
  const symbol = await token.symbol();
  const balance = await token.balance_of(wallet.address);
  
  console.log(`Token Name: ${name}`);
  console.log(`Token Symbol: ${symbol}`);
  console.log(`Your Balance: ${ethers.formatEther(balance)}`);
}

testFactory().catch(console.error);
```

## Real-World Example

### Scenario: Three Users Creating Tokens

```javascript
// User Alice creates AliceCoin
const alice = new ethers.Wallet(ALICE_KEY, provider);
const factoryAlice = factory.connect(alice);
const txAlice = await factoryAlice.create_token("AliceCoin", "ALC", 18, ethers.parseEther("500000"));
// AliceCoin deployed at: 0xAAA...

// User Bob creates BobToken
const bob = new ethers.Wallet(BOB_KEY, provider);
const factoryBob = factory.connect(bob);
const txBob = await factoryBob.create_token("BobToken", "BOB", 18, ethers.parseEther("2000000"));
// BobToken deployed at: 0xBBB...

// User Carol creates CarolCoin
const carol = new ethers.Wallet(CAROL_KEY, provider);
const factoryCarol = factory.connect(carol);
const txCarol = await factoryCarol.create_token("CarolCoin", "CAR", 18, ethers.parseEther("100000"));
// CarolCoin deployed at: 0xCCC...
```

Each token is **completely independent** with:
- ✅ Unique contract address
- ✅ Separate storage
- ✅ Independent supply
- ✅ Full ERC20 functionality

## Technical Details

### EIP-1167 Minimal Proxy

The factory uses **EIP-1167** to deploy extremely gas-efficient clones:

```
Bytecode: 0x363d3d373d3d3d363d73[implementation]5af43d82803e903d91602b57fd5bf3
```

This creates a proxy that:
1. Delegates all calls to the implementation
2. Uses only ~45 bytes of bytecode
3. Costs ~10x less gas than deploying full contracts

### Storage Separation

Each cloned token has its own storage space:
- Token A's balances ≠ Token B's balances
- Token A's supply ≠ Token B's supply
- Completely isolated

### Gas Costs

- **Implementation Deploy**: ~500K gas (one-time)
- **Factory Deploy**: ~800K gas (one-time)
- **Create Token**: ~200K gas per token 🎉
- **Compare to full deploy**: ~2M gas per token ❌

## Security Considerations

⚠️ **Important Notes:**

1. **Auditing**: This is a template. Audit before mainnet use.
2. **Implementation Immutability**: The implementation cannot be changed once set
3. **Access Control**: Anyone can create tokens (by design)
4. **Initialization**: Each token can only be initialized once

## Troubleshooting

### Common Issues

**Issue**: "InvalidImplementation" error
- **Fix**: Make sure you initialized the factory with the correct implementation address

**Issue**: "DeploymentFailed" error
- **Fix**: Check gas limits and ensure CREATE2 opcode is supported

**Issue**: Can't interact with created token
- **Fix**: Verify you're using the correct token address from the `TokenCreated` event

## Support

For questions or issues:
1. Check the contract comments in `lib.rs`
2. Review test cases in the `tests` module
3. Ensure Stylus SDK version compatibility

## License

MIT License - Use at your own risk
