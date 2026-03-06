# BlockOps — Pending Features & Roadmap

> Last updated: March 6, 2026  
> Legend: 🔴 Critical · 🟠 High · 🟡 Medium · 🟢 Nice-to-have

---

## What's Already Implemented

| Area | Status |
|---|---|
| ERC20 deploy, info, balance | ✅ Done |
| ERC721 deploy, mint, info | ✅ Done |
| ETH/Token transfer | ✅ Done |
| WETH wrap/unwrap | ✅ Done |
| ERC20 approve / check / revoke allowance | ✅ Done |
| Crypto price fetch (CoinGecko, NLP-powered) | ✅ Done |
| Send email (Gmail/nodemailer) | ✅ Done |
| Contract chat (AI talks to any verified contract via Etherscan ABI) | ✅ Done |
| Natural Language contract executor | ✅ Done |
| Conversation memory (Supabase) | ✅ Done |
| AI tool routing (Groq × 3 keys + Gemini fallback) | ✅ Done |
| Orbit L3 config builder (backend + AI backend) | ✅ Done |
| AI workflow generator (FastAPI) | ✅ Done |
| Visual drag-and-drop agent builder (React Flow) | ✅ Done |
| Privy Auth (wallet login) | ✅ Done |
| x402 payment demo (USDC escrow) | ✅ Done |
| API docs page | ✅ Done |
| Docker Compose setup | ✅ Done |

---

## 🔴 Critical — Fix Before Shipping

### 1. Factory Contract Addresses Are Zero
**File:** `backend/.env`  
Both `TOKEN_FACTORY_ADDRESS` and `NFT_FACTORY_ADDRESS` are `0x000...000`.  
Token deploy and NFT deploy calls will silently fail or write to a dead address.

- [ ] Deploy Stylus contracts to Arbitrum Sepolia
- [ ] Update `.env` with real addresses
- [ ] Add startup check that warns if addresses are still zero

---

### 2. Private Keys Passed in Plain HTTP Body
**Files:** `directToolExecutor.js`, `transferController.js`, `tokenController.js`, `nftController.js`  
Every tool that signs transactions receives `privateKey` in the JSON body — this is logged, stored in conversation history, and sent over HTTP.

- [ ] Introduce **session-based signing**: store the private key server-side in a short-lived encrypted session (Redis/encrypted Supabase row), return a `sessionToken`, and use that token for subsequent calls
- [ ] Never log or persist messages that contain a raw private key
- [ ] Add EIP-712 typed-data signer endpoint as an alternative

---

### 3. No API Authentication on Public Endpoints ✅
**File:** `backend/app.js`  
All routes are open. Any caller can drain wallets, spam emails, or consume AI quota.

- [x] Add API-key middleware (`x-api-key` header) per agent, tied to Supabase `agents` table
- [x] Add rate limiting (`express-rate-limit` or Upstash Ratelimit)
- [x] Add IP-level throttle for `/price` and `/chat` endpoints

---

### 4. n8n Backend Is Skeleton Only
**File:** `n8n_agent_backend/main.py`  
The n8n backend exists but has no actual n8n workflow CRUD logic or webhook trigger.

- [ ] Implement n8n REST API proxy (create/trigger/delete workflows)
- [ ] Map BlockOps tools to n8n nodes
- [ ] Wire n8n webhook triggers back to BlockOps agents

---

## 🟠 High Priority — Core Missing Features

### 5. Webhook System ✅
Currently BlockOps has zero event-driven output — no way for external systems to receive notifications when something happens.

**New service: `backend/services/webhookService.js`**
- [x] `POST /webhooks/register` — register a URL + event types per agent
- [x] `GET /webhooks` — list registered webhooks
- [x] `DELETE /webhooks/:id` — delete a webhook
- [x] `POST /webhooks/test/:id` — send a test payload
- [x] Event types to support:
  - `tx.sent` — emitted after every signed transaction
  - `tx.confirmed` — after receipt arrives
  - `tx.failed` — revert / timeout
  - `balance.below_threshold` — when ETH balance drops under a set value
  - `price.threshold` — when a token crosses a configured price
  - `agent.chat_message` — every inbound user message
  - `nft.minted` — after successful mint
  - `token.deployed` — after successful ERC20 deploy
