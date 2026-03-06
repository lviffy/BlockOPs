# Telegram Agent Linking — Feature Plan

> **Goal:** Allow users to **optionally** link their custom BlockOps agents to Telegram. The bot works as a generic assistant by default, and users can upgrade to agent-specific mode by connecting with an API key.

---

## 📋 Quick Summary

**What's changing:**
- ✅ Generic mode (current behavior) stays as the default — **no breaking changes**
- 🆕 Users can **optionally** `/connect` to a custom agent for personalized experience
- 🔀 Users can switch back to generic mode anytime with `/disconnect`
- 🛠️ Generic commands (`/balance`, `/price`, `/status`) always work in both modes

**Use cases:**
- **Generic mode:** Quick one-off queries, testing, users without custom agents
- **Agent mode:** Power users, trading bots, team wallets, branded assistants

**Key principle:** The bot should "just work" without any setup, and agent linking is a premium feature for advanced users.

---

## 🎯 User Story

**Current behavior (preserved as default):**  
When a user starts the Telegram bot, they get a **generic BlockOps assistant** with all standard tools (transfer, price, swap, portfolio, etc.). This works immediately without any setup.

**New optional behavior:**  
1. User creates a **custom agent** on BlockOps (via web UI or API) with:
   - Custom system prompt (personality/role)
   - Specific tool set (only the tools they need)
   - Pre-configured wallet address
   - Private knowledge base (future)
2. User receives an **Agent ID** and **Agent API Key**
3. User types `/connect <agent-id> <api-key>` in Telegram
4. The bot now operates **as that agent** — uses the agent's system prompt, tools, memory, and configuration
5. User can `/disconnect` to return to generic mode or `/switch <agent-id>` to change agents

**Key principle:** Generic mode is **always available** — agent linking is a power-user feature, not a requirement.

---

## 🏗️ Architecture Overview

### Current Flow (preserved as default)
```
Telegram message
  → telegramService.js (handleFreeText)
  → POST /api/chat (agentId = telegramUser.id, generic tools)
  → conversationController.js (all tools enabled)
  → Response sent back to Telegram
```

### New Flow (dual-mode support)
```
Telegram message
  → telegramService.js (handleFreeText)
  → Check if telegram_users.linked_agent_id exists
  
  IF LINKED:
    ✓ Verify API key is still valid (check agents.api_key_hash)
    ✓ Load agent config (system_prompt, enabled_tools, wallet_address)
    ✓ POST /api/chat (
        agentId = linked_agent_id,
        userId = tg-user-{chatId},
        systemPrompt = agent.system_prompt,
        enabledTools = agent.enabled_tools
      )
  
  IF NOT LINKED (default):
    ✓ Use generic agent (current behavior)
    ✓ POST /api/chat (
        agentId = telegramUser.id,
        userId = tg-user-{chatId},
        systemPrompt = default generic prompt,
        enabledTools = ALL tools
      )
  
  → Response sent back to Telegram
```

**Modes Summary:**
- **Generic Mode** (default): Full tool access, default assistant personality, no setup required
- **Agent Mode** (optional): Custom tools, custom personality, requires `/connect` with API key

---

## 📊 Database Schema Changes

### 1. Update `telegram_users` table

**Add columns:**
```sql
ALTER TABLE telegram_users
  ADD COLUMN linked_agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  ADD COLUMN agent_api_key_hash TEXT,  -- bcrypt hash of the API key
  ADD COLUMN linked_at TIMESTAMPTZ;
```

**Indexes:**
```sql
CREATE INDEX idx_telegram_users_linked_agent ON telegram_users(linked_agent_id);
```

---

### 2. Create or update `agents` table

If the `agents` table doesn't exist yet, create it:

