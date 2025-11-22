# x402 Quick Start Guide

## 🚀 Start Here - Day 1 Commands

### 1. Create Feature Branch
```bash
cd /home/luffy/Projects/n8nrollup
git checkout -b feature/x402-payment-integration
```

### 2. Install Dependencies

#### Smart Contract Dependencies
```bash
cd contract
mkdir -p payment-contracts
cd payment-contracts
npm init -y
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox
npm install @openzeppelin/contracts dotenv
npx hardhat init  # Choose "Create a TypeScript project"
```

#### Payment Service Dependencies
```bash
cd ../..
mkdir -p payment-service
cd payment-service
npm init -y
npm install express ethers@6 jsonwebtoken bcrypt cors dotenv @supabase/supabase-js
npm install --save-dev typescript @types/node @types/express @types/jsonwebtoken @types/bcrypt @types/cors ts-node nodemon
npx tsc --init
```

#### Frontend Dependencies
```bash
cd ../frontend
npm install @web3modal/wagmi wagmi viem @tanstack/react-query
npm install date-fns recharts
```

### 3. Create Directory Structure
```bash
cd ..
mkdir -p contract/payment-contracts/{contracts,scripts,test}
mkdir -p payment-service/src/{controllers,middleware,models,services,utils,routes}
mkdir -p frontend/components/payment
mkdir -p frontend/lib/payment
mkdir -p frontend/app/billing
mkdir -p frontend/migrations
```

---

## 📝 Environment Setup

### Create `.env` Files

#### 1. Contract Environment
```bash
cat > contract/payment-contracts/.env << 'EOF'
PRIVATE_KEY=your_deployer_private_key_here
BLOCKOPS_RPC_URL=https://your-blockops-rpc-url
TREASURY_ADDRESS=your_treasury_wallet_address
USDC_ADDRESS=0x... # USDC on BlockOps testnet
EOF
```

#### 2. Payment Service Environment
```bash
cat > payment-service/.env << 'EOF'
PORT=4000
DATABASE_URL=your_supabase_connection_url
SUPABASE_KEY=your_supabase_anon_key
JWT_SECRET=your_random_jwt_secret_generate_this
PAYMENT_CONTRACT_ADDRESS=will_add_after_deployment
RPC_URL=https://your-blockops-rpc-url
BACKEND_PRIVATE_KEY=your_backend_wallet_private_key
USDC_ADDRESS=0x...
EOF
```

#### 3. Frontend Environment
```bash
cat > frontend/.env.local << 'EOF'
NEXT_PUBLIC_PAYMENT_SERVICE_URL=http://localhost:4000
NEXT_PUBLIC_PAYMENT_CONTRACT_ADDRESS=will_add_after_deployment
NEXT_PUBLIC_USDC_ADDRESS=0x...
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EOF
```

---

## 🔐 Generate Secure Keys

### Generate JWT Secret
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### Generate Wallet (for testing)
```bash
node -e "const ethers = require('ethers'); const wallet = ethers.Wallet.createRandom(); console.log('Address:', wallet.address); console.log('Private Key:', wallet.privateKey);"
```

---

## 🏗️ Day 2: Deploy Smart Contracts

### 1. Configure Hardhat
```bash
cd contract/payment-contracts
```

Edit `hardhat.config.ts`:
```typescript
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    blockops: {
      url: process.env.BLOCKOPS_RPC_URL || "",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },
};

export default config;
```

### 2. Compile Contracts
```bash
npx hardhat compile
```

### 3. Deploy to Testnet
```bash
npx hardhat run scripts/deploy.js --network blockops
```

### 4. Save Deployment Info
```bash
# Contract address will be printed
# Update all .env files with PAYMENT_CONTRACT_ADDRESS
```

---

## 💾 Day 3: Database Setup

### Run Migration
```bash
cd frontend
psql $DATABASE_URL -f migrations/001_add_payment_tables.sql

# OR via Supabase Dashboard:
# Go to SQL Editor → New Query → Paste migration content → Run
```

### Create Database Function
```sql
-- Add this function to handle AI usage increment
CREATE OR REPLACE FUNCTION increment_ai_usage(
  p_user_id TEXT,
  p_period_start TIMESTAMP WITH TIME ZONE,
  p_period_end TIMESTAMP WITH TIME ZONE
)
RETURNS void AS $$
BEGIN
  INSERT INTO ai_generation_usage (user_id, generation_count, period_start, period_end, last_generation_at)
  VALUES (p_user_id, 1, p_period_start, p_period_end, NOW())
  ON CONFLICT (user_id, period_start)
  DO UPDATE SET 
    generation_count = ai_generation_usage.generation_count + 1,
    last_generation_at = NOW(),
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;
```