- [x] Retry with exponential backoff (3 attempts, 1s/5s/30s)
- [x] HMAC-SHA256 signature on every outbound payload (`X-BlockOps-Signature` header)
- [x] Webhook delivery log stored in Supabase

---

### 6. DEX Swap Tool ✅
No swap functionality exists at all. Uniswap v3 on Arbitrum Sepolia is already deployed.

- [x] `POST /swap` — swap any token pair via Uniswap V3 router
  - params: `privateKey`, `tokenIn`, `tokenOut`, `amountIn`, `slippageTolerance`
- [x] Fetch best route (quote from Quoter contract)
- [x] `GET /swap/quote` — dry-run quote endpoint (no tx sent)
- [x] Add to tool router as `swap_tokens` and `get_swap_quote`
- [x] Price impact warning if quote returns zero output

---

### 7. L1 ↔ L2 Bridge Tool ✅
Users want to move ETH/tokens between Ethereum and Arbitrum.

- [x] `POST /bridge/deposit` — deposit ETH/ERC20 to Arbitrum via Inbox contract
- [x] `POST /bridge/withdraw` — initiate withdrawal from Arbitrum to L1
- [x] `GET /bridge/status/:txHash` — retryable ticket status
- [x] `POST /bridge/retryable` — re-execute failed retryable ticket
- [x] Add `bridge_deposit` / `bridge_withdraw` / `bridge_status` to NLP tool router

---

### 8. Batch / Multicall Tool ✅
High user value for airdrops and bulk ops.

- [x] `POST /batch/transfer` — send ETH to multiple addresses in one call (Multicall3)
- [x] `POST /batch/transfer-erc20` — send ERC20 token to multiple addresses
- [x] `POST /batch/mint` — mint to multiple recipients
- [x] `POST /batch/approve` — batch approvals
- [x] Expose as `batch_transfer` / `batch_mint` NLP tools

---

### 9. Blockchain Event / Transaction Lookup ✅
~~No way to query on-chain history.~~

- [x] `GET /chain/tx/:hash` — transaction details + decoded input + revert reason
- [x] `GET /chain/tx/:hash/receipt` — full receipt
- [x] `GET /chain/events` → `POST /chain/events` — fetch contract events via `eth_getLogs`
- [x] `GET /chain/block/:number` — block info (`latest` supported)
- [x] `POST /chain/decode/calldata` — decode calldata from ABI
- [x] `POST /chain/decode/revert` — human-readable revert reason decoder (Error/Panic/raw)
- [x] `GET /chain/address/:address/txs` — recent transactions via Etherscan
- [x] NLP tools: `lookup_transaction`, `fetch_events`, `lookup_block`, `decode_revert`

---

### 10. Portfolio / Wallet Analytics ✅
~~Current balance endpoint only returns ETH. No token or NFT breakdown.~~

- [x] `GET /portfolio/:address` — ETH balance + USD value
- [x] All ERC20 holdings (live on-chain balance via Etherscan transfer history → `balanceOf`)
- [x] All NFT holdings (ERC721, derived from transfer history)
- [x] USD values per token (CoinGecko)
- [x] Total portfolio USD value
- [x] `get_portfolio` NLP tool added

---

### 11. ENS / ARBID Resolution ✅
~~No address ↔ name resolution.~~

- [x] `GET /ens/resolve/:name` — resolve ENS/ARBID name → address (uses Ethereum mainnet for ENS registry)
- [x] `GET /ens/reverse/:address` — reverse lookup address → primary ENS name
- [x] `POST /ens/resolve-many` — batch resolve up to 20 names
- [x] `resolveAddressOrName()` utility exported for use in other controllers
- [x] `resolve_ens` NLP tool added

---

### 12. Gas Estimator / Priority Fee Tool ✅
~~No advanced gas tooling.~~

- [x] `GET /gas/estimate` — current base fee + slow/normal/fast priority fee tiers with estimated tx costs
- [x] `POST /gas/simulate` — estimate gas units for a specific call before sending (reverts surfaced with reason)
- [x] `GET /gas/history` — base fee trend over last N blocks (up to 50)
- [x] `estimate_gas` + `simulate_gas` NLP tools added

---

## 🟡 Medium Priority — DeFi & Automation

### 13. Telegram Bot Integration ✅
Agents should be reachable via Telegram, not just REST/chat UI.