```sql
CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  system_prompt TEXT,
  enabled_tools TEXT[], -- array of tool names, e.g. ['transfer_eth', 'fetch_price', 'swap_tokens']
  wallet_address TEXT,  -- optional: agent's primary wallet
  api_key_hash TEXT NOT NULL,  -- bcrypt hash of the agent's API key
  api_key_prefix TEXT NOT NULL, -- first 8 chars for display (e.g. 'bops_8e4...')
  avatar_url TEXT,
  is_public BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_agents_user_id ON agents(user_id);
CREATE INDEX idx_agents_api_key_hash ON agents(api_key_hash);
```

**Notes:**
- `api_key_hash`: bcrypt hash of the full API key (e.g. `bops_8e4fd7ef...`)
- `api_key_prefix`: first 12 chars for display in UI (`bops_8e4fd7e...`)
- Never store the full API key in plaintext

---

## 🔌 New API Endpoints

### Agent Management (Web UI / REST API)

#### `POST /agents`
Create a new agent and generate an API key.

**Request:**
```json
{
  "name": "My Trading Bot",
  "description": "Automated portfolio manager",
  "systemPrompt": "You are a DeFi trading assistant...",
  "enabledTools": ["transfer_eth", "swap_tokens", "fetch_price", "get_portfolio"],
  "walletAddress": "0x1234..."
}
```

**Response:**
```json
{
  "success": true,
  "agent": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "My Trading Bot",
    "apiKey": "bops_8e4fd7ef3b4bd9b89ed8ebb83338c8183153daa20463e664",  // ⚠️ shown ONCE
    "apiKeyPrefix": "bops_8e4fd7e...",
    "createdAt": "2026-03-06T10:00:00Z"
  },
  "warning": "Save this API key now. You won't be able to see it again."
}
```

---

#### `GET /agents`
List all agents for the authenticated user.

**Response:**
```json
{
  "success": true,
  "agents": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "My Trading Bot",
      "description": "Automated portfolio manager",
      "apiKeyPrefix": "bops_8e4fd7e...",
      "linkedToTelegram": true,
      "telegramChatId": "7132143902",
      "createdAt": "2026-03-06T10:00:00Z"
    }
  ]
}
```

---

#### `GET /agents/:id`
Get agent details.

**Response:**
```json
{
  "success": true,
  "agent": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "My Trading Bot",
    "systemPrompt": "You are a DeFi trading assistant...",
    "enabledTools": ["transfer_eth", "swap_tokens"],
    "walletAddress": "0x1234...",
    "linkedToTelegram": true,
    "telegramChatId": "7132143902"
  }
}
```

---

#### `PATCH /agents/:id`
Update agent config.

**Request:**
```json
{
  "name": "Updated Bot Name",
  "systemPrompt": "New prompt...",
  "enabledTools": ["transfer_eth", "swap_tokens", "bridge_deposit"]
}
```

---

#### `POST /agents/:id/regenerate-key`
Regenerate the API key (old key becomes invalid).

**Response:**
```json
{
  "success": true,
  "apiKey": "bops_NEW_KEY_HERE",
  "warning": "Old API key has been revoked. Update all integrations."
}
```

---

#### `DELETE /agents/:id`
Delete an agent. This also unlinks any Telegram chats.

---

### Telegram Linking Endpoints

#### `POST /telegram/link`
Internal endpoint called by `/connect` command.

**Request:**
```json
{
  "chatId": "7132143902",
  "agentId": "550e8400-e29b-41d4-a716-446655440000",
  "apiKey": "bops_8e4fd7ef3b4bd9b89ed8ebb83338c8183153daa20463e664"
}
```

**Response:**
```json
{
  "success": true,
  "agent": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "My Trading Bot"
  },
  "message": "Successfully linked to agent 'My Trading Bot'"
}
```

**Validation:**
- Verify `apiKey` matches `agents.api_key_hash` (bcrypt compare)
- Update `telegram_users.linked_agent_id` and `agent_api_key_hash`

---

## 💬 New Telegram Commands

### `/start`
**Existing command, unchanged behavior:**
- Registers user in `telegram_users` table
- Shows welcome message + available commands
- User starts in **generic mode** with all tools enabled

---

### `/connect <agent-id> <api-key>`
**New command:** Upgrade to agent-specific mode.

