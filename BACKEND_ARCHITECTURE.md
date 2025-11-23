# Backend Architecture - Complete Process Flow

## 🏗️ System Overview

Your application has **TWO backend systems** working together:

```
Frontend (Next.js)
       ↓
n8n_agent_backend (Port 8000) ← AI Orchestration Layer
       ↓
backend (Port 3000) ← Blockchain Operations Layer
       ↓
Arbitrum Sepolia Blockchain
```

---

## 📦 Backend Components

### 1. **n8n_agent_backend** (AI Agent Layer)
- **Technology**: FastAPI (Python)
- **Port**: 8000
- **Purpose**: AI-powered workflow orchestration
- **AI Model**: Google Gemini 2.0 Flash
- **Role**: Receives natural language requests from frontend and orchestrates blockchain operations

### 2. **backend** (Blockchain Layer)
- **Technology**: Express.js (Node.js)
- **Port**: 3000
- **Purpose**: Direct blockchain interactions
- **Role**: Executes actual blockchain transactions and queries

---

## 🔄 Complete Request Flow

### Step-by-Step Process:

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                │
│  User Input: "Deploy a token called MyToken with 1M supply"    │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ HTTP POST Request
                         │ Body: { tools: [...], user_message: "...", private_key: "..." }
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│              n8n_agent_backend (Port 8000)                      │
│                   AI ORCHESTRATION LAYER                        │
├─────────────────────────────────────────────────────────────────┤
│  STEP 1: Receive Request                                       │
│  └─ Endpoint: POST /agent/chat                                 │
│  └─ Parse: tools, user_message, private_key                    │
│                                                                 │
│  STEP 2: Build System Prompt                                   │
│  └─ Identify available tools from request                      │
│  └─ Create tool execution flow (if sequential)                 │
│  └─ Generate AI instructions                                   │
│                                                                 │
│  STEP 3: Initialize AI Agent (Google Gemini)                   │
│  └─ Model: gemini-2.0-flash-exp                               │
│  └─ Enable: Google Search Retrieval                           │
│  └─ Register: Function calling tools                          │
│                                                                 │
│  STEP 4: AI Processing                                         │
│  └─ Parse natural language query                              │
│  └─ Determine which tool(s) to call                           │
│  └─ Extract/infer parameters from user message                │
│                                                                 │
│  STEP 5: Tool Execution Decision                               │
│  └─ Identify: deploy_erc20 tool needed                        │
│  └─ Parameters: {                                              │
│       privateKey: "0x...",                                     │
│       name: "MyToken",                                         │
│       symbol: "MTK",                                           │
│       initialSupply: "1000000"                                 │
│     }                                                           │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ HTTP POST Request
                         │ URL: http://localhost:3000/token/deploy
                         │ Body: { privateKey, name, symbol, initialSupply, decimals }
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│                backend (Port 3000)                              │
│                BLOCKCHAIN OPERATIONS LAYER                      │
├─────────────────────────────────────────────────────────────────┤
│  STEP 6: Receive Blockchain Request                            │
│  └─ Endpoint: POST /token/deploy                               │
│  └─ Controller: tokenController.deployToken()                  │
│                                                                 │
│  STEP 7: Validate Request                                      │
│  └─ Check required fields (privateKey, name, symbol, etc.)     │
│  └─ Verify factory contract address configured                │
│                                                                 │
│  STEP 8: Blockchain Setup                                      │
│  └─ Connect to Arbitrum Sepolia RPC                           │
│  └─ Create wallet from private key                            │
│  └─ Check wallet balance for gas                              │
│                                                                 │
│  STEP 9: Prepare Transaction                                   │
│  └─ Convert name/symbol to bytes32                            │
│  └─ Connect to TokenFactory contract                          │
│  └─ Estimate gas costs                                        │
│                                                                 │
│  STEP 10: Execute Transaction                                  │
│  └─ Call: factory.createToken(name, symbol, decimals, supply) │
│  └─ Send transaction to blockchain                            │
│  └─ Wait for confirmation                                     │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ Blockchain Confirmation
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│              Arbitrum Sepolia Blockchain                        │
│  └─ Mine transaction                                           │
│  └─ Execute Stylus smart contract                             │
│  └─ Create token with ID                                      │
│  └─ Emit events                                               │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ Transaction Receipt
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│                backend (Port 3000)                              │
│  STEP 11: Process Receipt                                      │
│  └─ Parse transaction receipt                                  │
│  └─ Get token_id from return value                            │
│  └─ Fetch token info using getTokenInfo()                     │
│                                                                 │
│  STEP 12: Format Response                                      │
│  └─ Build success response with:                              │
│     - tokenId                                                  │
│     - transactionHash                                          │
│     - blockNumber                                              │
│     - gasUsed                                                  │
│     - creator address                                          │
│     - token info (name, symbol, decimals, supply)             │
│     - explorer URLs                                            │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ HTTP Response (JSON)
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│              n8n_agent_backend (Port 8000)                      │
│  STEP 13: Receive Backend Response                             │
│  └─ Store result in all_tool_results[]                        │
│                                                                 │
│  STEP 14: AI Post-Processing                                   │
│  └─ Send result back to Gemini                                │
│  └─ AI generates human-friendly response                      │
│                                                                 │
│  STEP 15: Check Sequential Flow                                │
│  └─ If next_tool exists → execute next tool                   │
│  └─ If no next_tool → finalize response                       │
│                                                                 │
│  STEP 16: Build Final Response                                 │
│  └─ agent_response: Natural language summary                   │
│  └─ tool_calls: List of all tools executed                    │
│  └─ results: All blockchain operation results                 │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ HTTP Response (JSON)
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                │
│  STEP 17: Display Results                                      │
│  └─ Show AI-generated message                                  │
│  └─ Display transaction hash & explorer link                  │
│  └─ Show token details                                         │
│  └─ Update UI state                                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔧 Tool Execution Mapping