- [x] New service: `backend/services/telegramService.js`
- [x] Register bot via BotFather, store `chatId` per user in Supabase (`telegram_users` table)
- [x] Commands: `/start`, `/balance <address>`, `/price <token>`, `/status <txHash>`, `/help`
- [x] Agents forward Telegram messages into the existing `chatWithAI` pipeline
- [x] Webhook notifications can also be sent to Telegram via `fireToTelegram(chatId, text)`
- [x] Long-polling in dev, webhook mode in prod (`TELEGRAM_WEBHOOK_URL` env var)
- [x] Admin endpoints: `GET /telegram/info`, `POST /telegram/send`, `POST /telegram/register-webhook`

---

### 14. Scheduled / Recurring Transfers (Automation) ✅
No cron/schedule capability.

- [x] `POST /schedule/transfer` — schedule a one-time or recurring transfer
  - params: `cronExpression` (5-field cron or ISO datetime), `toAddress`, `amount`, `privateKey`, `tokenAddress` (optional), `label` (optional)
- [x] `GET /schedule` — list all scheduled jobs
- [x] `GET /schedule/:id` — get single job with last 10 execution logs
- [x] `DELETE /schedule/:id` — cancel a job
- [x] `POST /schedule/:id/pause` / `POST /schedule/:id/resume` — suspend/resume recurring jobs
- [x] Uses node-cron (in-process); jobs reloaded from Supabase on server restart
- [x] NLP tools: `schedule_transfer`, `list_schedules`, `cancel_schedule`

---

### 15. Historical Price & OHLCV
Only current price is available.

- [ ] `GET /price/history/:coin` — fetch OHLCV from CoinGecko `/coins/{id}/ohlc`
  - params: `days`, `vsCurrency`
- [ ] `GET /price/chart/:coin` — return chartable data array
- [ ] Add `price_history` NLP tool

---

### 16. Contract Risk / Safety Check
No pre-flight safety tooling.

- [ ] `POST /safety/check` — run pre-approval risk checks:
  - Is the contract verified on Etherscan?
  - Is the spender address a known scam? (check against public blocklists)
  - Simulate the call and report expected token flow
- [ ] Warn in the chat UI if a transfer or approve looks suspicious

---

### 17. Yield / DeFi Tool (Aave on Arbitrum)
- [ ] `POST /defi/deposit` — deposit into Aave USDC pool
- [ ] `POST /defi/withdraw` — withdraw from Aave
- [ ] `GET /defi/apy` — fetch current APY for major pools
- [ ] `POST /defi/claim` — claim rewards
- [ ] Add as NLP tools: `defi_deposit`, `defi_withdraw`, `get_apy`

---

### 18. Governance / DAO Tool
- [ ] `POST /governance/vote` — cast vote on a Governor contract proposal
- [ ] `POST /governance/delegate` — delegate voting power
- [ ] `GET /governance/proposals` — list active proposals
- [ ] `POST /governance/create` — create a new proposal
- [ ] Works with any OZ Governor-compatible contract

---

### 19. Token Permit (EIP-2612) Tool
- [ ] `POST /allowance/permit` — sign and submit EIP-2612 permit (gasless approve)
  - Replaces the 2-tx approve → transferFrom pattern with a single tx
- [ ] Auto-detect if token supports `permit()` before falling back to regular approve

---

### 20. IPFS / Pinata Integration
Currently stubbed out in `.env` but never implemented.

- [ ] `POST /ipfs/upload` — pin a file or JSON metadata to IPFS via Pinata
- [ ] `GET /ipfs/metadata/:cid` — fetch metadata from IPFS gateway
- [ ] Auto-pin NFT metadata when deploying a collection
- [ ] Add `upload_to_ipfs` NLP tool

---

## 🟢 Nice-to-Have — Polish & UX

### 21. Smart Contract Simulation (Tenderly)
- [ ] Before sending any state-changing tx, call Tenderly `/simulate` API
- [ ] Show the user what will happen (token flows, events emitted) before they confirm
- [ ] Add simulation result to the chat UI as a collapsible card

---

### 22. Transaction Revert Decoder ✅ *(covered by #9)*
- [x] `POST /chain/decode/revert` — handles `Error(string)`, `Panic(uint256)`, raw strings, unknown selectors
- [x] Pull custom error selectors from Etherscan ABI (via txHash simulation)
- [x] Returns human-readable error message with type classification

