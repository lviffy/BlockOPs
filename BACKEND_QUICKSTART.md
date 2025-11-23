# Backend Quick Start - n8nrollup

## 🎯 What You Have

A **dual-backend architecture** for blockchain operations on Arbitrum Sepolia:

1. **AI Agent Backend** (Port 8000) - Natural language interface
2. **Blockchain Backend** (Port 3000) - Direct blockchain operations

---

## 🚀 Quick Start (5 Steps)

### Step 1: Install Dependencies

```bash
# Backend (Blockchain Layer)
cd backend
npm install

# AI Agent Backend
cd ../n8n_agent_backend
pip install -r requirements.txt
```

### Step 2: Configure Environment

**backend/.env:**
```env
PORT=3000
TOKEN_FACTORY_ADDRESS=0xYourTokenFactoryAddress
NFT_FACTORY_ADDRESS=0xYourNFTFactoryAddress
GEMINI_API_KEY=your_gemini_api_key
```

**n8n_agent_backend/.env:**
```env
GEMINI_API_KEY=your_gemini_api_key
BACKEND_URL=http://localhost:3000
```

### Step 3: Start Both Servers

**Terminal 1:**
```bash
cd backend
npm start
```

**Terminal 2:**
```bash
cd n8n_agent_backend
python main.py
```

### Step 4: Test Health

```bash
# Test blockchain backend
curl http://localhost:3000/health

# Test AI agent backend
curl http://localhost:8000/health
```

### Step 5: Deploy Your First Token

```bash
curl -X POST http://localhost:8000/agent/chat \
  -H "Content-Type: application/json" \
  -d '{
    "tools": [{"tool": "deploy_erc20", "next_tool": null}],
    "user_message": "Deploy a token called TestToken with symbol TEST and 1 million supply",
    "private_key": "0xYourPrivateKeyHere"
  }'
```

---

## 📚 Documentation Files

| File | Purpose |
|------|---------|
| `BACKEND_ARCHITECTURE.md` | Complete system architecture and flow |
| `backend/API_DOCUMENTATION.md` | All endpoints, parameters, and responses |
| `TESTING_GUIDE.md` | Step-by-step testing instructions |
| `BACKEND_QUICKSTART.md` | This quick start guide |

---

## 🔗 Key Endpoints

### AI Agent Backend (Port 8000)
- `POST /agent/chat` - Natural language interface
- `GET /health` - Health check
- `GET /tools` - List available tools

### Blockchain Backend (Port 3000)
- `POST /token/deploy` - Deploy ERC20 token
- `GET /token/info/:tokenId` - Get token info
- `GET /token/balance/:tokenId/:address` - Get token balance
- `POST /transfer` - Transfer ETH or tokens
- `POST /nft/deploy-collection` - Deploy NFT collection
- `POST /nft/mint` - Mint NFT
- `POST /price/token` - Get crypto prices

---

## 💡 How It Works

```
Frontend → AI Agent Backend → Blockchain Backend → Arbitrum Sepolia
          (Natural Language)  (Blockchain Ops)    (Smart Contracts)
```

1. User sends natural language request to AI Agent
2. AI Agent interprets intent and calls appropriate tools
3. Tools make HTTP requests to Blockchain Backend
4. Blockchain Backend executes transactions on Arbitrum
5. Results flow back through the chain

---

## 🛠️ Available Tools

| Tool | Description |
|------|-------------|
| `deploy_erc20` | Deploy ERC20 token |
| `deploy_erc721` | Deploy NFT collection |
| `transfer` | Transfer ETH or tokens |
| `get_balance` | Get ETH balance |
| `get_token_info` | Get token details |
| `get_token_balance` | Get token balance |
| `mint_nft` | Mint new NFT |
| `get_nft_info` | Get NFT details |
| `fetch_price` | Get crypto prices |

---

## 🎨 Frontend Integration

```typescript
// Example: Deploy token from frontend
const response = await fetch('http://localhost:8000/agent/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    tools: [{ tool: 'deploy_erc20', next_tool: null }],
    user_message: 'Deploy MyToken with 1M supply',
    private_key: userWallet.privateKey
  })
});

const data = await response.json();
console.log(data.agent_response); // AI-generated summary
console.log(data.results); // Actual blockchain results
```

---

## 🔑 Important Notes

### Token Identification
- Uses `tokenId` (number) not `tokenAddress`
- TokenId returned from deployment
- All token operations require tokenId

### Private Keys
- Must start with `0x`
- Keep secure, never commit to git
- Use environment variables

### Gas Fees
- Wallet needs Arbitrum Sepolia ETH
- Get from faucet: https://faucet.quicknode.com/arbitrum/sepolia

### Contract Addresses
- Deploy TokenFactory and NFTFactory first
- Update addresses in backend/.env

---

## 🐛 Common Issues

**"Connection refused"**
→ Make sure both backends are running

**"Contract address not configured"**
→ Set TOKEN_FACTORY_ADDRESS in .env

**"Insufficient balance"**
→ Fund wallet with Arbitrum Sepolia ETH

**"GEMINI_API_KEY not found"**
→ Add API key to both .env files

---

## 📖 Example Workflows

### Simple Token Deploy
```json
{
  "tools": [{"tool": "deploy_erc20"}],
  "user_message": "Deploy MyToken (MTK, 1M supply)",
  "private_key": "0x..."
}
```

### Sequential: Deploy → Transfer
```json
{
  "tools": [
    {"tool": "deploy_erc20", "next_tool": "transfer"},
    {"tool": "transfer", "next_tool": null}
  ],
  "user_message": "Deploy RewardToken and send 1000 to 0xRecipient",
  "private_key": "0x..."
}
```

### Multi-tool: Balance + Price
```json
{
  "tools": [
    {"tool": "get_balance"},
    {"tool": "fetch_price"}
  ],
  "user_message": "Check balance of 0xAddress and get ETH price",
  "private_key": null
}
```

---

## 🎯 Next Steps

1. ✅ Deploy your contracts (TokenFactory, NFTFactory)
2. ✅ Update contract addresses in .env
3. ✅ Get Arbitrum Sepolia ETH from faucet
4. ✅ Test with the provided examples
5. ✅ Integrate with your frontend

---

## 📞 Support

- Check `BACKEND_ARCHITECTURE.md` for detailed flow
- Check `backend/API_DOCUMENTATION.md` for endpoint details
- Check `TESTING_GUIDE.md` for test scenarios
- View transactions on: https://sepolia.arbiscan.io

---

**You're all set! Start building amazing blockchain apps! 🚀**
