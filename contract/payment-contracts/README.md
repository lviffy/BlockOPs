# Payment Escrow Smart Contracts

This directory contains the x402 payment gating smart contracts for BlockOps platform.

## 📁 Structure

```
payment-contracts/
├── contracts/
│   └── PaymentEscrow.sol          # Main escrow contract
├── scripts/
│   ├── deploy.js                  # Deployment script
│   └── verify.js                  # Contract verification script
├── test/
│   └── PaymentEscrow.test.js      # Test suite
├── hardhat.config.js              # Hardhat configuration
├── .env                           # Environment variables
└── DEPLOYMENT_STATUS.md           # Current deployment status
```

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Edit `.env` file with your values:
```env
PRIVATE_KEY=your_metamask_private_key
ARBITRUM_SEPOLIA_RPC_URL=https://sepolia-rollup.arbitrum.io/rpc
TREASURY_ADDRESS=your_treasury_wallet_address
USDC_ADDRESS=usdc_contract_address  # Optional
```

### 3. Compile Contracts
```bash
npx hardhat compile
```

### 4. Deploy to Arbitrum Sepolia Testnet
```bash
npx hardhat run scripts/deploy.js --network arbitrumSepolia
```

### 5. Verify Deployment
```bash
# Add PAYMENT_CONTRACT_ADDRESS to .env first
npx hardhat run scripts/verify.js --network arbitrumSepolia
```

## 📋 Contract Features

### PaymentEscrow.sol

**Main Functions:**
- `createPayment()` - User creates escrow payment
- `executePayment()` - Backend executes payment after service delivery
- `refundPayment()` - Backend refunds if service fails
- `verifyPayment()` - Check payment status
- `getPayment()` - Get payment details

**Admin Functions:**
- `addAuthorizedBackend()` - Authorize backend addresses
- `removeAuthorizedBackend()` - Remove backend authorization
- `setSupportedToken()` - Enable/disable ERC-20 tokens
- `updateTreasury()` - Change treasury address
- `pause()` / `unpause()` - Emergency controls

**Security Features:**
- ✅ ReentrancyGuard protection
- ✅ Pausable for emergencies
- ✅ Owner-only admin functions
- ✅ Backend authorization system
- ✅ Event emission for tracking

## 💰 Payment Flow

1. **User initiates payment**
   ```javascript
   // Frontend calls createPayment
   paymentId = await escrow.createPayment(agentId, toolName, token, amount)
   ```

2. **Funds held in escrow**
   - Contract holds funds securely
   - Neither user nor treasury can access

3. **Backend processes service**
   - AI workflow generation
   - Tool execution
   - Status tracking

4. **Payment execution or refund**
   ```javascript
   // Success: Transfer to treasury
   await escrow.executePayment(paymentId)
   
   // Failure: Refund to user
   await escrow.refundPayment(paymentId)
   ```

## 🔧 Configuration

### Network Configuration (hardhat.config.js)
```javascript
networks: {
  arbitrumSepolia: {
    type: "http",
    url: process.env.ARBITRUM_SEPOLIA_RPC_URL,
    accounts: [process.env.PRIVATE_KEY],
    chainId: 421614
  }
}
```

### Solidity Settings
- Version: 0.8.20
- Optimizer: Enabled (200 runs)
- OpenZeppelin Contracts: ^5.0.0

## 📊 Events

The contract emits the following events:

```solidity
event PaymentCreated(bytes32 indexed paymentId, address indexed user, uint256 amount, string toolName)
event PaymentExecuted(bytes32 indexed paymentId, address indexed backend)
event PaymentRefunded(bytes32 indexed paymentId, address indexed user, uint256 amount)
event TokenSupported(address indexed token, bool supported)
```

## 🧪 Testing

```bash
# Run all tests
npx hardhat test

# Run with gas reporting
REPORT_GAS=true npx hardhat test

# Run specific test file
npx hardhat test test/PaymentEscrow.test.js
```

**Note:** Tests require Node.js 22.x LTS. Current environment (Node 25.1.0) has compatibility issues with Hardhat testing framework.

## 🔐 Security Considerations

1. **Private Key Management**
   - Never commit `.env` to git
   - Use hardware wallets for mainnet
   - Rotate keys regularly

2. **Backend Authorization**
   - Only authorize trusted backend addresses
   - Monitor backend transactions
   - Remove compromised backends immediately

3. **Treasury Security**
   - Use multi-sig wallet for treasury
   - Regular audits of treasury transactions
   - Set up monitoring alerts

4. **Token Support**
   - Verify token contracts before enabling
   - Test token transfers on testnet
   - Monitor for token vulnerabilities

## 📝 Post-Deployment Checklist

- [ ] Contract deployed successfully
- [ ] PAYMENT_CONTRACT_ADDRESS added to .env
- [ ] USDC token support enabled (if using)
- [ ] Backend address authorized
- [ ] Deployment verified with verify.js
- [ ] Contract address shared with frontend team
- [ ] Treasury address confirmed
- [ ] Test payment executed successfully

## 🆘 Troubleshooting

### "Incorrect payment amount" error
- Ensure msg.value matches the amount parameter
- For ERC-20, approve contract to spend tokens first

### "Not authorized" error
- Backend address must be authorized via `addAuthorizedBackend()`
- Check authorization: `await escrow.authorizedBackends(address)`

### "Token not supported" error
- Enable token: `await escrow.setSupportedToken(tokenAddress, true)`
- Verify: `await escrow.supportedTokens(tokenAddress)`

### Gas estimation errors
- Ensure sufficient balance for gas
- Check network connection to Arbitrum Sepolia RPC
- Verify private key is correct

## 🔗 Integration with Backend

The payment service will interact with this contract:

```javascript
// Backend service example
const escrow = new ethers.Contract(
  process.env.PAYMENT_CONTRACT_ADDRESS,
  PaymentEscrowABI,
  backendSigner
);

// Execute payment after successful service
await escrow.executePayment(paymentId);

// Refund if service fails
await escrow.refundPayment(paymentId);
```

## 📚 Resources

- [Hardhat Documentation](https://hardhat.org/docs)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts)
- [Arbitrum Sepolia Docs](https://docs.arbitrum.io/build-decentralized-apps/reference/node-providers)
- [Ethers.js Documentation](https://docs.ethers.org)

## 📄 License

MIT License - See LICENSE file for details

---

**Status:** ✅ Ready for Deployment  
**Last Updated:** Day 2 of Implementation  
**Next Step:** Deploy to Arbitrum Sepolia testnet and proceed with Day 3 (Database setup)
