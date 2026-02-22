# BlockOps

> **Build blockchain agents without writing a single line of code.**

BlockOps is a no-code, AI-powered platform for building, deploying, and interacting with blockchain agents on **Arbitrum Sepolia**. It bridges the gap between complex on-chain operations and everyday users by combining a visual drag-and-drop workflow builder with **Gemini 2.0 Flash AI** — so anyone can automate blockchain tasks through natural language or a visual canvas.

---

## What It Does

BlockOps lets users create sophisticated blockchain automation workflows in minutes. Whether you want to deploy a token, launch an NFT collection, spin up an L3 Orbit chain, or orchestrate multi-step on-chain transactions, BlockOps handles the complexity under the hood.

---

## Available Tools & Automations

### Token Operations

| Tool | What It Does |
|---|---|
| **Deploy ERC-20 Token** | Deploy a custom ERC-20 token on Arbitrum Sepolia using gas-optimized Stylus (Rust → WASM) factory contracts. Configure name, symbol, decimals, and initial supply. |
| **Get Token Info** | Retrieve metadata for any deployed ERC-20 token — name, symbol, decimals, total supply, and creator address. |
| **Get Token Balance** | Check the ERC-20 token balance of any wallet address for a specific token. |

### NFT Operations

| Tool | What It Does |
|---|---|
| **Deploy ERC-721 Collection** | Launch a new NFT collection via the Stylus NFT Factory with custom name, symbol, and base URI for metadata (IPFS integration supported). |
| **Mint NFT** | Mint a new NFT in an existing collection to any wallet address. Supports batch minting and custom token URIs. |
| **Get NFT Info** | Query NFT ownership, token URI, and collection metadata for any collection and token ID. |

### Transfer & Balance

| Tool | What It Does |
|---|---|
| **Transfer ETH / ERC-20** | Send native ETH or any ERC-20 token between addresses with automatic gas estimation and balance checking. |
| **Get Wallet Balance** | Check the native ETH balance of any wallet address on Arbitrum Sepolia. |

### Token Approvals

| Tool | What It Does |
|---|---|
| **Approve Token Spending** | Approve a spender address to use ERC-20 tokens on your behalf. Supports unlimited/max approvals. |
| **Revoke Approval** | Revoke a previously granted token spending approval (sets allowance to zero). |
| **Check Allowance** | Query the current spending allowance between any owner-spender pair. |

### Wallet Utilities

| Tool | What It Does |
|---|---|
| **Wrap ETH → WETH** | Convert native ETH to Wrapped ETH (WETH) for use in DeFi protocols. |
| **Unwrap WETH → ETH** | Convert Wrapped ETH back to native ETH. |
| **Transaction Status** | Look up any transaction by hash — status, confirmations, gas used. |
| **Wallet History** | Fetch full transaction history for any address via Arbiscan API. |

### Price & Market Data

| Tool | What It Does |
|---|---|
| **Fetch Token Price** | AI-powered real-time crypto price lookups via CoinGecko. Supports multi-token queries ("btc eth sol" in one go), with 24h change, market cap, and volume data. |
| **Calculate** | Perform math operations with variables — useful for chaining with price and balance queries (e.g., compute portfolio value). |

### Smart Contract Interaction

| Tool | What It Does |
|---|---|
| **Contract Explorer** | Discover any verified contract — fetches ABI from Etherscan and lists all read/write functions, categorized. |
| **Natural Language Executor** | Speak natural language to interact with any smart contract. The AI maps your intent to the correct function call and executes it. |
| **Contract AI Chat** | Ask questions about any smart contract's ABI and get AI-powered explanations of what its functions do. |

### Orbit L3 Chain Deployment

| Tool | What It Does |
|---|---|
| **AI-Guided L3 Configuration** | A conversational AI walks you through configuring a custom Arbitrum Orbit L3 chain step-by-step — use case, chain name, parent chain, data availability mode, validator count, gas limits, block time, and more. |
| **Use-Case Presets** | Pre-built configuration templates for Gaming, DeFi, Enterprise, NFT, and General-purpose chains. |
| **Deploy L3 Chain** | Deploy the configured L3 chain with real-time deployment progress tracking. |
| **Config Management** | Save, load, update, validate, and delete L3 chain configurations. |

### Communication

| Tool | What It Does |
|---|---|
| **Send Email** | Send plain text, HTML, or attachment emails via Gmail SMTP. Supports CC, BCC, reply-to, and multiple recipients — useful for automated notifications in workflows. |

### Payments (x402 Protocol)