### Available Tools in n8n_agent_backend:

| Tool Name | Backend Endpoint | Method | Purpose |
|-----------|-----------------|--------|---------|
| `deploy_erc20` | `/token/deploy` | POST | Deploy ERC20 token |
| `deploy_erc721` | `/nft/deploy-collection` | POST | Deploy NFT collection |
| `transfer` | `/transfer` | POST | Transfer ETH or tokens |
| `get_balance` | `/transfer/balance/:address` | GET | Get ETH balance |
| `fetch_price` | `/price/token` | POST | Get crypto prices (AI-powered) |

**Note**: The n8n_agent_backend uses **legacy endpoints** for backwards compatibility:
- `/deploy-token` → Should be `/token/deploy`
- `/deploy-nft-collection` → Should be `/nft/deploy-collection`
- `/balance/:address` → Should be `/transfer/balance/:address`

---

## 🔀 Sequential Tool Execution

The n8n_agent_backend supports **sequential workflows**:

### Example: Deploy Token → Transfer → Check Balance

```json
{
  "tools": [
    {"tool": "deploy_erc20", "next_tool": "transfer"},
    {"tool": "transfer", "next_tool": "get_balance"}
  ],
  "user_message": "Deploy MyToken with 1M supply, send 1000 to 0xRecipient, then check balance",
  "private_key": "0xYourPrivateKey"
}
```

**Execution Flow**:
1. AI calls `deploy_erc20` → Gets `tokenId`
2. AI automatically calls `transfer` using the new `tokenId`
3. AI automatically calls `get_balance` for recipient
4. Returns complete summary of all operations

---

## 📡 API Communication Details

### Frontend → n8n_agent_backend

**Endpoint**: `POST http://localhost:8000/agent/chat`

**Request Format**:
```json
{
  "tools": [
    {"tool": "deploy_erc20", "next_tool": null}
  ],
  "user_message": "Deploy a token called MyToken with symbol MTK and 1 million supply",
  "private_key": "0xYourPrivateKeyHere"
}
```