**Example:**
```
/connect 550e8400-e29b-41d4-a716-446655440000 bops_8e4fd7ef3b4bd9b89ed8ebb83338c8183153daa20463e664
```

**Response:**
```
✅ Connected to agent: My Trading Bot

Your messages will now be handled by this agent with custom settings:
• System Prompt: "You are a DeFi trading assistant..."
• Enabled Tools: transfer_eth, swap_tokens, fetch_price, get_portfolio (4/20 tools)
• Wallet: 0x1234...5678

Generic commands like /balance and /price still work.
Type /agent to see full agent details.
Type /disconnect to return to generic mode.
```

**Key principle:** Generic commands (`/balance`, `/price`, `/status`) **still work** in agent mode, but free-text questions use the agent's personality and tool restrictions.

**Error handling:**
- Invalid agent ID → `❌ Agent not found`
- Wrong API key → `❌ Invalid API key`
- Agent already linked to another Telegram chat (if one-to-one enforced) → `❌ This agent is already linked to another chat`

---

### `/disconnect`
Unlink the current agent and return to generic mode.

**Response:**
```
✅ Disconnected from agent 'My Trading Bot'

You're back to generic mode with all tools enabled.
Type /connect <agent-id> <api-key> to link to an agent again.
```

---

### `/agent`
Show details about the currently linked agent (or generic mode status).

**Response (if linked to agent):**
```
🤖 **Connected Agent**

Name: My Trading Bot
ID: 550e8400-e29b-41d4-a716-446655440000
Wallet: 0x1234...5678
System Prompt: "You are a DeFi trading assistant..."

Enabled Tools (4/20):
• transfer_eth
• swap_tokens
• fetch_price
• get_portfolio

Generic commands (/balance, /price, etc.) still work.
Type /disconnect to return to generic mode.
```

**Response (if in generic mode - default):**
```
ℹ️ **Generic Mode** (default)

You're using the standard BlockOps assistant with:
• All 20 tools enabled
• Default system prompt
• No wallet pre-configured

Want a custom agent?
1. Create one at https://blockops.in/agents
2. Copy your Agent ID and API Key
3. Type: /connect <agent-id> <api-key>
```

---

### `/switch <agent-id> <api-key>`
Switch to a different agent (shortcut for `/disconnect` + `/connect`).

---

## 🔒 Security Considerations

### 1. API Key Storage
- **NEVER** store API keys in plaintext
- Use `bcrypt.hash(apiKey, 12)` to generate `api_key_hash`
- Store only the hash in `agents.api_key_hash` and `telegram_users.agent_api_key_hash`
- Display only prefix in UI (`bops_8e4fd7e...`)

### 2. API Key Format
Generate keys with:
```javascript
const crypto = require('crypto');
const apiKey = 'bops_' + crypto.randomBytes(32).toString('hex');
```
Result: `bops_8e4fd7ef3b4bd9b89ed8ebb83338c8183153daa20463e664` (69 chars)

### 3. One Agent Per Chat
- Only one agent can be linked to a Telegram chat at a time
- If user tries to link a different agent, prompt: *"You're already linked to Agent X. Type `/disconnect` first or use `/switch <new-agent-id> <api-key>`"*

### 4. One Chat Per Agent (optional constraint)
To prevent abuse (one agent being used by multiple users):
- Option A: **Allow it** — one agent can be linked to multiple Telegram chats (good for team agents)
- Option B: **Block it** — enforce one-to-one mapping (check if `linked_agent_id` is already in use before linking)

**Recommended:** Allow multi-chat linking but add a flag `agents.allow_multi_telegram` (default `true`).

### 5. Rate Limiting
- `/connect` command should be rate-limited (3 attempts / minute per chat_id)
- Prevent brute-force API key guessing

---

## � Dual-Mode Behavior