| Tool | What It Does |
|---|---|
| **USDC Payment Escrow** | On-chain payment escrow for premium agent features. USDC is held in escrow and released only on successful execution — automatic refunds on failure. |
| **AI Quota Tracking** | Track usage and spending per agent with per-tool pricing. |

---

## How It Works

Users have two ways to build agents:

**AI-Powered Generation** — describe your workflow in plain English and Gemini 2.0 Flash automatically selects, configures, and connects the right blockchain tools for you.

**Visual Builder** — drag and drop tools onto a React Flow canvas, connect them into a sequence, and configure parameters through a clean UI — no terminal, no code.

Once built, agents can be interacted with via a **chat interface** or called programmatically through a **REST API** using a personal API key.

### Intelligent Tool Routing

Under the hood, BlockOps uses an **AI-powered tool routing system** that:

1. **Analyzes** your natural language message to determine intent
2. **Plans execution** — decides which tools to call, in what order (sequential or parallel), and extracts parameters automatically
3. **Chains outputs** — passes results between sequential tools (e.g., get balance → fetch price → calculate total value)
4. **Handles missing info** — asks for any parameters it can't infer before executing
5. **Guards against off-topic requests** — rejects non-blockchain questions with regex + AI classification
6. **Falls back gracefully** — if the AI agent backend is unavailable, a direct tool executor handles requests locally

### AI Provider Chain

All AI operations use a cascading fallback pattern for reliability:

1. **Groq** (Primary) — Kimi K2 Instruct / Llama 3.3 70B
2. **Google Gemini** (Fallback) — Gemini 2.0 Flash
3. **OpenAI GPT-4** (Final fallback)

---

## Technical Architecture

BlockOps is a full-stack application composed of five services:

| Layer | Technology | Port |
|---|---|---|
| Frontend | Next.js 15, React 19, TypeScript, React Flow, Tailwind CSS | 3000 |
| Backend API | Express.js, ethers.js v6 | 3000 |
| AI Agent Service | FastAPI, Groq / Gemini with function calling | 8000 |
| Workflow Generator | FastAPI, Gemini 2.0 Flash | 8001 |
| Orbit AI Backend | FastAPI, Gemini 2.0 Flash (multi-turn conversational) | 8002 |
| Blockchain | Arbitrum Sepolia (Chain ID: 421614) | — |
| Smart Contracts | Arbitrum Stylus (Rust → WASM), Solidity | — |
| Auth | Privy (Web3 + Web2) | — |
| Database | Supabase (PostgreSQL) | — |

The smart contracts powering token and NFT deployment are written in **Rust and compiled to WASM** via Arbitrum Stylus — delivering significantly lower gas costs compared to traditional Solidity contracts.

Payments flow through a custom **PaymentEscrow contract** ([`0x185eba222e50dedae23a411bbbe5197ed9097381`](https://sepolia.arbiscan.io/address/0x185eba222e50dedae23a411bbbe5197ed9097381)) implementing the x402 protocol, with automatic refunds triggered on failed transactions.

---

## Key Highlights

- **Zero-code blockchain automation** — visual builder and AI generation lower the barrier to entry for on-chain operations
- **Stylus-powered contracts** — Rust-based ERC-20 and ERC-721 factories offer gas-efficient WASM execution on Arbitrum
- **Composable agent workflows** — chain multiple blockchain tools into sequential, automated pipelines
- **Natural language contract interaction** — talk to any verified smart contract in plain English
- **Orbit L3 chain deployment** — configure and deploy custom L3 chains through a conversational AI
- **Intelligent multi-tool execution** — AI plans and sequences complex operations with parameter passing between steps
- **API-first agents** — every agent exposes a REST API, enabling programmatic access from any external system
- **Secure key management** — encrypted private key storage in Supabase with backend-authorized payment execution
- **Pay-per-use model** — x402 USDC escrow ensures users only pay for actions that succeed
- **Email automation** — send notifications and reports as part of agent workflows
- **Multi-provider AI resilience** — cascading fallback across Groq, Gemini, and OpenAI

---

## Live Demo

| Resource | Link |
|---|---|
| Live App | [blockops.in](https://blockops.in) |
| Demo Video | [Google Drive](https://drive.google.com/drive/folders/137-DEv4MkspcmfuAN-ETsxpGMqzmZeZl?usp=sharing) |
| Payment Contract | [Arbiscan](https://sepolia.arbiscan.io/address/0x185eba222e50dedae23a411bbbe5197ed9097381) |

---

*Built on Arbitrum Sepolia · MIT License*