**Response Format**:
```json
{
  "agent_response": "I've successfully deployed your token MyToken (MTK) with 1 million initial supply. The token ID is 0 and the transaction has been confirmed on Arbitrum Sepolia.",
  "tool_calls": [
    {
      "tool": "deploy_erc20",
      "parameters": {
        "privateKey": "0x...",
        "name": "MyToken",
        "symbol": "MTK",
        "initialSupply": "1000000"
      }
    }
  ],
  "results": [
    {
      "success": true,
      "tool": "deploy_erc20",
      "result": {
        "success": true,
        "data": {
          "tokenId": "0",
          "transactionHash": "0xabc123...",
          "tokenInfo": {...}
        }
      }
    }
  ]
}
```

### n8n_agent_backend → backend

**Endpoint**: `POST http://localhost:3000/token/deploy`

**Request Format**:
```json
{
  "privateKey": "0xYourPrivateKeyHere",
  "name": "MyToken",
  "symbol": "MTK",
  "initialSupply": "1000000",
  "decimals": 18
}
```

**Response Format**:
```json
{
  "success": true,
  "data": {
    "message": "Token deployed successfully via Stylus TokenFactory",
    "tokenId": "0",
    "factoryAddress": "0xFactoryAddress",
    "transactionHash": "0xabc123...",
    "blockNumber": 12345,
    "gasUsed": "500000",
    "creator": "0xYourAddress",
    "tokenInfo": {
      "name": "MyToken",
      "symbol": "MTK",
      "decimals": 18,
      "totalSupply": "1000000",
      "creator": "0xYourAddress"
    },
    "explorerUrl": "https://sepolia.arbiscan.io/address/0xFactory...",
    "transactionUrl": "https://sepolia.arbiscan.io/tx/0xabc123..."
  }
}
```

---

## 🚀 Starting Both Backends

### Terminal 1: Start Blockchain Backend
```bash
cd backend
npm install
npm start
# Server runs on http://localhost:3000
```

### Terminal 2: Start AI Agent Backend
```bash
cd n8n_agent_backend
pip install -r requirements.txt
python main.py
# Server runs on http://localhost:8000
```

### Verify Both Are Running:
```bash
# Test blockchain backend
curl http://localhost:3000/health

# Test AI agent backend
curl http://localhost:8000/health
```

---

## 🔑 Environment Configuration

### backend/.env
```env
PORT=3000
TOKEN_FACTORY_ADDRESS=0xYourTokenFactoryAddress
NFT_FACTORY_ADDRESS=0xYourNFTFactoryAddress
GEMINI_API_KEY=your_gemini_key
```

### n8n_agent_backend/.env
```env
GEMINI_API_KEY=your_gemini_api_key_here
BACKEND_URL=http://localhost:3000
```

---

## 🎯 Key Differences Between Backends

| Feature | n8n_agent_backend | backend |
|---------|------------------|---------|
| **Language** | Python (FastAPI) | Node.js (Express) |
| **Purpose** | AI orchestration | Blockchain operations |
| **AI Model** | Google Gemini 2.0 | None (direct operations) |
| **Input** | Natural language | Structured JSON |
| **Processing** | Interprets intent | Executes transactions |
| **Output** | Conversational + Results | Raw blockchain data |
| **Dependencies** | Backend API | Arbitrum RPC |

---

## 🧩 How They Work Together

### Scenario: "Deploy a token and transfer to 3 addresses"

1. **Frontend** sends natural language request to **n8n_agent_backend**
2. **AI Agent (Gemini)** understands:
   - Need to deploy token first
   - Need to transfer to 3 addresses after
3. **n8n_agent_backend** calls **backend** → `POST /token/deploy`
4. **backend** deploys token on blockchain, returns `tokenId`
5. **n8n_agent_backend** stores result, AI knows `tokenId` now
6. **n8n_agent_backend** calls **backend** 3 times → `POST /transfer` (with tokenId)
7. **backend** executes each transfer transaction
8. **n8n_agent_backend** aggregates all results
9. **AI** generates human-friendly summary
10. **Frontend** receives complete report with all transaction details

