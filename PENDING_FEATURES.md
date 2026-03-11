# BlockOps — Pending Features & Roadmap

> Last updated: July 2025  
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

### 2. Private Keys Passed in Plain HTTP Body ✅
**Files:** `directToolExecutor.js`, `transferController.js`, `tokenController.js`, `nftController.js`  
Every tool that signs transactions receives `privateKey` in the JSON body — this is logged, stored in conversation history, and sent over HTTP.

- [x] Introduce **session-based signing**: `POST /signing/session` stores the private key server-side (AES-256-GCM encrypted, 30-min expiry), returns a `sessionToken`; `resolvePrivateKey()` utility lets all controllers accept either `privateKey` or `sessionToken`
- [x] `DELETE /signing/session` — revoke session immediately
- [ ] Never log or persist messages that contain a raw private key (runtime logging hygiene; ongoing)
- [x] EIP-712 typed-data signer endpoint — permit controller uses `wallet.signTypedData()`

---

### 3. No API Authentication on Public Endpoints ✅
**File:** `backend/app.js`  
All routes are open. Any caller can drain wallets, spam emails, or consume AI quota.

- [x] Add API-key middleware (`x-api-key` header) per agent, tied to Supabase `agents` table
- [x] Add rate limiting (`express-rate-limit` or Upstash Ratelimit)
- [x] Add IP-level throttle for `/price` and `/chat` endpoints

---

### 4. n8n Backend Full Implementation ✅
**File:** `n8n_agent_backend/main.py`  

- [x] n8n REST API proxy: `GET/POST /n8n/workflows`, `GET/DELETE /n8n/workflows/{id}`, activate/deactivate/run, list/get executions
- [x] `build_n8n_workflow_from_tools()` — generates n8n workflow JSON with HTTP Request nodes from BlockOps tool names
- [x] `BLOCKOPS_TO_N8N_NODE` mapping dict (12 BlockOps tools → n8n node types)
- [x] `GET /n8n/node-types` — expose node-type mapping to frontend
- [ ] Wire n8n webhook triggers back to BlockOps agents (requires running n8n instance)

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

### 15. Historical Price & OHLCV ✅

- [x] `GET /price/history/:coin` — fetch OHLCV from CoinGecko `/coins/{id}/ohlc`
  - params: `days`, `vsCurrency`
- [x] `GET /price/chart/:coin` — return chartable data array (market_chart endpoint)
- [x] `price_history` NLP tool added to toolRouter

---

### 16. Contract Risk / Safety Check ✅

- [x] `POST /safety/check` — checks bytecode presence, Etherscan verification, scam name patterns, deployment age, EOA vs contract spender
- [x] Returns `riskScore` (0–100+), `riskLevel` (safe/low/medium/high), `warnings[]`, `recommendation`
- [x] `check_contract_safety` NLP tool added

---

### 17. Yield / DeFi Tool (Aave on Arbitrum) ✅
- [x] `POST /defi/deposit` — supply asset to Aave V3 pool
- [x] `POST /defi/withdraw` — withdraw from Aave V3
- [x] `GET /defi/apy` — fetch current supply/borrow APY (rate / RAY * 100)
- [x] `POST /defi/claim` — claim AAVE rewards via RewardsController
- [x] `GET /defi/account/:address` — get user account data (ltv, health factor, balances)
- [x] NLP tools added: `defi_deposit`, `defi_withdraw`, `get_apy`

---

### 18. Governance / DAO Tool ✅
- [x] `POST /governance/vote` — cast vote (0=against, 1=for, 2=abstain) with optional reason
- [x] `POST /governance/delegate` — delegate voting power (self or to address)
- [x] `GET /governance/proposals/:contractAddr` — list proposals from last 100k blocks via `queryFilter`
- [x] `POST /governance/create` — create a new proposal
- [x] `GET /governance/votes/:token/:address` — get current voting power
- [x] Works with any OZ Governor-compatible contract
- [x] NLP tools: `governance_vote`, `governance_delegate`, `governance_propose`

---

### 19. Token Permit (EIP-2612) Tool ✅
- [x] `POST /allowance/permit` — sign and submit EIP-2612 permit (gasless approve)
  - Uses `wallet.signTypedData()` with auto-detected `DOMAIN_SEPARATOR()` and `nonces()`
- [x] Auto-detects permit support; falls back to instructing user to use `/allowance/approve` if unsupported
- [x] `permit_token` NLP tool added

---