---


### 24. Agent API Key Management UI
The API docs page exists but there is no UI to actually generate, rotate, or revoke per-agent API keys.

- [ ] Add "API Keys" tab to "My Agents" page
- [ ] Generate key button → store hashed key in Supabase
- [ ] Regenerate / revoke key
- [ ] Show usage stats (calls today, total calls, last used)

---

### 25. Conversation Export
- [ ] `GET /conversations/:id/export` — export full conversation as JSON or Markdown
- [ ] Add export button to the chat UI

---

### 26. Admin Dashboard
- [ ] `GET /admin/stats` — total users, agents, conversations, transactions (protected by `ADMIN_SECRET`)
- [ ] Token usage per day (Groq tokens consumed)
- [ ] Error rate per tool

---

### 27. Real-Time Transaction Status (SSE / WebSocket)
Currently every `/transfer` call blocks until the tx is mined (can be 10-30 sec).

- [ ] Return `txHash` immediately after broadcast
- [ ] Open a Server-Sent Events stream (`GET /tx/status/:hash/stream`) that pushes confirmations
- [ ] Frontend shows live "pending → confirmed" status in chat bubbles

---

### 28. Agent Cloning / Templates
- [ ] "Clone this agent" button in My Agents
- [ ] Publish agent as a public template
- [ ] Template gallery page (browse community agents)

---

### 29. Notifications Centre
- [ ] In-app notifications panel (bell icon)
- [ ] Real-time push via Supabase Realtime
- [ ] Types: tx confirmed, balance alert, price threshold hit, agent error

---

### 30. n8n Workflow Templates
After n8n backend is fixed:
- [ ] Pre-built n8n templates: "Send ETH when wallet balance drops", "Daily price report email", "Auto-mint NFT on new user signup"
- [ ] One-click import into n8n

---

## Summary Table

| # | Feature | Priority | Effort |
|---|---|---|---|
| 1 | Deploy factory contracts | 🔴 Critical | S |
| 2 | Session-based signing (no raw key in body) | 🔴 Critical | M |
| 3 | ~~API key auth + rate limiting~~ ✅ | 🔴 Critical | S |
| 4 | n8n backend full implementation | 🔴 Critical | L |
| 5 | ~~Webhook system~~ ✅ | 🟠 High | M |
| 6 | ~~DEX swap tool~~ ✅ | 🟠 High | M |
| 7 | ~~L1↔L2 bridge tool~~ ✅ | 🟠 High | M |
| 8 | ~~Batch / multicall tool~~ ✅ | 🟠 High | S |
| 9 | Tx / event / block lookup | 🟠 High | S |
| 10 | Portfolio analytics | 🟠 High | S |
| 11 | ENS / ARBID resolution | 🟠 High | S |
| 12 | Gas estimator | 🟠 High | S |
| 13 | ~~Telegram bot~~ ✅ | 🟡 Medium | M |
| 14 | ~~Scheduled transfers (cron)~~ ✅ | 🟡 Medium | M |
| 15 | Historical price / OHLCV | 🟡 Medium | S |
| 16 | Contract safety check | 🟡 Medium | M |
| 17 | Yield / Aave DeFi tool | 🟡 Medium | L |
| 18 | Governance / DAO tool | 🟡 Medium | L |
| 19 | Token permit (EIP-2612) | 🟡 Medium | S |
| 20 | IPFS / Pinata upload | 🟡 Medium | S |
| 21 | Tenderly simulation | 🟢 Nice-to-have | M |
| 22 | Revert decoder | 🟢 Nice-to-have | S |
| 24 | API key management UI | 🟢 Nice-to-have | S |
| 25 | Conversation export | 🟢 Nice-to-have | S |
| 26 | Admin dashboard | 🟢 Nice-to-have | S |
| 27 | Real-time tx status (SSE) | 🟢 Nice-to-have | M |
| 28 | Agent cloning / templates | 🟢 Nice-to-have | M |
| 29 | Notifications centre | 🟢 Nice-to-have | M |
| 30 | n8n workflow templates | 🟢 Nice-to-have | S |

**Effort key:** S = Small · M = Medium · L = Large