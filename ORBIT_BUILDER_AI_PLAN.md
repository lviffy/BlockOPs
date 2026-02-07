# Orbit Builder AI — Dedicated Backend & Conversational Deployment Flow

## Overview

A **dedicated AI backend service** for the Orbit Builder that replaces the current single-shot config generator with a **multi-turn conversational AI**. The AI guides users step-by-step through L3 chain configuration, explains every technical term in plain language, collects values through natural conversation, auto-configures all settings, and enables **one-click deployment directly from the chat**.

---

## Current State (What Exists)

| Component | Status |
|-----------|--------|
| `OrbitAIChat` component | Single-shot Gemini call via `/api/orbit/ai-parse` — no memory, no conversation |
| `OrbitConfigForm` | Manual form — user must fill fields after AI generates config |
| Backend orbit controller | In-memory config storage, simulated deployment (mock) |
| `OrbitDeployer` utility | Exists but disconnected from controller |
| Orbit SDK (`@arbitrum/orbit-sdk`) | Not installed |
| Database persistence | SQL schema exists in migrations but unused |

**Problems:**
1. AI doesn't explain what any term means — users must already know what "data availability", "challenge period", "sequencer", etc. are
2. No multi-turn conversation — user must describe everything in one message
3. Config is dumped into a form — user still has to manually review and click deploy
4. No guided flow — intimidating for newcomers
5. Deployment is fake (simulated with setTimeout)

---

## Proposed Architecture

### New Service: `orbit_ai_backend/`

A **standalone FastAPI (Python) service** dedicated to the Orbit Builder AI.

```
orbit_ai_backend/
├── main.py                    # FastAPI app, endpoints
├── requirements.txt           # Dependencies
├── Dockerfile                 # Container config
├── docker-compose.yml         # Service orchestration
├── core/
│   ├── __init__.py
│   ├── ai_engine.py           # LLM orchestration (Groq + Gemini fallback)
│   ├── conversation.py        # Conversation state machine & memory
│   ├── config_builder.py      # Builds orbit config from collected params
│   └── prompts.py             # System prompts & few-shot examples
├── models/
│   ├── __init__.py
│   ├── conversation.py        # Pydantic models for conversation state
│   ├── orbit_config.py        # Pydantic models for orbit configuration
│   └── messages.py            # Message schemas
└── utils/
    ├── __init__.py
    ├── validators.py           # Input validation (addresses, chain IDs, etc.)
    └── defaults.py             # Smart defaults & presets
```

**Port:** `8002` (host) → `8000` (container)

---

## Conversation Flow Design

### Phase 1: Discovery & Education
The AI asks the user about their **use case** in plain language — no technical jargon.

```
AI: "Hey! I'll help you build your own L3 chain. Let's start simple —
     what are you building? For example:
     • A gaming platform
     • A DeFi protocol
     • An enterprise app
     • Something else"

User: "I want to build a gaming platform"

AI: "Great choice! Gaming chains need fast block times for a smooth
     player experience. I'll optimize everything for gaming.

     What do you want to call your chain?"

User: "GameVerse"
```

### Phase 2: Guided Configuration (Step-by-Step)
The AI walks through each setting **one at a time**, explaining what it means and suggesting a value.

```
AI: "Now let's pick your chain's Data Availability mode. This determines
     how your chain stores transaction data:

     🔹 AnyTrust — Cheaper fees, data stored by a trusted committee.
        Best for: gaming, social apps, NFT platforms
     🔹 Rollup — Higher security, all data posted to Ethereum.
        Best for: DeFi, financial apps needing max security

     For a gaming platform, I'd recommend AnyTrust. What do you think?"

User: "Yeah go with anytrust"

AI: "Perfect! AnyTrust it is — your players will enjoy lower gas fees. ✓

     Next up: Validators. These are the nodes that verify transactions
     on your chain. Think of them as referees in a game.

     How many validators do you want? (I'd suggest 3-5 for a gaming
     chain — enough for security without slowing things down)"

User: "Let's do 3"
```

### Phase 3: Auto-Configuration
Once all required inputs are collected, the AI auto-fills everything else with smart defaults based on the use case.