---

## 🔧 Important Notes

### 1. **Backend URL Configuration**
The n8n_agent_backend needs to know where the blockchain backend is:
```python
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:3000")
```

### 2. **Endpoint Compatibility Issues**
The n8n_agent_backend uses **legacy endpoints**:
- `POST /deploy-token` (should be `/token/deploy`)
- `POST /deploy-nft-collection` (should be `/nft/deploy-collection`)
- `GET /balance/:address` (should be `/transfer/balance/:address`)

✅ **Solution**: The backend (`app.js`) already has legacy route compatibility built in!

### 3. **Token Identification**
- **New Implementation**: Uses `tokenId` (number)
- **Old Implementation**: Used `tokenAddress` (address)
- The n8n_agent_backend needs to be updated to use `tokenId` for transfers

### 4. **Private Key Handling**
- Frontend can pass `private_key` in request
- AI agent auto-injects it into blockchain operations
- Backend validates and uses it for transactions

---

## 🐛 Debugging Tips

### If request fails at n8n_agent_backend:
1. Check logs: `python main.py` (verbose output)
2. Verify GEMINI_API_KEY is set
3. Test direct backend API with curl
4. Check BACKEND_URL environment variable

### If request fails at backend:
1. Check if contracts are deployed (factory addresses)
2. Verify wallet has funds for gas
3. Check Arbitrum Sepolia RPC connectivity
4. Look at console logs for error details

### Test Connection Between Backends:
```bash
# From n8n_agent_backend
curl http://localhost:3000/health

# Should return:
# {"success": true, "data": {...}}
```

---

## 📊 Data Flow Summary

```
User Input (Natural Language)
         ↓
    AI Processing (Gemini)
         ↓
   Function Calling Decision
         ↓
  HTTP Request to Backend
         ↓
   Blockchain Transaction
         ↓
  Transaction Confirmation
         ↓
   Result Aggregation
         ↓
  AI Response Generation
         ↓
   Frontend Display
```

---

## 🎉 Benefits of This Architecture

1. **Separation of Concerns**
   - AI logic separate from blockchain logic
   - Easy to update either independently

2. **Natural Language Interface**
   - Users don't need to know technical details
   - AI interprets and executes correctly

3. **Sequential Workflows**
   - Complex multi-step operations automated
   - AI handles parameter passing between steps

4. **Reusability**
   - Backend can be used directly (without AI)
   - Frontend can call either backend

5. **Error Handling**
   - AI can explain errors in human terms
   - Backend provides technical details

6. **Scalability**
   - Add new blockchain operations to backend
   - Add new tools to AI agent
   - No frontend changes needed

---

## 🔄 Next Steps for Improvement

### 1. Update n8n_agent_backend Tool Definitions
Change from `tokenAddress` to `tokenId`:
```python
"transfer": {
    # ... existing code ...
    "tokenId": {"type": "string", "description": "Token ID (for ERC20 transfers)"}
}
```

### 2. Update Endpoint URLs
Change to new format:
```python
TOOL_DEFINITIONS = {
    "deploy_erc20": {
        "endpoint": f"{BACKEND_URL}/token/deploy",  # Updated
        # ...
    },
    # ...
}
```

### 3. Add More Tools
- `get_token_info` → `/token/info/:tokenId`
- `get_token_balance` → `/token/balance/:tokenId/:ownerAddress`
- `mint_nft` → `/nft/mint`
- `get_nft_info` → `/nft/info/:collectionAddress/:tokenId`

### 4. Frontend Integration
Update frontend to call:
```typescript
POST http://localhost:8000/agent/chat
```
Instead of calling backend directly.

---

**Last Updated**: November 23, 2025  
**Architecture Version**: 2.0  
**Networks**: Arbitrum Sepolia Testnet
