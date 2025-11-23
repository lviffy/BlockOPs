# Arbitrum Sepolia Network Configuration

## Network Details

| Parameter | Value |
|-----------|-------|
| **Network Name** | Arbitrum Sepolia |
| **RPC URL** | https://sepolia-rollup.arbitrum.io/rpc |
| **Chain ID** | 421614 |
| **Currency Symbol** | ETH |
| **Block Explorer** | https://sepolia.arbiscan.io |

## Add to MetaMask

1. Open MetaMask
2. Click on the network dropdown
3. Click "Add Network"
4. Click "Add a network manually"
5. Enter the following details:
   - Network name: `Arbitrum Sepolia`
   - New RPC URL: `https://sepolia-rollup.arbitrum.io/rpc`
   - Chain ID: `421614`
   - Currency symbol: `ETH`
   - Block explorer URL: `https://sepolia.arbiscan.io`
6. Click "Save"

## Get Test ETH

### Option 1: QuickNode Faucet
- URL: https://faucet.quicknode.com/arbitrum/sepolia
- Requirements: Mainnet balance (0.001 ETH on Ethereum mainnet)
- Amount: 0.01 ETH per request

### Option 2: Alchemy Faucet
- URL: https://www.alchemy.com/faucets/arbitrum-sepolia
- Requirements: Alchemy account
- Amount: 0.1 ETH per day

### Option 3: Chainlink Faucet
- URL: https://faucets.chain.link/arbitrum-sepolia
- Requirements: GitHub account or 0.001 ETH on mainnet
- Amount: 0.01 ETH per request

### Option 4: Bridge from Sepolia
1. Get Sepolia ETH from https://sepoliafaucet.com
2. Bridge to Arbitrum Sepolia at https://bridge.arbitrum.io/?l2ChainId=421614

## USDC on Arbitrum Sepolia

If you need USDC for testing:

**USDC Contract Address (Arbitrum Sepolia):**
```
0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d
```

You can:
1. Get USDC from Circle's testnet faucet
2. Or use a mock USDC contract
3. Add this address to your `.env` file as `USDC_ADDRESS`

## Verify Your Deployment

After deploying, verify your contract on Arbiscan:

```bash
npx hardhat verify --network arbitrumSepolia <CONTRACT_ADDRESS> <TREASURY_ADDRESS> <OWNER_ADDRESS>
```

Or visit: https://sepolia.arbiscan.io/address/<YOUR_CONTRACT_ADDRESS>

## Gas Prices

Arbitrum Sepolia typically has very low gas costs:
- Average gas price: ~0.1 Gwei
- Deployment cost: ~0.001-0.005 ETH
- Transaction cost: ~0.0001 ETH

## Useful Links

- **Official Docs:** https://docs.arbitrum.io
- **Faucet List:** https://docs.arbitrum.io/build-decentralized-apps/reference/node-providers
- **Bridge:** https://bridge.arbitrum.io/?l2ChainId=421614
- **Block Explorer:** https://sepolia.arbiscan.io
- **RPC Status:** https://chainlist.org/chain/421614

## Troubleshooting

### "Insufficient funds" error
- Get more test ETH from one of the faucets above
- Check your balance: https://sepolia.arbiscan.io/address/<YOUR_ADDRESS>

### "Network not found" error
- Make sure you've added Arbitrum Sepolia to MetaMask
- Double-check the Chain ID (421614)
- Verify the RPC URL in your `.env` file

### "Transaction failed" error
- Check gas settings
- Ensure you're on the correct network
- Verify your private key is correct

### RPC connection issues
- Try alternative RPC URLs:
  - `https://sepolia-rollup.arbitrum.io/rpc` (official)
  - `https://arbitrum-sepolia.blockpi.network/v1/rpc/public` (BlockPI)
  - `https://arbitrum-sepolia-rpc.publicnode.com` (PublicNode)

## Ready to Deploy?

1. ✅ Added Arbitrum Sepolia to MetaMask
2. ✅ Got test ETH from faucet
3. ✅ Updated `.env` with your private key and treasury address
4. ✅ Compiled contract successfully

Run:
```bash
npx hardhat run scripts/deploy.js --network arbitrumSepolia
```

Good luck! 🚀