```
AI: "Almost done! I just need your wallet address — this will be the
     owner of the chain (the admin who can update settings later).

     You can paste your connected wallet address, or type a different one."

User: "Use my connected wallet"

AI: "Got it! Here's your complete GameVerse configuration:

     ┌─────────────────────────────────────────┐
     │  🎮 GameVerse L3 Chain                  │
     ├─────────────────────────────────────────┤
     │  Chain ID:        412,567               │
     │  Parent Chain:    Arbitrum Sepolia       │
     │  DA Mode:         AnyTrust              │
     │  Block Time:      1 second              │
     │  Gas Limit:       50,000,000            │
     │  Validators:      3                     │
     │  Native Token:    ETH                   │
     │  Challenge Period: 7 days               │
     │  Owner:           0xYour...Wallet       │
     │  Sequencer:       Auto-generated        │
     └─────────────────────────────────────────┘

     Everything look good? I can:
     • Deploy now — launch your chain! 🚀
     • Edit a setting — just tell me what to change
     • Save as draft — come back to it later"
```

### Phase 4: One-Click Deploy from Chat
User says "deploy" and the AI triggers deployment directly.

```
User: "Deploy now!"

AI: "🚀 Deploying GameVerse...

     Step 1/7: Validating configuration... ✓
     Step 2/7: Preparing deployment parameters... ✓
     Step 3/7: Deploying core contracts... ⏳"

     [Real-time progress updates streamed to chat]

AI: "✅ GameVerse is LIVE!

     📋 Deployment Details:
     • Chain Address: 0xabc...def
     • RPC URL: https://gameverse-rpc.example.com
     • Explorer: https://gameverse-explorer.example.com
     • Tx Hash: 0x123...789

     You can now connect your dApp to your chain using the RPC URL above!"
```

---

## API Endpoints

### `POST /api/orbit-ai/chat`
Main conversational endpoint. Maintains multi-turn context.

**Request:**
```json
{
  "sessionId": "uuid-v4",          // Conversation session ID
  "message": "I want to build a gaming chain",
  "walletAddress": "0x...",        // Connected wallet (optional)
  "userId": "privy-user-id"       // Auth context
}
```

**Response:**
```json
{
  "sessionId": "uuid-v4",
  "message": "Great choice! Gaming chains need fast block times...",
  "phase": "discovery",           // discovery | configuration | review | deploying | deployed
  "currentStep": "use_case",     // What the AI is currently asking about
  "configProgress": {
    "completed": ["use_case", "chain_name"],
    "remaining": ["data_availability", "validators", "owner", "review"],
    "percentage": 33
  },
  "config": null,                 // Partial/full config (shown after review phase)
  "deployment": null              // Deployment status (only during/after deploy)
}
```

### `POST /api/orbit-ai/deploy`
Triggers deployment of a finalized configuration.

**Request:**
```json
{
  "sessionId": "uuid-v4",
  "configId": "config-uuid"       // Config ID from the conversation
}
```

**Response:**
```json
{
  "deploymentId": "deploy-uuid",
  "status": "started",
  "message": "Deployment initiated for GameVerse"
}
```

### `GET /api/orbit-ai/deploy/status/{deploymentId}`
Polls deployment progress (same as existing but proxied through this service).

### `GET /api/orbit-ai/session/{sessionId}`
Retrieves conversation history and current state.

### `POST /api/orbit-ai/session/{sessionId}/reset`
Resets a conversation to start over.

### `GET /api/orbit-ai/presets`
Returns use-case presets (gaming, DeFi, enterprise, NFT, general) with recommended defaults.

---

## Conversation State Machine

```
┌──────────┐     ┌────────────────┐     ┌──────────┐     ┌───────────┐     ┌──────────┐
│ GREETING │────▶│  DISCOVERY     │────▶│ CONFIG   │────▶│  REVIEW   │────▶│ DEPLOY   │
│          │     │                │     │          │     │           │     │          │
│ Welcome  │     │ • Use case     │     │ • DA mode│     │ Show full │     │ Deploy & │
│ message  │     │ • Chain name   │     │ • Valids │     │ config    │     │ stream   │
│          │     │ • Parent chain │     │ • Owner  │     │ Confirm/  │     │ progress │
│          │     │                │     │ • Gas    │     │ edit      │     │          │
└──────────┘     └────────────────┘     └──────────┘     └───────────┘     └──────────┘
                                              │                │                 │
                                              ▼                ▼                 ▼
                                        ┌──────────┐    ┌──────────┐     ┌──────────┐
                                        │ User can │    │ User can │     │ DEPLOYED │
                                        │ skip to  │    │ go back  │     │          │
                                        │ review   │    │ & edit   │     │ Show     │
                                        │ anytime  │    │ any step │     │ results  │
                                        └──────────┘    └──────────┘     └──────────┘
```

### Configuration Steps (collected one by one)