---

## 🖥️ Day 4: Start Payment Service

### 1. Configure TypeScript
```bash
cd payment-service
```

Update `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

### 2. Add Scripts to package.json
```json
{
  "scripts": {
    "dev": "nodemon src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js"
  }
}
```

### 3. Start Development Server
```bash
npm run dev
```

### 4. Test Health Check
```bash
curl http://localhost:4000/health
```

---

## 🎨 Day 5-7: Frontend Development

### Start Frontend Dev Server
```bash
cd frontend
npm run dev
```

### Test Components Individually
```bash
# View each component in isolation
# Visit: http://localhost:3000/agent-builder
```

---

## 🧪 Day 9: Testing Commands

### Test Payment Flow
```bash
# 1. Open browser console
# 2. Generate AI workflow (should work 3 times)
# 3. On 4th attempt, payment modal should appear
# 4. Complete payment in MetaMask
# 5. Verify in billing dashboard
```

### Check Database
```sql
-- Check payments
SELECT * FROM payments ORDER BY created_at DESC LIMIT 10;

-- Check AI usage
SELECT * FROM ai_generation_usage WHERE user_id = 'your-user-id';

-- Check pricing config
SELECT * FROM pricing_config;
```

### Monitor Backend Logs
```bash
# Terminal 1: Payment Service
cd payment-service
npm run dev

# Terminal 2: Frontend
cd frontend
npm run dev

# Terminal 3: Watch logs
tail -f payment-service/logs/app.log
```

---

## 📊 Verification Checklist

### Smart Contract
- [ ] Contract deployed to testnet
- [ ] Contract verified on explorer
- [ ] Treasury address set correctly
- [ ] USDC token added as supported
- [ ] Backend wallet authorized

### Database
- [ ] All tables created
- [ ] Pricing data seeded
- [ ] Database function created
- [ ] Indexes created
- [ ] Test queries working

### Payment Service
- [ ] Server running on port 4000
- [ ] Health endpoint responding
- [ ] Can create payment intents
- [ ] Can verify payments
- [ ] JWT tokens generating correctly

### Frontend
- [ ] Payment components rendering
- [ ] Pricing badges showing on tools
- [ ] AI generation counter working
- [ ] Payment agreement modal showing
- [ ] Payment modal functional
- [ ] Billing dashboard displaying data

---

## 🚨 Common Issues & Solutions

### Issue: "Cannot find module '@openzeppelin/contracts'"
```bash
cd contract/payment-contracts
npm install @openzeppelin/contracts
```

### Issue: "ETIMEDOUT" when deploying
```bash
# Check RPC URL is correct
# Try using different RPC endpoint
# Ensure wallet has testnet funds
```

### Issue: Database migration fails
```bash
# Check DATABASE_URL is correct
# Ensure you have permissions
# Try running each table creation separately
```

### Issue: MetaMask shows wrong network
```bash
# Add BlockOps testnet to MetaMask:
# Network Name: BlockOps Testnet
# RPC URL: [your-rpc-url]
# Chain ID: [your-chain-id]
# Symbol: [native-token-symbol]
```

### Issue: Payment modal doesn't appear
```bash
# Check browser console for errors
# Verify payment context is wrapped in app
# Check environment variables are loaded
```

---

## 🎯 Success Criteria

After completing all steps, you should be able to:

1. ✅ Generate 3 free AI workflows
2. ✅ See payment agreement modal on 4th generation
3. ✅ Accept agreement and proceed to payment
4. ✅ Pay with USDC and generate workflow
5. ✅ View payment in billing dashboard
6. ✅ See pricing badges on premium tools
7. ✅ Execute paid tool with escrow protection
8. ✅ Receive automatic refund on failure

---

## 📞 Next Steps After MVP

1. **Test with Real Users**
   - Get 5-10 beta testers
   - Collect feedback
   - Monitor payment success rate

2. **Optimize Pricing**
   - A/B test different price points
   - Monitor conversion rates
   - Adjust based on usage

3. **Add Features**
   - Subscription plans
   - Bulk credits
   - Referral system

4. **Scale Infrastructure**
   - Move to production RPC
   - Set up monitoring
   - Add analytics

---

## 📚 Useful Resources

- [Hardhat Documentation](https://hardhat.org/docs)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts/)
- [Ethers.js v6 Documentation](https://docs.ethers.org/v6/)
- [Supabase Docs](https://supabase.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)

---

**Last Updated:** November 23, 2025  
**Version:** 1.0 MVP  
**Estimated Time:** 10 days for complete implementation