### Generic Mode (Default)
**Who:** All users by default, or after `/disconnect`  
**Tools:** All 20+ tools enabled  
**Personality:** Default BlockOps assistant system prompt  
**Wallet:** User must provide address/private key in each request  
**Commands:** All commands work (`/balance`, `/price`, `/status`, `/help`)  
**Free-text:** Any blockchain question, no restrictions

**Example:**
```
User: What's the ETH price?
Bot: *ETHEREUM*: $3,456 (+2.3%)

User: Send 0.1 ETH to 0xABC...
Bot: I'll need your private key to sign the transaction...
```

---

### Agent Mode (Optional, after `/connect`)
**Who:** Users who created a custom agent and linked it  
**Tools:** Only the tools enabled in agent config (e.g., 4 out of 20)  
**Personality:** Agent's custom system prompt  
**Wallet:** Agent can have a pre-configured wallet address  
**Commands:** Generic commands (`/balance`, `/price`, `/status`) **still work** as shortcuts  
**Free-text:** Filtered through agent's personality and tool restrictions

**Example (agent restricted to price + portfolio only):**
```
User: What's the ETH price?
Bot [as "My Trading Bot"]: Ethereum is currently at $3,456, up 2.3%. Perfect entry point if you ask me! 😎

User: Send 0.1 ETH to 0xABC...
Bot: Sorry, I don't have access to transfer tools. I'm configured for analysis only.

User: /disconnect
Bot: Back to generic mode.

User: Send 0.1 ETH to 0xABC...
Bot: I'll need your private key... [proceeds with transfer]
```

**Key insight:** Generic commands bypass agent restrictions (always work), but free-text queries respect agent config.

---

## �🛠️ Implementation Steps

### Phase 1: Database & Agent CRUD (Backend)

1. **Create `agents` table** in `backend/database/schema.sql`
2. **Migrate** `telegram_users` to add `linked_agent_id`, `agent_api_key_hash`, `linked_at`
3. **Build Agent Controller** (`backend/controllers/agentController.js`):
   - `createAgent()` — generate UUID + API key, hash key, store prefix
   - `listAgents()` — per user
   - `getAgent()` — single agent details
   - `updateAgent()` — edit config
   - `regenerateApiKey()` — revoke old, generate new
   - `deleteAgent()` — cleanup conversations + unlink Telegram
4. **Build Agent Routes** (`backend/routes/agentRoutes.js`):
   - `POST /agents`
   - `GET /agents`
   - `GET /agents/:id`
   - `PATCH /agents/:id`
   - `POST /agents/:id/regenerate-key`
   - `DELETE /agents/:id`
5. **Wire into app.js**: `app.use('/agents', authGuard, agentRoutes);`

---

### Phase 2: Telegram Linking (Backend)

6. **Update `telegramService.js`**:
   - Add `handleConnect(chatId, args)` command
   - Add `handleDisconnect(chatId)` command
   - Add `handleAgent(chatId)` command (show linked agent info)
   - Add `handleSwitch(chatId, args)` command
7. **Modify `handleFreeText()` to support dual-mode:**
   ```javascript
   async function handleFreeText(chatId, text, user) {
     await upsertTelegramUser({ chatId, username: user.username, firstName: user.first_name });
     
     const telegramUser = await getTelegramUser(chatId);
     let agentId, agentConfig;
     
     if (telegramUser?.linked_agent_id) {
       // AGENT MODE: Load custom agent config
       const agent = await getAgentById(telegramUser.linked_agent_id);
       if (agent) {
         agentId = agent.id;
         agentConfig = {
           systemPrompt: agent.system_prompt,
           enabledTools: agent.enabled_tools,
           walletAddress: agent.wallet_address
         };
       } else {
         // Agent deleted or invalid — fall back to generic
         await sendMessage(chatId, '⚠️ Your linked agent no longer exists. Falling back to generic mode.');
         agentId = telegramUser.id;
         agentConfig = null;
       }
     } else {
       // GENERIC MODE: Default behavior (all tools, default prompt)
       agentId = telegramUser.id;
       agentConfig = null;
     }
     
     // Send "typing..." indicator
     await tgRequest('sendChatAction', { chat_id: chatId, action: 'typing' }).catch(() => {});
     
     // Forward to chat pipeline
     try {
       const { data } = await axios.post(`${BACKEND_URL}/api/chat`, {
         agentId,
         userId: `tg-user-${chatId}`,
         message: text,
         systemPrompt: agentConfig?.systemPrompt,       // null = use default
         enabledTools: agentConfig?.enabledTools,       // null = enable all
         walletAddress: agentConfig?.walletAddress      // optional pre-config
       }, {
         headers: { 'Content-Type': 'application/json', 'x-api-key': MASTER_KEY },
         timeout: 60000
       });
       
       const reply = data.message || data.response || 'Done.';
       const safe = reply.replace(/#{1,6}\s/g, '*').slice(0, 4000);
       await sendMessage(chatId, safe);
     } catch (err) {
       console.error('[Telegram] Chat pipeline error:', err.message);
       await sendMessage(chatId, `⚠️ Something went wrong: ${err.message}`);
     }
   }
   ```