| Step | Field | AI Explains | Smart Default |
|------|-------|-------------|---------------|
| 1 | `useCase` | What kind of app? | — |
| 2 | `chainName` | Name your chain | Based on use case |
| 3 | `parentChain` | Where does your chain settle? | `arbitrum-sepolia` (testnet) |
| 4 | `dataAvailability` | How is data stored? AnyTrust vs Rollup | Based on use case |
| 5 | `validators` | How many transaction verifiers? | 3 for gaming, 5 for DeFi |
| 6 | `ownerAddress` | Who controls the chain? | Connected wallet |
| 7 | `nativeToken` | Gas token for your chain | ETH |
| 8 | `blockTime` | How fast are blocks produced? | 1s gaming, 2s DeFi, 3s enterprise |
| 9 | `gasLimit` | Max computation per block | 50M gaming, 30M default |
| 10 | `challengePeriod` | Fraud proof window | 7 days |

**Auto-filled (user doesn't need to set):**
- `chainId` — randomly generated in safe range
- `sequencerAddress` — auto-generated or uses owner address
- `batchPosterAddress` — auto-generated or uses owner address
- `l1GasPrice` / `l2GasPrice` — fetched from network or use-case defaults

---

## Frontend Changes

### New Component: `OrbitBuilderChat` (replaces current `OrbitAIChat` + `OrbitConfigForm`)

A **full-page conversational interface** that replaces the split chat+form layout.

```
┌─────────────────────────────────────────────────────┐
│  🏗️ Orbit Builder AI                     [wallet] │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ Chat Messages Area (scrollable)              │   │
│  │                                              │   │
│  │ 🤖 Hey! Let's build your L3 chain...        │   │
│  │                                              │   │
│  │                    I want a gaming chain 👤  │   │
│  │                                              │   │
│  │ 🤖 Great! What should we call it?            │   │
│  │                                              │   │
│  │                          GameVerse 👤        │   │
│  │                                              │   │
│  │ 🤖 Now for Data Availability...              │   │
│  │    [AnyTrust] [Rollup]  ← quick-pick btns   │   │
│  │                                              │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ┌──────────────────────────────┐                   │
│  │ Config Progress Bar (33%)    │ ← sidebar/bottom  │
│  │ ✓ Use case                   │                   │
│  │ ✓ Chain name                 │                   │
│  │ ○ Data availability          │                   │
│  │ ○ Validators                 │                   │
│  │ ○ Owner                      │                   │
│  │ ○ Review & Deploy            │                   │
│  └──────────────────────────────┘                   │
│                                                     │
│  ┌─────────────────────────────────────────┐ [Send] │
│  │ Type your response...                    │       │
│  └─────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────┘
```

### Key UI Features

1. **Quick-pick buttons** — For choices like AnyTrust/Rollup, the AI shows clickable buttons in the chat
2. **Progress sidebar** — Shows which config steps are done, what's left
3. **Config preview card** — Appears in chat when all steps are done, with live-editable fields
4. **Deploy button in chat** — Big deploy CTA inside the chat flow
5. **Live deployment logs** — Streamed into the chat as the deployment progresses
6. **Wallet auto-fill** — When user says "use my wallet", auto-fills from Privy

---

## Backend Implementation Details

### AI Engine (`core/ai_engine.py`)

- **Primary LLM:** Groq (`moonshotai/kimi-k2-instruct-0905`) — fast, supports tool calling
- **Fallback LLM:** Google Gemini (`gemini-2.0-flash-exp`)
- **System prompt:** Domain-expert persona that explains Arbitrum Orbit concepts in plain English
- **Context window:** Full conversation history + current config state + phase tracker
- **Output parsing:** Structured JSON extraction for config values from free-text responses

### Conversation Manager (`core/conversation.py`)

- **In-memory session store** (dict) with TTL expiration (2 hours)
- Tracks: `phase`, `currentStep`, `collectedParams`, `messageHistory`, `config`
- State transitions: validates that required params are collected before advancing
- Supports: go-back, edit specific fields, skip to review, restart

### Config Builder (`core/config_builder.py`)

- Takes collected params + use-case presets → produces complete orbit config
- Smart defaults engine: fills all missing fields based on use case
- Validation: checks addresses, chain ID ranges, validator counts
- Outputs config in the format expected by the Node.js backend `/api/orbit/config`

### Deployment Proxy

- The AI backend calls the existing Node.js backend's `/api/orbit/config` (save) and `/api/orbit/deploy` (deploy)
- Polls `/api/orbit/deploy/status/{id}` and streams updates back to the frontend
- This way all deployment logic stays centralized in the Node.js backend

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend Framework | FastAPI (Python 3.11+) |
| LLM Provider | Groq (primary), Google Gemini (fallback) |
| Session Storage | In-memory dict with TTL (upgrade to Redis later) |
| Validation | Pydantic v2 |
| HTTP Client | httpx (async, for calling Node.js backend) |
| Containerization | Docker + docker-compose |
| Frontend | Next.js + React (existing stack) |

---

## Environment Variables

```env
# LLM Providers
GROQ_API_KEY=gsk_...
GEMINI_API_KEY=AI...

# Node.js Backend (for deployment proxy)
BACKEND_URL=http://backend:3000

# Service Config
PORT=8000
SESSION_TTL_SECONDS=7200
LOG_LEVEL=info
```

---

## Implementation Phases

### Phase 1: Backend Service Setup
- [ ] Create `orbit_ai_backend/` directory structure
- [ ] Set up FastAPI app with health check
- [ ] Implement Pydantic models (conversation, config, messages)
- [ ] Create Dockerfile and docker-compose.yml
- [ ] Wire up Groq + Gemini with fallback

### Phase 2: Conversational AI Core
- [ ] Build conversation state machine
- [ ] Write system prompts with Orbit domain knowledge
- [ ] Implement step-by-step config collection
- [ ] Add smart defaults engine (use-case presets)
- [ ] Build config builder with validation
- [ ] Input validation (addresses, chain IDs, etc.)

### Phase 3: API Endpoints
- [ ] `POST /api/orbit-ai/chat` — main conversation endpoint
- [ ] `GET /api/orbit-ai/session/{id}` — retrieve session
- [ ] `POST /api/orbit-ai/session/{id}/reset` — reset session
- [ ] `GET /api/orbit-ai/presets` — use-case presets
- [ ] `POST /api/orbit-ai/deploy` — trigger deployment (proxy to Node.js)
- [ ] `GET /api/orbit-ai/deploy/status/{id}` — poll status (proxy)

### Phase 4: Frontend — New Chat UI
- [ ] Create `OrbitBuilderChat` component (full conversational UI)
- [ ] Add quick-pick buttons for choices (render inline action buttons)
- [ ] Add config progress tracker (sidebar/bottom bar)
- [ ] Add config preview card (appears in chat)
- [ ] Add deploy button + live deployment logs in chat
- [ ] Wallet auto-fill integration with Privy
- [ ] Update `orbit-builder/page.tsx` to use new component

### Phase 5: Integration & Polish
- [ ] Connect frontend to `orbit_ai_backend` service
- [ ] End-to-end testing (conversation → config → deploy)
- [ ] Error handling and retry logic
- [ ] Loading states and animations
- [ ] Mobile responsive design

---

## File Changes Summary

### New Files
| File | Purpose |
|------|---------|
| `orbit_ai_backend/main.py` | FastAPI app with all endpoints |
| `orbit_ai_backend/requirements.txt` | Python dependencies |
| `orbit_ai_backend/Dockerfile` | Container config |
| `orbit_ai_backend/docker-compose.yml` | Service orchestration |
| `orbit_ai_backend/core/__init__.py` | Package init |
| `orbit_ai_backend/core/ai_engine.py` | LLM orchestration |
| `orbit_ai_backend/core/conversation.py` | State machine & session management |
| `orbit_ai_backend/core/config_builder.py` | Config generation from params |
| `orbit_ai_backend/core/prompts.py` | System prompts & few-shot examples |
| `orbit_ai_backend/models/__init__.py` | Package init |
| `orbit_ai_backend/models/conversation.py` | Conversation Pydantic models |
| `orbit_ai_backend/models/orbit_config.py` | Config Pydantic models |
| `orbit_ai_backend/models/messages.py` | API message schemas |
| `orbit_ai_backend/utils/__init__.py` | Package init |
| `orbit_ai_backend/utils/validators.py` | Input validators |
| `orbit_ai_backend/utils/defaults.py` | Smart defaults & presets |
| `frontend/components/orbit/OrbitBuilderChat.tsx` | New full conversational UI |

### Modified Files
| File | Change |
|------|--------|
| `frontend/app/orbit-builder/page.tsx` | Replace split chat+form with `OrbitBuilderChat` |
| `frontend/app/api/orbit/ai-parse/route.ts` | Remove or keep as legacy fallback |

### Unchanged (Reused As-Is)
| File | Reason |
|------|--------|
| `backend/controllers/orbitController.js` | Deployment API stays — AI backend proxies to it |
| `backend/routes/orbitRoutes.js` | Existing REST API stays |
| `backend/utils/orbitDeployer.js` | Deployment logic stays in Node.js |
| `frontend/components/orbit/DeploymentStatus.tsx` | Can be embedded in chat or kept separate |
| `frontend/components/orbit/ConfigList.tsx` | Kept for "My Deployments" tab |