### 20. IPFS / Pinata Integration ✅

- [x] `POST /ipfs/upload` — pin JSON object or base64 file to IPFS via Pinata; returns `{ cid, url, gatewayUrl, size }`
- [x] `GET /ipfs/metadata/:cid` — fetch metadata from IPFS gateway
- [x] `GET /ipfs/pins` — list all pins from Pinata account
- [x] `upload_to_ipfs` NLP tool added

---

## 🟢 Nice-to-Have — Polish & UX

### 21. Smart Contract Simulation (Tenderly) ✅
- [x] `POST /simulate` — calls Tenderly `/simulate` if `TENDERLY_ACCESS_KEY` is configured
- [x] Fallback to `provider.call()` + `provider.estimateGas()` if Tenderly not configured
- [x] Accepts ABI + functionName + args to auto-encode calldata via `ethers.Interface`
- [x] `simulate_tx` NLP tool added
- [ ] Show simulation result in the chat UI as a collapsible card (frontend work)

---

### 22. Transaction Revert Decoder ✅ *(covered by #9)*
- [x] `POST /chain/decode/revert` — handles `Error(string)`, `Panic(uint256)`, raw strings, unknown selectors
- [x] Pull custom error selectors from Etherscan ABI (via txHash simulation)
- [x] Returns human-readable error message with type classification

---


### 24. Agent API Key Management UI ✅

- [x] "API Key" option in each agent's dropdown menu on My Agents page
- [x] Dialog shows the key (masked by default, reveal toggle + copy button)
- [x] "Regenerate Key" with inline confirmation — invalidates old key, updates Supabase
- [x] `regenerateApiKey(agentId)` helper in `lib/agents.ts`
- [ ] Show usage stats (requires backend call counter; future work)

---

---

---

### 27. Real-Time Transaction Status (SSE / WebSocket) ✅

- [x] `GET /tx/status/:hash` — one-shot status: `pending` / `confirmed` / `failed` + confirmations count
- [x] `GET /tx/status/:hash/stream` — SSE stream polling every 3s, 2-min timeout, sends `status` / `done` / `timeout` / `error` events
- [x] Sets `X-Accel-Buffering: no` for nginx SSE compatibility
- [ ] Frontend live status in chat bubbles (future UI work)

---

### 28. Agent Cloning / Templates ✅
- [x] "Clone" option in each agent's dropdown on My Agents page
- [x] Creates duplicate with `"{name} (Copy)"`, fresh API key, same tools/description
- [x] `cloneAgent(agentId, userId)` in `lib/agents.ts` (frontend, direct Supabase)
- [x] `POST /agents/:id/clone` backend endpoint in `agentController.js`
- [ ] Publish as public template + community gallery (future work)

---


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
| 2 | ~~Session-based signing~~ ✅ | 🔴 Critical | M |
| 3 | ~~API key auth + rate limiting~~ ✅ | 🔴 Critical | S |
| 4 | ~~n8n backend full implementation~~ ✅ | 🔴 Critical | L |
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
| 15 | ~~Historical price / OHLCV~~ ✅ | 🟡 Medium | S |
| 16 | ~~Contract safety check~~ ✅ | 🟡 Medium | M |
| 17 | ~~Yield / Aave DeFi tool~~ ✅ | 🟡 Medium | L |
| 18 | ~~Governance / DAO tool~~ ✅ | 🟡 Medium | L |
| 19 | ~~Token permit (EIP-2612)~~ ✅ | 🟡 Medium | S |
| 20 | ~~IPFS / Pinata upload~~ ✅ | 🟡 Medium | S |
| 21 | ~~Tenderly simulation~~ ✅ | 🟢 Nice-to-have | M |
| 22 | ~~Revert decoder~~ ✅ | 🟢 Nice-to-have | S |
| 24 | ~~API key management UI~~ ✅ | 🟢 Nice-to-have | S |
| 25 | ~~Conversation export~~ ✅ | 🟢 Nice-to-have | S |
| 26 | ~~Admin dashboard~~ ✅ | 🟢 Nice-to-have | S |
| 27 | ~~Real-time tx status (SSE)~~ ✅ | 🟢 Nice-to-have | M |
| 28 | ~~Agent cloning / templates~~ ✅ | 🟢 Nice-to-have | M |
| 29 | Notifications centre | 🟢 Nice-to-have | M |
| 30 | n8n workflow templates | 🟢 Nice-to-have | S |

**Effort key:** S = Small · M = Medium · L = Large