8. **Keep generic commands (e.g., `/balance`, `/price`) unchanged:**
   - These bypass agent restrictions and always work
   - Only free-text queries are filtered by agent config

8. **Add Telegram Linking Route** (`backend/routes/telegramRoutes.js`):
   - `POST /telegram/link` — verify API key, update `telegram_users`
   - `POST /telegram/unlink` — clear `linked_agent_id`

---

### Phase 3: Conversation Controller Changes

9. **Update `conversationController.js`**:
   - Accept `enabledTools` array in request body
   - If `enabledTools` is provided, filter `AVAILABLE_TOOLS` before calling AI:
     ```javascript
     const availableTools = enabledTools 
       ? AVAILABLE_TOOLS.filter(t => enabledTools.includes(t.name))
       : AVAILABLE_TOOLS;
     ```
   - Pass agent-specific `systemPrompt` to Groq/Gemini if provided

---

### Phase 4: Frontend UI (Agent Management)

10. **Create Agent Management Page** (`frontend/app/agents/page.tsx`):
    - List all user's agents (table with name, API key prefix, created date)
    - "Create Agent" button → modal with form (name, description, system prompt, enabled tools checkboxes)
    - "Edit" button → update agent config
    - "Regenerate Key" button → show new key once in modal
    - "Delete" button → confirm dialog
    - Show Telegram link status: *"Linked to Telegram chat 7132143902"* or *"Not linked"*

11. **Add to navbar**: "My Agents" link

---

### Phase 5: Testing & Docs

12. **Write tests** (`backend/test_agent_linking.js`):
    - Create agent → verify API key returned
    - Link agent to Telegram chat → verify `telegram_users` updated
    - Send Telegram message → verify correct agent context is used
    - Disconnect → verify fallback to generic mode
13. **Update API docs** (`backend/API_DOCUMENTATION.md`) with all new agent endpoints
14. **Update Telegram bot help text** with `/connect`, `/disconnect`, `/agent` commands
15. **Update `PENDING_FEATURES.md`** — mark agent linking as ✅

---

## 🎨 UI/UX Enhancements

### Updated `/start` Welcome Message
```
👋 Welcome to *BlockOps*!

I'm your on-chain AI assistant. Here's what I can do:

🔹 /balance <address> — check ETH balance
🔹 /price <token> — get token price (e.g., /price ETH)
🔹 /status <txHash> — look up a transaction
🔹 /help — show all commands

Or just ask me anything in plain English:
  • "What's the gas price right now?"
  • "Show me the portfolio for 0x1234..."
  • "What's the ETH price?"

━━━━━━━━━━━━━━━━━━━━

🤖 *Want a custom agent?*
Create one at https://blockops.in/agents
Then type: /connect <agent-id> <api-key>

Your agent can have:
  ✓ Custom personality
  ✓ Specific tools only
  ✓ Pre-configured wallet
  ✓ Private knowledge (soon)

For now, you're in *generic mode* with all tools enabled.
```

---

