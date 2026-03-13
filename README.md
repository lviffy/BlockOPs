# BlockOps

## Introduction

**BlockOps** is a no-code AI-powered platform that enables users to build, deploy, and interact with blockchain agents on Arbitrum Sepolia. The platform combines a visual drag-and-drop workflow builder with AI-powered natural language processing, allowing users to create sophisticated blockchain automation workflows without writing any code.

The platform supports blockchain operations including **ERC-20 token deployment, ERC-721 NFT collection deployment, token transfers, and more**. All operations are powered by Arbitrum Stylus smart contracts and integrated with AI for intelligent agent interactions. Newer capabilities add Telegram bot control, n8n automation, DeFi/governance tooling, Orbit L3 planning, contract intelligence, and event webhooks.

> **Note:** This is a complete full-stack application including frontend (Next.js), backend API (Express.js), AI agent services (FastAPI), and smart contracts (Rust/Stylus).

## Resources

* **Live Demo**: [https://blockops.in/](https://blockops.in/)
* **Payment Contract**: [View on Arbiscan](https://sepolia.arbiscan.io/address/0x185eba222e50dedae23a411bbbe5197ed9097381)

### Key Technologies

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS, React Flow
- **Backend**: Express.js, ethers.js v6
- **AI Services**: FastAPI, llama 70b
- **Blockchain**: Arbitrum Sepolia, Stylus (Rust WASM contracts)
- **Authentication**: Privy Auth
- **Database**: Supabase (PostgreSQL)

---

## How to Use

Getting started with BlockOps is simple! Follow these steps:

1. **Visit** [https://blockops.in/](https://blockops.in/)
2. **Sign In** with Web3 wallet using Privy authentication
3. **Create or Import Agent Wallet** 
   - Create a new agent wallet (automatically generated)
   - Or import your own wallet using a private key

4. **Build Your Agent** - Choose your preferred method:
   
   **Option A: AI-Powered Generation**
   - Describe your agent in natural language
   - Gemini 2.0 Flash AI generates the complete workflow for you
   - AI automatically selects and configures the right tools
   
   **Option B: Visual Builder**
   - Drag and drop blockchain tools onto the canvas
   - Connect tools to create your workflow
   - Configure parameters for each tool
   - Use React Flow for visual workflow management

5. **Save Your Agent** to your database

6. **Interact with Your Agent**:
   - **UI Chat Interface**: Chat with your agent using natural language
   - **API Integration**: Use REST API calls with your unique API key
   - For premium features, payments are handled via x402 protocol with USDC escrow

7. **Execute Blockchain Actions** seamlessly on Arbitrum Sepolia

That's it! You've created your first BlockOps agent without writing a single line of code!

---

## Table of Contents

1. [Platform Architecture](#platform-architecture)
2. [System Components](#system-components)
  - [Frontend](#frontend)
  - [Backend API](#backend-api)
  - [AI & Automation Services](#ai--automation-services)
3. [Feature Highlights](#feature-highlights)
4. [Available Blockchain & AI Tools](#available-blockchain--ai-tools)
5. [Smart Contract Implementations](#smart-contract-implementations)
6. [Setup & Installation](#setup--installation)
7. [Environment Configuration](#environment-configuration)
8. [API Documentation](#api-documentation)
9. [Docker Support](#docker-support)
10. [Project Structure](#project-structure)
11. [Contributing](#contributing)
12. [License](#license)
13. [Support](#support)
14. [Acknowledgments](#acknowledgments)

---

## Platform Architecture

### High-Level Architecture Diagram

```mermaid
graph TB
    subgraph "User Layer"
  U[👤 User Browser]
  UI[🖥️ Next.js Frontend<br/>Port: 3000]
  TG[🤝 Telegram Bot]
    end
    
    subgraph "Authentication & Database"
        PRIVY[🔐 Privy Auth]
        SUPA[🗄️ Supabase Database]
    end
    
    subgraph "Backend Services"
        AI[🤖 AI Agent Backend<br/>FastAPI]
        BK[⚙️ Blockchain Backend<br/>Express - Port 3000]
        WF[🔄 Workflow Generator<br/>FastAPI - Port 8001]
        N8N[⚡ N8n Agent Backend<br/>FastAPI]
        WBK[📣 Webhook Dispatcher]
    end

    subgraph "L3 Builder"
        ORB[🪐 Orbit Config Engine<br/>FastAPI]
    end
    
    subgraph "Blockchain Layer"
        ARB[🔗 Arbitrum Sepolia<br/>Chain ID: 421614]
    end
    
    subgraph "Smart Contracts"
        TF[📝 Token Factory<br/>Stylus Contract]
        NF[🎨 NFT Factory<br/>Stylus Contract]
        PE[💰 Payment Escrow<br/>x402 Protocol]
        USDC[💵 USDC Token]
    end
    
    U -->|User Actions| UI
    UI <-->|Authentication| PRIVY
    UI <-->|Data Storage| SUPA
    UI -->|AI Chat/Generate| AI
    UI -->|Workflow Build| WF
    UI -->|Automation| N8N
    TG -->|Bot Commands| BK
    AI -->|Tool Execution| BK
    BK -->|Event Webhooks| WBK
    BK -->|Deploy/Transfer| ARB
    ARB -->|Token Deploy| TF
    ARB -->|NFT Deploy| NF
    ARB -->|Payments| PE
    ORB -->|L3 Config| BK
    PE -->|USDC Escrow| USDC
```

### Data Flow Diagram

```mermaid
sequenceDiagram
    actor User
    participant Frontend
    participant AI
    participant Backend
    participant Blockchain
    
    User->>Frontend: Describe workflow
    Frontend->>AI: POST /agent/chat
    AI->>AI: Process with Gemini 2.0
    AI->>AI: Identify tools & parameters
    
    loop For each tool
        AI->>Backend: Execute tool endpoint
        Backend->>Blockchain: Sign & send transaction
        Blockchain-->>Backend: Transaction confirmed
        Backend-->>AI: Tool result
    end
    
    AI->>AI: Format response
    AI-->>Frontend: Results with transaction hashes
    Frontend-->>User: Display results
```

---

## System Components

### Frontend

**Technology Stack:**
- Next.js 15 (React 19)
- TypeScript
- React Flow (visual workflow builder)
- Tailwind CSS + Radix UI components
- Privy for authentication
- Supabase client for database

**Key Features:**
- Visual drag-and-drop workflow builder
- Node-based tool configuration
- Real-time AI chat interface
- Workflow saving and loading
- Agent management dashboard
- x402 protocol payment integration

**Main Pages:**
- `/` - Landing page
- `/agent-builder` - Visual workflow builder
- `/my-agents` - Agent management
- `/agent/:id` - Agent interaction interface
- `/payment-demo` - Payment testing interface

**Port:** 3000 (development)

### Backend API

**Technology Stack:**
- Express.js
- ethers.js v6 for Ethereum interactions
- Axios for HTTP requests
- OpenAI/Gemini SDK for AI features

**Network:**
- Arbitrum Sepolia RPC: `https://sepolia-rollup.arbitrum.io/rpc`
- Explorer: `https://sepolia.arbiscan.io`
- Chain ID: 421614

**Key Responsibilities:**
- Blockchain interaction via ethers.js
- Token/NFT deploy + mint (Stylus factories)
- Wallet ops: transfers, approvals, permit, balance checks
- DeFi suite: Aave v3 deposit/withdraw/claim/APY
- DEX swaps (Uniswap v3), bridging (L1↔L2 retryables), gas estimation/simulation
- Governance tools: proposals, voting, delegation
- Batch + scheduled transfers, session-based signing, portfolio analytics
- Contract intelligence: ABI fetch, NL executor, contract chat, safety checks
- Webhook dispatcher (HMAC-signed) and event logs

**Main Endpoint Families:**
- `/token/*`, `/nft/*`, `/transfer/*`, `/allowance/*`, `/permit`
- `/batch/*`, `/schedule/*`, `/signing/*`
- `/defi/*` (Aave), `/swap/*`, `/bridge/*`, `/price/*`
- `/governance/*`, `/portfolio/*`, `/ens/*`, `/gas/*`, `/chain/*`
- `/nl-executor/*`, `/contract-chat/*`, `/safety/*`, `/webhooks/*`

**Port:** 3000 (default)

### AI & Automation Services

- **AI Agent + Workflow Backend (FastAPI, 8001)** — Natural-language to tool execution and workflow generation in one service: `POST /agent/chat`, `GET /tools`, `POST /create-workflow`, `GET /available-tools`.
- **N8n Agent Backend (FastAPI, 8000)** — Builds and manages n8n workflows (`/n8n/workflows`, activate/deactivate, tool→node mapper) so BlockOps workflows can run in n8n. Configurable via `PORT`.
- **Orbit AI Backend (FastAPI)** — Multi-turn L3 config assistant (`/api/orbit-ai/chat`, `/api/orbit-ai/presets`) used by Orbit chain builder.
- **Webhook Dispatcher** — HMAC-SHA256 signed delivery with retry/backoff; event types include tx status, balance thresholds, agent chat, mint/deploy.
- **Telegram Bot Service** — Agent linking + chat commands (`/connect`, `/disconnect`, `/agent`, `/switch`), with Supabase-backed `linked_agent_id` and API key hashing.

---

## Feature Highlights

- **Agent management** — Full CRUD with clone/update/regenerate API keys, avatars, public/private visibility, and Telegram linkage tracking.
- **Telegram bot** — Connect/disconnect agents, chat through Telegram, and route free-text to linked agents (see [TELEGRAM_AGENT_LINKING.md](TELEGRAM_AGENT_LINKING.md)).
- **Automation** — Batch transfers/mints/approvals, cron-based scheduled transfers, and session-based signing with encrypted keys.
- **n8n workflow bridge** — Auto-generate n8n JSON workflows from BlockOps tools and manage/activate them through the FastAPI proxy.
- **Webhooks** — HMAC-signed event notifications (tx sent/confirmed/failed, price and balance thresholds, agent chat, mint/deploy) with retry/backoff and delivery logs.
- **DeFi + DEX** — Aave v3 deposit/withdraw/claim/APY plus Uniswap v3 swap/quote with slippage controls.
- **Governance** — OZ Governor-compatible proposal creation, voting, delegation, and proposal listing.
- **Cross-chain** — Arbitrum bridge deposit/withdraw/retryable status plus chain queries, gas estimation, and full calldata/revert decoding.
- **Contract intelligence** — Natural-language executor (ABI discovery + NL → function calls), contract chat Q&A, contract safety scoring, and Etherscan ABI handling.
- **Data & wallets** — Portfolio analytics (tokens, NFTs, USD values), ENS/ARBID resolve + reverse, price history/OHLCV, and advanced gas simulation/history.
- **Orbit L3 builder** — AI-guided L3 configuration presets and deployment status checks.

## Available Blockchain & AI Tools

### Core Deploy & Transfer
- Deploy ERC-20 via Stylus TokenFactory: `POST /token/deploy`
- Deploy ERC-721 collections: `POST /nft/deploy-collection`
- Transfer ETH/ERC-20: `POST /transfer`
- Batch transfer/mint/approve: `/batch/*`
- Scheduled transfers with cron + Supabase persistence: `/schedule/*`

### Contract Intelligence
- Natural-language executor (ABI discovery + NL → call): `/nl-executor/*`
- Contract chat Q&A: `POST /contract-chat/ask`
- Safety/risk scoring: `POST /safety/check`
- ABI/tx decoding and revert decoding: `/chain/decode/*`

### Automation & Signing
- Session-based signing with encrypted keys: `/signing/session`
- Permit (EIP-2612) support: `POST /permit`
- Allowance approve/revoke/check: `/allowance/*`

### DeFi, DEX, and Markets
- Aave v3: deposit, withdraw, claim, APY, account info: `/defi/*`
- Uniswap v3 swaps + quotes with slippage: `/swap/*`
- Price and OHLCV history: `/price/history/:coin`, `/price/chart/:coin`

### Governance
- Create proposals, vote, delegate, and list proposals: `/governance/*`

### Cross-Chain & Network
- Arbitrum bridge deposit/withdraw/retryable + status: `/bridge/*`
- Gas estimate/simulate/history: `/gas/*`
- Chain data: tx/receipt/block lookups, event queries, address tx history: `/chain/*`

### Wallet, Identity, and Data
- Portfolio analytics (ETH, ERC20, ERC721, USD valuation): `GET /portfolio/:address`
- ENS/ARBID resolve + reverse + batch: `/ens/*`
- Price alerts + balance threshold webhooks via `/webhooks/*`

### AI & Workflow
- AI agent chat + tool execution: `POST /agent/chat`
- Workflow generation: `POST /create-workflow`
- n8n workflow builder/proxy: `/n8n/workflows` CRUD + activate

### Payments
- x402 protocol USDC escrow via PaymentEscrow contract; backend authorization + automatic refunds.

---

## Smart Contract Implementations

### TokenFactory (Stylus - Rust)

**Location:** `contract/token_factory/`

**Technology:** Arbitrum Stylus (Rust → WASM)

**Key Features:**
- Full ERC-20 standard implementation
- Gas-optimized WASM execution
- Factory pattern for easy deployment
- Customizable token parameters

**Main Functions:**
```rust
// Initialize new token
pub fn initialize(&mut self, name: String, symbol: String, decimals: u8, initial_supply: U256)

// Standard ERC-20 functions
pub fn transfer(&mut self, to: Address, amount: U256) -> bool
pub fn approve(&mut self, spender: Address, amount: U256) -> bool
pub fn transfer_from(&mut self, from: Address, to: Address, amount: U256) -> bool

// View functions
pub fn balance_of(&self, account: Address) -> U256
pub fn total_supply(&self) -> U256
pub fn allowance(&self, owner: Address, spender: Address) -> U256
```

**Build & Deploy:**
```bash
cd contract/token_factory
cargo stylus check
cargo stylus deploy --private-key=$PRIVATE_KEY
```

### NFTFactory (Stylus - Rust)

**Location:** `contract/nft_factory/`

**Technology:** Arbitrum Stylus (Rust → WASM)

**Key Features:**
- Full ERC-721 standard implementation
- Batch minting support
- Custom metadata URIs
- Gas-efficient WASM execution

**Main Functions:**
```rust
// Initialize collection
pub fn initialize(&mut self, name: String, symbol: String, base_uri: String)

// Minting
pub fn mint(&mut self, to: Address) -> U256
pub fn mint_batch(&mut self, to: Address, amount: U256)

// Standard ERC-721 functions
pub fn transfer_from(&mut self, from: Address, to: Address, token_id: U256)
pub fn approve(&mut self, to: Address, token_id: U256)
pub fn set_approval_for_all(&mut self, operator: Address, approved: bool)

// View functions
pub fn owner_of(&self, token_id: U256) -> Address
pub fn balance_of(&self, owner: Address) -> U256
pub fn token_uri(&self, token_id: U256) -> String
```

**Build & Deploy:**
```bash
cd contract/nft_factory
cargo stylus check
cargo stylus deploy --private-key=$PRIVATE_KEY
```

### PaymentEscrow (Solidity)

**Location:** `contract/payment-contracts/contracts/PaymentEscrow.sol`

**Contract Address:** `0x185eba222e50dedae23a411bbbe5197ed9097381`

**Technology:** Solidity + Hardhat

**Key Features:**
- x402 protocol implementation
- USDC escrow for premium features
- Automatic refunds on failure
- Authorization for backend execution
- Pausable functionality

**Main Functions:**
```solidity
// Create payment agreement
function createPayment(
    string memory agentId,
    string memory toolName,
    address token,
    uint256 amount
) external payable returns (bytes32)

// Execute payment (backend only)
function executePayment(bytes32 paymentId) external

// Refund payment (backend only)
function refundPayment(bytes32 paymentId) external

// Admin functions
function setSupportedToken(address token, bool supported) external onlyOwner
function setAuthorizedBackend(address backend, bool authorized) external onlyOwner
```

**Deploy:**
```bash
cd contract/payment-contracts
npx hardhat run scripts/deploy.js --network arbitrumSepolia
```

---

## Setup & Installation

### Prerequisites

- Node.js 18+ 
- Python 3.9+
- Rust (for Stylus contracts)
- npm or yarn
- Git

### Clone Repository

```bash
git clone <repository-url>
cd n8nrollup
```

### Frontend Setup

```bash
cd frontend
npm install
cp .env.example .env.local
# Edit .env.local with your configuration
npm run dev
```

Frontend will run on `http://localhost:3000`

### Backend Setup

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your configuration
npm run dev
```

Backend will run on `http://localhost:3000`

### AI Agent / Workflow Backend (FastAPI) Setup

```bash
cd AI_workflow_backend
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your Gemini/Groq keys
uvicorn main:app --reload --port 8001
```

Service will run on `http://localhost:8001`

### N8n Agent Backend (FastAPI) Setup

```bash
cd n8n_agent_backend
pip install -r requirements.txt
cp .env.example .env
# Configure GROQ_API_KEY* or GEMINI_API_KEY and BACKEND_URL
uvicorn main:app --reload --port 8000
```

Service will run on `http://localhost:8000` (set `PORT` to change)

### Orbit AI Backend Setup

```bash
cd orbit_ai_backend
pip install -r requirements.txt
cp .env.example .env
# Configure L3 presets and backend URL
PORT=8002 uvicorn main:app --reload --port 8002
```

Service will run on `http://localhost:8002` (configurable via `PORT`)

### Smart Contract Deployment

**Token Factory (Stylus):**
```bash
cd contract/token_factory
cargo stylus check
cargo stylus deploy --private-key-path=.env
```

**NFT Factory (Stylus):**
```bash
cd contract/nft_factory
cargo stylus check
cargo stylus deploy --private-key-path=.env
```

**Payment Contract (Solidity):**
```bash
cd contract/payment-contracts
npm install
npx hardhat run scripts/deploy.js --network arbitrumSepolia
```

---

## Environment Configuration

### Frontend (.env.local)

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key

# Privy Authentication
NEXT_PUBLIC_PRIVY_APP_ID=your_privy_app_id

# Blockchain
NEXT_PUBLIC_RPC_URL=https://sepolia-rollup.arbitrum.io/rpc
NEXT_PUBLIC_CHAIN_ID=421614

# Payment Contract
NEXT_PUBLIC_PAYMENT_CONTRACT_ADDRESS=0x185eba222e50dedae23a411bbbe5197ed9097381
NEXT_PUBLIC_USDC_ADDRESS=your_usdc_token_address

# Backend URLs
NEXT_PUBLIC_BACKEND_URL=http://localhost:3000
NEXT_PUBLIC_AI_BACKEND_URL=http://localhost:8001
NEXT_PUBLIC_WORKFLOW_BACKEND_URL=http://localhost:8001
NEXT_PUBLIC_N8N_BACKEND_URL=http://localhost:8000
NEXT_PUBLIC_ORBIT_BACKEND_URL=http://localhost:8002

# Payment Backend
PAYMENT_BACKEND_PRIVATE_KEY=your_backend_private_key
JWT_SECRET=your_jwt_secret
```

### Backend (.env)

```env
# Server
PORT=3000

# Blockchain
ARBITRUM_SEPOLIA_RPC=https://sepolia-rollup.arbitrum.io/rpc
TOKEN_FACTORY_ADDRESS=your_token_factory_address
NFT_FACTORY_ADDRESS=your_nft_factory_address

# API Keys
GEMINI_API_KEY=your_gemini_api_key
OPENAI_API_KEY=your_openai_api_key
ETHERSCAN_API_KEY=your_etherscan_api_key
PINATA_API_KEY=your_pinata_api_key
PINATA_SECRET_KEY=your_pinata_secret_key
```

### AI Services (.env)

```env
# Gemini AI
GEMINI_API_KEY=your_gemini_api_key

# Optional Groq
GROQ_API_KEY=your_groq_key

# Backend URL
BACKEND_URL=http://localhost:3000
```

### N8n Agent Backend (.env)

```env
# LLMs
GROQ_API_KEY1=your_primary_groq_key
GROQ_API_KEY2=optional_secondary_key
GEMINI_API_KEY=optional_fallback_key

# Target backend (Express API)
BACKEND_URL=http://localhost:3000

# Service port (optional)
PORT=8000
```

### Orbit AI Backend (.env)

```env
PORT=8002
BACKEND_URL=http://localhost:3000
LOG_LEVEL=info
```

---

## API Documentation

### AI Agent Chat Endpoint

**POST** `/agent/chat`

Process natural language messages and execute blockchain actions.

**Request:**
```json
{
  "user_message": "Deploy a token called MyToken with symbol MTK",
  "tools": ["deploy_erc20", "transfer", "mint_nft"],
  "private_key": "0x..."
}
```

**Response:**
```json
{
  "message": "Token deployed successfully!",
  "results": {
    "tokenAddress": "0x...",
    "transactionHash": "0x...",
    "explorerUrl": "https://sepolia.arbiscan.io/tx/0x..."
  },
  "tool_used": "deploy_erc20"
}
```

### Workflow Generation Endpoint

**POST** `/create-workflow`

Generate workflow structure from natural language description.

**Request:**
```json
{
  "description": "Create a workflow that deploys a token and then transfers it to multiple addresses"
}
```

**Response:**
```json
{
  "workflow": {
    "nodes": [
      {
        "id": "1",
        "type": "agent",
        "data": { "label": "Start" }
      },
      {
        "id": "2",
        "type": "tool",
        "data": { 
          "tool": "deploy_erc20",
          "label": "Deploy Token"
        }
      },
      {
        "id": "3",
        "type": "tool",
        "data": { 
          "tool": "transfer",
          "label": "Transfer Tokens"
        }
      }
    ],
    "edges": [
      { "source": "1", "target": "2" },
      { "source": "2", "target": "3" }
    ]
  }
}
```

### Token Deployment Endpoint

**POST** `/token/deploy`

Deploy a new ERC-20 token using Stylus.

**Request:**
```json
{
  "name": "MyToken",
  "symbol": "MTK",
  "decimals": 18,
  "initialSupply": "1000000",
  "privateKey": "0x..."
}
```

**Response:**
```json
{
  "success": true,
  "tokenAddress": "0x...",
  "transactionHash": "0x...",
  "explorerUrl": "https://sepolia.arbiscan.io/tx/0x...",
  "tokenInfo": {
    "name": "MyToken",
    "symbol": "MTK",
    "decimals": 18,
    "totalSupply": "1000000000000000000000000"
  }
}
```

### NFT Collection Deployment Endpoint

**POST** `/nft/deploy-collection`

Deploy a new ERC-721 NFT collection using Stylus.

**Request:**
```json
{
  "name": "MyNFT Collection",
  "symbol": "MNFT",
  "baseUri": "ipfs://QmXxx/",
  "privateKey": "0x..."
}
```

**Response:**
```json
{
  "success": true,
  "collectionAddress": "0x...",
  "transactionHash": "0x...",
  "explorerUrl": "https://sepolia.arbiscan.io/address/0x..."
}
```

---

## Docker Support

The project includes Docker Compose configuration for easy deployment.

### Run All Services

```bash
docker-compose up -d
```

This will start:
- Frontend (Next.js) on port 3000
- Backend (Express) on port 3000
- AI Agent / Workflow Backend (FastAPI) on port 8001
- N8n Agent Backend (FastAPI) on port 8000
- Orbit AI Backend (FastAPI) on port 8002

### Individual Services

```bash
# Frontend only
docker-compose up frontend

# Backend only
docker-compose up backend

# AI services
docker-compose up ai-agent workflow-generator

# Automation services (see docker-compose.yml for service names)
docker-compose up <service-name>
```

---

## Project Structure

```
BlockOPs/
├── frontend/                 # Next.js frontend application
│   ├── app/                 # Next.js app directory
│   │   ├── agent-builder/  # Visual workflow builder
│   │   ├── my-agents/      # Agent management
│   │   └── api/            # API routes
│   ├── components/          # React components
│   ├── lib/                # Utilities and helpers
│   └── package.json
│
├── backend/                 # Express.js backend API
│   ├── controllers/         # Request handlers
│   ├── routes/             # API routes
│   ├── config/             # Configuration files
│   │   ├── abis.js        # Contract ABIs
│   │   └── constants.js   # Network constants
│   ├── utils/              # Utility functions
│   └── package.json
│
├── AI_workflow_backend/     # FastAPI AI agent service
│   ├── main.py             # Main FastAPI application
│   └── requirements.txt
│
├── n8n_agent_backend/       # FastAPI n8n workflow builder/proxy
│   ├── main.py             # Main FastAPI application
│   └── requirements.txt
│
├── orbit_ai_backend/        # FastAPI Orbit L3 config assistant
│   ├── main.py             # Main FastAPI application
│   └── requirements.txt
│
├── contract/                # Smart contracts
│   ├── token_factory/      # Stylus ERC-20 factory (Rust)
│   ├── nft_factory/        # Stylus ERC-721 factory (Rust)
│   └── payment-contracts/  # Payment escrow (Solidity)
│
├── docker-compose.yml       # Docker orchestration
├── README.md               # This file
└── WORKFLOW_DIAGRAM.md     # Detailed workflow diagrams
```

---

## Key Features

### 🤖 AI & Workflow
- Natural-language chat → tool execution with Gemini/Groq
- Workflow generator + React Flow builder
- n8n workflow auto-builder and activation controls

### 🧩 Agent Management
- CRUD agents, clone/update, regenerate API keys (hashed), avatars
- Public/private agents with Telegram linkage metadata

### ⚡ Automation
- Batch transfers/mints/approvals and cron-based scheduled transfers
- Session-based signing with encrypted keys and expirations

### 📣 Integrations
- Telegram bot connect/disconnect/agent switching
- HMAC-signed webhooks with retries, delivery logs, and rich event types

### 💸 DeFi, DEX, Payments
- Aave v3 deposit/withdraw/claim/APY, Uniswap v3 swaps/quotes
- x402 USDC escrow with backend authorization and refunds

### 🗳️ Governance & Bridge
- OZ Governor-compatible proposal lifecycle (create, list, vote, delegate)
- Arbitrum bridge deposit/withdraw/retryable status + cross-chain queries

### 🔍 Contract Intelligence
- NL contract executor, contract chat Q&A, ABI fetch, calldata/revert decode
- Contract safety scoring and risk-level reporting

### 📊 Data & Identity
- Portfolio analytics (tokens + NFTs + USD), ENS/ARBID resolve/reverse
- Gas estimate/simulate/history, price history/OHLCV charts

---

## Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## License

This project is licensed under the MIT License - see the LICENSE file for details.

---

## Support

For support, please:
- Open an issue on GitHub
- Contact the development team
- Check the documentation in `WORKFLOW_DIAGRAM.md`

---

## Acknowledgments

- **Arbitrum** for Stylus technology
- **Google** for Gemini AI
- **Privy** for authentication infrastructure
- **Supabase** for database and backend services
- **Vercel** for hosting and deployment

---

**Built with ❤️ on Arbitrum Sepolia**