### Telegram Bot Welcome Message (after `/connect`)
```
✅ Connected to: My Trading Bot

🤖 Agent Details:
• Name: My Trading Bot
• Wallet: 0x1234...5678
• Enabled Tools: 4/20 (transfer_eth, swap_tokens, fetch_price, get_portfolio)
• System Prompt: "You are a DeFi trading assistant..."

🔹 What I can do for you:
  • Send ETH/tokens
  • Swap on Uniswap
  • Fetch prices & portfolio
  • (Transfer tools disabled by agent config)

Generic commands (/balance, /price) still work!
Try: "What's my portfolio balance?"

Type /disconnect to return to generic mode.
```

### Web UI Agent Card
```
┌────────────────────────────────────────┐
│ 🤖 My Trading Bot                      │
│ Created: Mar 6, 2026                   │
│ API Key: bops_8e4fd7e... [Copy]       │
│                                        │
│ 🔗 Telegram Status:                   │
│  ✅ Linked to chat: 7132143902        │
│  Connected 2 hours ago                 │
│                                        │
│ [Edit Config] [Regenerate Key] [Delete]│
└────────────────────────────────────────┘
```

---

## 📈 Future Enhancements

### Multi-Agent Mode
Allow a single Telegram chat to have **multiple agents** and switch between them with `/use <agent-name>`.

### Agent Sharing
- Public agent marketplace: users can publish their agents as templates
- Others can clone + customize
- Example: "DeFi Yield Farmer", "NFT Drop Monitor", "Gas Price Alert Bot"

### Agent Analytics Dashboard
- Track per-agent metrics: total messages, tool calls, tokens sent, errors
- Show in web UI: *"This agent has processed 1,234 messages"*

### Voice Command Support
- Send voice messages to Telegram bot
- Transcribe with Whisper API → forward to agent

### Agent-to-Agent Communication
- Agents can call other agents' tools
- Example: Trading Bot calls Portfolio Bot to check balance before swapping

---

## 🚀 Success Metrics

- **Linkage Rate:** % of Telegram users who link an agent vs. stay generic
- **Agent Creation Rate:** Agents created per week
- **Tool Usage:** Which tools are most popular per agent type
- **Retention:** Do linked users message more frequently than unlinked?

---

## 📝 Open Questions

1. **Should one agent be allowed to link to multiple Telegram chats?**
   - **Yes** (recommended): Good for team agents, family wallets
   - **No**: Prevents accidental key sharing

2. **Should we support Discord / Slack / WhatsApp linking later?**
   - Same pattern can apply to all platforms
   - Abstract into `linked_platforms` table:
     ```sql
     CREATE TABLE linked_platforms (
       id UUID PRIMARY KEY,
       agent_id UUID REFERENCES agents(id),
       platform TEXT, -- 'telegram', 'discord', 'slack'
       platform_user_id TEXT, -- chat_id, discord user ID, etc.
       linked_at TIMESTAMPTZ
     );
     ```

3. **Do we need agent-level rate limiting?**
   - Yes — per agent, not just per IP
   - Stop abuse if API key is leaked

4. **Should agents have wallets OR should users send private keys per tx?**
   - Current: users send private key per transaction
   - Future: agent has a server-side encrypted wallet (session-based signing from PENDING_FEATURES #2)

---

## 🏁 Summary

This feature transforms the Telegram bot from a **generic tool** into a **personalized AI agent** that each user can customize. It bridges the web app (where agents are created/managed) with the Telegram interface (where agents come to life).

**Next steps:**
1. Implement Phase 1 (Agent CRUD backend)
2. Implement Phase 2 (Telegram linking)
3. Ship MVP → gather feedback → iterate

**Estimated effort:** Medium (3-5 days)

---

**Related:**
- `PENDING_FEATURES.md` — Telegram bot is ✅, agent linking is new
- `backend/database/schema.sql` — add `agents` + update `telegram_users`
- `backend/services/telegramService.js` — add `/connect`, `/disconnect`, `/agent` commands
