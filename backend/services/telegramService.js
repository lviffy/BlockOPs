/**
 * Telegram Bot Service
 *
 * Bridges Telegram messages into the existing BlockOps AI chat pipeline.
 * Uses the Telegram Bot API (long-polling for dev, webhook for prod).
 *
 * Features:
 *   • Registers Telegram chatId per user in Supabase `telegram_users` table
 *   • Commands: /start /balance /price /status /help
 *   • Free-text messages are forwarded into conversationController chat pipeline
 *   • Outbound notifications: fireToTelegram() allows any service to push messages
 *   • Webhook delivery receipts can also be forwarded to a Telegram chatId
 *
 * Environment variables required:
 *   TELEGRAM_BOT_TOKEN   — from BotFather
 *   TELEGRAM_WEBHOOK_URL — public HTTPS URL for prod (e.g. https://yourapi.com/telegram/webhook)
 *                          Leave empty to use long-polling during local dev.
 */

const axios   = require('axios');
const bcrypt  = require('bcrypt');
const supabase = require('../config/supabase');
const { getAgentById, verifyApiKey } = require('../controllers/agentController');

const BOT_TOKEN    = process.env.TELEGRAM_BOT_TOKEN || '';
const WEBHOOK_URL  = process.env.TELEGRAM_WEBHOOK_URL || '';
const BACKEND_URL  = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3000}`;
const MASTER_KEY   = process.env.MASTER_API_KEY || '';

const TG_API = BOT_TOKEN ? `https://api.telegram.org/bot${BOT_TOKEN}` : null;

// Escape characters that break Telegram's legacy Markdown parser
function mdEscape(str) {
  if (!str) return '';
  return String(str).replace(/[*_`[\]]/g, (c) => '\\' + c);
}

// ── Telegram API helpers ──────────────────────────────────────────────────────

async function tgRequest(method, body = {}, timeout = 10000) {
  if (!TG_API) throw new Error('TELEGRAM_BOT_TOKEN is not set');
  const { data } = await axios.post(`${TG_API}/${method}`, body, { timeout });
  return data;
}

/**
 * Send a plain-text message to a Telegram chat.
 * Silently no-ops if bot token is missing.
 */
async function sendMessage(chatId, text, options = {}) {
  if (!TG_API) return;
  try {
    await tgRequest('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
      ...options
    });
  } catch (err) {
    console.error(`[Telegram] sendMessage to ${chatId} failed:`, err.response?.data || err.message || err);
  }
}

// ── User registration (Supabase) ─────────────────────────────────────────────

async function upsertTelegramUser({ chatId, username, firstName, agentId }) {
  if (!supabase) return;
  await supabase.from('telegram_users').upsert({
    chat_id:    String(chatId),
    username:   username || null,
    first_name: firstName || null,
    agent_id:   agentId || null,
    updated_at: new Date().toISOString()
  }, { onConflict: 'chat_id' }).then(({ error }) => {
    if (error) console.error('[Telegram] upsert user error:', error.message);
  });
}

async function getTelegramUser(chatId) {
  if (!supabase) return null;
  const { data } = await supabase
    .from('telegram_users')
    .select('*')
    .eq('chat_id', String(chatId))
    .single();
  return data || null;
}

// ── Command handlers ──────────────────────────────────────────────────────────

async function handleStart(chatId, user) {
  await upsertTelegramUser({
    chatId,
    username:  user.username,
    firstName: user.first_name
  });
  await sendMessage(chatId,
    `👋 Welcome to *BlockOps*!\n\n` +
    `I'm your on-chain AI assistant. Here's what I can do:\n\n` +
    `🔹 /balance \`<address>\` — check ETH balance\n` +
    `🔹 /price \`<token>\` — get token price (e.g., /price ETH)\n` +
    `🔹 /status \`<txHash>\` — look up a transaction\n` +
    `🔹 /help — show all commands\n\n` +
    `Or just ask me anything in plain English:\n` +
    `  • "What's the gas price right now?"\n` +
    `  • "Show me the portfolio for 0x1234..."\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `🤖 *Want a custom agent?*\n` +
    `Create one at https://blockops.in/agents\n` +
    `Then type: /connect <agent-id> <api-key>\n\n` +
    `Your agent can have:\n` +
    `  ✓ Custom personality\n` +
    `  ✓ Specific tools only\n` +
    `  ✓ Pre-configured wallet\n\n` +
    `For now, you're in *generic mode* with all tools enabled.`
  );
}

async function handleHelp(chatId) {
  await sendMessage(chatId,
    `*BlockOps Bot Commands*\n\n` +
    `*Basic Commands:*\n` +
    `/balance \`<address>\` — ETH balance for an address\n` +
    `/price \`<token>\` — current token price\n` +
    `/status \`<txHash>\` — transaction status\n` +
    `/help — this message\n\n` +
    `*Agent Commands:*\n` +
    `/connect \`<agent-id> <api-key>\` — link to your custom agent\n` +
    `/disconnect — return to generic mode\n` +
    `/agent — show linked agent details\n` +
    `/switch \`<agent-id> <api-key>\` — switch to different agent\n\n` +
    `You can also ask me anything in plain English, e.g.:\n` +
    `_"What is the gas price right now?"_\n` +
    `_"Show me the portfolio for 0x1234..."_\n` +
    `_"What's the ETH price?"_`
  );
}

async function handleBalance(chatId, args) {
  const address = args[0];
  if (!address || !address.startsWith('0x') || address.length < 40) {
    return sendMessage(chatId, '❌ Please provide a valid Ethereum address.\nUsage: `/balance 0x1234...`');
  }
  try {
    const { data } = await axios.get(`${BACKEND_URL}/transfer/balance/${address}`, {
      headers: { 'x-api-key': MASTER_KEY },
      timeout: 10000
    });
    const bal = data.balance ?? data.result?.balance ?? '?';
    const balFormatted = typeof bal === 'number' ? bal.toFixed(4) : String(bal);
    await sendMessage(chatId, `💰 Balance for \`${address.slice(0, 10)}...\`\n\n*${balFormatted} ETH*`);
  } catch (err) {
    await sendMessage(chatId, `❌ Could not fetch balance: ${err.message}`);
  }
}

async function handlePrice(chatId, args) {
  const query = args.join(' ');
  if (!query) {
    return sendMessage(chatId, '❌ Please provide a token name.\nUsage: `/price ETH` or `/price bitcoin`');
  }
  try {
    const { data } = await axios.post(`${BACKEND_URL}/price/token`, { query }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });
    const prices = data.prices || data.result?.prices || [];
    let lines;
    if (Array.isArray(prices)) {
      // Array of { coin, price, currency, change_24h, market_cap, ... }
      lines = prices.map(p => {
        const change = p.change_24h != null ? ` (${p.change_24h >= 0 ? '+' : ''}${p.change_24h.toFixed(2)}%)` : '';
        return `*${(p.coin || p.symbol || '?').toUpperCase()}*: $${Number(p.price).toLocaleString()}${change}`;
      }).join('\n');
    } else {
      // Object keyed by symbol (fallback)
      lines = Object.entries(prices)
        .map(([sym, info]) => `*${sym.toUpperCase()}*: $${info.usd ?? info}`)
        .join('\n');
    }
    await sendMessage(chatId, lines || `No price found for "${query}"`);
  } catch (err) {
    await sendMessage(chatId, `❌ Could not fetch price: ${err.message}`);
  }
}

async function handleStatus(chatId, args) {
  const txHash = args[0];
  if (!txHash || !txHash.startsWith('0x')) {
    return sendMessage(chatId, '❌ Please provide a transaction hash.\nUsage: `/status 0xabc...`');
  }
  try {
    const { data } = await axios.get(`${BACKEND_URL}/chain/tx/${txHash}`, {
      headers: { 'x-api-key': MASTER_KEY },
      timeout: 15000
    });
    const tx = data.result || data;
    const status  = tx.receipt?.status ?? 'pending';
    const block   = tx.blockNumber ?? 'pending';
    const value   = tx.value ? `\nValue: *${tx.value} ETH*` : '';
    await sendMessage(chatId,
      `📋 *Transaction* \`${txHash.slice(0, 12)}...\`\n` +
      `Status: *${status}*\n` +
      `Block: ${block}${value}\n` +
      `[View on Arbiscan](${tx.explorerUrl || `https://sepolia.arbiscan.io/tx/${txHash}`})`
    );
  } catch (err) {
    await sendMessage(chatId, `❌ Could not fetch transaction: ${err.message}`);
  }
}

// ── Agent Linking Commands ───────────────────────────────────────────────────

async function handleConnect(chatId, args) {
  if (args.length < 2) {
    return sendMessage(chatId,
      '❌ Usage: `/connect <agent-id> <api-key>`\n\n' +
      'Get your agent ID and API key from https://blockops.in/agents'
    );
  }

  const [agentId, apiKey] = args;

  // Verify agent exists and API key is correct
  const agent = await getAgentById(agentId);
  if (!agent) {
    return sendMessage(chatId, '❌ Agent not found. Check your agent ID.');
  }

  const isValid = await verifyApiKey(agentId, apiKey);
  if (!isValid) {
    return sendMessage(chatId, '❌ Invalid API key. Please check and try again.');
  }

  // Hash the API key for storage (so we can verify it later)
  const apiKeyHash = await bcrypt.hash(apiKey, 12);

  // Update telegram_users to link this agent
  const { error } = await supabase
    .from('telegram_users')
    .update({
      linked_agent_id: agentId,
      agent_api_key_hash: apiKeyHash,
      linked_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('chat_id', String(chatId));

  if (error) {
    console.error('[Telegram] Link agent error:', error);
    return sendMessage(chatId, `⚠️ Something went wrong: ${error.message}`);
  }

  const toolCount = agent.enabled_tools?.length || 0;
  const toolList = agent.enabled_tools?.slice(0, 4).map(mdEscape).join(', ') || 'none specified';

  await sendMessage(chatId,
    `✅ *Connected to agent:* ${mdEscape(agent.name)}\n\n` +
    `🤖 *Agent Details:*\n` +
    `• Name: ${mdEscape(agent.name)}\n` +
    `• Enabled Tools: ${toolCount} ${toolCount > 4 ? '(showing first 4)' : ''}\n` +
    `  ${toolList}\n` +
    (agent.wallet_address ? `• Wallet: ${mdEscape(agent.wallet_address.slice(0, 10))}...\n` : '') +
    (agent.system_prompt ? `• Personality: "${mdEscape(agent.system_prompt.slice(0, 80))}"\n\n` : '\n') +
    `🔹 Your messages will now be handled by this agent with custom settings.\n` +
    `🔹 Generic commands (/balance, /price, /status) still work.\n\n` +
    `Type /agent to see full details.\n` +
    `Type /disconnect to return to generic mode.`
  );
}

async function handleDisconnect(chatId) {
  const telegramUser = await getTelegramUser(chatId);

  if (!telegramUser?.linked_agent_id) {
    return sendMessage(chatId,
      'ℹ️ You\'re not connected to any agent. You\'re in generic mode.\n\n' +
      'To connect to a custom agent:\n' +
      '1. Create one at https://blockops.in/agents\n' +
      '2. Type: /connect <agent-id> <api-key>'
    );
  }

  // Get agent name before unlinking
  const agent = await getAgentById(telegramUser.linked_agent_id);
  const agentName = agent?.name || 'Unknown Agent';

  // Unlink
  const { error } = await supabase
    .from('telegram_users')
    .update({
      linked_agent_id: null,
      agent_api_key_hash: null,
      linked_at: null,
      updated_at: new Date().toISOString()
    })
    .eq('chat_id', String(chatId));

  if (error) {
    console.error('[Telegram] Disconnect error:', error);
    return sendMessage(chatId, `⚠️ Something went wrong: ${error.message}`);
  }

  await sendMessage(chatId,
    `✅ Disconnected from agent: *${mdEscape(agentName)}*\n\n` +
    `You're back to *generic mode* with all tools enabled.\n\n` +
    `Type /connect <agent-id> <api-key> to link to an agent again.`
  );
}

async function handleAgent(chatId) {
  const telegramUser = await getTelegramUser(chatId);

  if (!telegramUser?.linked_agent_id) {
    return sendMessage(chatId,
      'ℹ️ *Generic Mode* (default)\n\n' +
      'You\'re using the standard BlockOps assistant with:\n' +
      '• All 20+ tools enabled\n' +
      '• Default system prompt\n' +
      '• No wallet pre-configured\n\n' +
      '━━━━━━━━━━━━━━━━━━━━\n\n' +
      '🤖 *Want a custom agent?*\n' +
      '1. Create one at https://blockops.in/agents\n' +
      '2. Copy your Agent ID and API Key\n' +
      '3. Type: /connect <agent-id> <api-key>'
    );
  }

  const agent = await getAgentById(telegramUser.linked_agent_id);
  if (!agent) {
    return sendMessage(chatId,
      '⚠️ Your linked agent no longer exists. Falling back to generic mode.\n\n' +
      'Type /disconnect to clear the link.'
    );
  }

  const toolCount = agent.enabled_tools?.length || 0;
  const toolList = agent.enabled_tools?.slice(0, 8).map(t => `  • ${mdEscape(t)}`).join('\n') || '  • (none specified)';

  await sendMessage(chatId,
    `🤖 *Connected Agent*\n\n` +
    `*Name:* ${mdEscape(agent.name)}\n` +
    `*ID:* ${agent.id}\n` +
    (agent.description ? `*Description:* ${mdEscape(agent.description)}\n` : '') +
    (agent.wallet_address ? `*Wallet:* ${mdEscape(agent.wallet_address.slice(0, 10))}...\n` : '') +
    (agent.system_prompt ? `*System Prompt:* "${mdEscape(agent.system_prompt.slice(0, 120))}"\n\n` : '\n') +
    `*Enabled Tools (${toolCount}/20+):*\n${toolList}\n` +
    (toolCount > 8 ? `  ...and ${toolCount - 8} more\n\n` : '\n') +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `Generic commands (/balance, /price, /status) still work.\n` +
    `Type /disconnect to return to generic mode.`
  );
}

async function handleSwitch(chatId, args) {
  if (args.length < 2) {
    return sendMessage(chatId,
      '❌ Usage: `/switch <agent-id> <api-key>`\n\n' +
      'This is a shortcut for /disconnect + /connect.'
    );
  }

  // Disconnect first (silently)
  await supabase
    .from('telegram_users')
    .update({
      linked_agent_id: null,
      agent_api_key_hash: null,
      linked_at: null,
      updated_at: new Date().toISOString()
    })
    .eq('chat_id', String(chatId));

  // Then connect to new agent
  await handleConnect(chatId, args);
}

// ── Free-text → AI chat pipeline ─────────────────────────────────────────────

async function handleFreeText(chatId, text, user) {
  // Ensure user exists
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
    agentId = telegramUser?.id || `tg-${chatId}`;
    agentConfig = null;
  }

  const userId = `tg-user-${chatId}`;

  // Send "typing…" indicator
  await tgRequest('sendChatAction', { chat_id: chatId, action: 'typing' }).catch(() => {});

  try {
    const { data } = await axios.post(`${BACKEND_URL}/api/chat`, {
      agentId,
      userId,
      message: text,
      systemPrompt: agentConfig?.systemPrompt,       // null = use default
      enabledTools: agentConfig?.enabledTools,       // null = enable all
      walletAddress: agentConfig?.walletAddress      // optional pre-config
    }, {
      headers: { 'Content-Type': 'application/json', 'x-api-key': MASTER_KEY },
      timeout: 60000
    });

    const reply = data.message || data.response || 'Done.';

    // Telegram Markdown is limited — strip unsupported formatting
    const safe = reply
      .replace(/#{1,6}\s/g, '*')          // headings → bold
      .replace(/\*\*(.+?)\*\*/g, '*$1*')  // **bold** → *bold*
      .replace(/`{3}[\s\S]*?`{3}/g, (m) => m.replace(/`{3}/g, '```')) // keep code blocks
      .slice(0, 4000);                    // Telegram max message length

    await sendMessage(chatId, safe);
  } catch (err) {
    console.error('[Telegram] Chat pipeline error:', err.message);
    await sendMessage(chatId, `⚠️ Something went wrong: ${err.message}`);
  }
}

// ── Update dispatcher ─────────────────────────────────────────────────────────

/**
 * Process a single Telegram update object (from webhook or long-poll).
 */
async function processUpdate(update) {
  const msg = update.message || update.edited_message;
  if (!msg || !msg.text) return; // skip non-text updates

  const chatId = msg.chat.id;
  const user   = msg.from || {};
  const text   = msg.text.trim();

  // Parse command
  const commandMatch = text.match(/^\/(\w+)(?:@\S+)?\s*(.*)/s);
  if (commandMatch) {
    const cmd  = commandMatch[1].toLowerCase();
    const rest = commandMatch[2].trim();
    const args = rest ? rest.split(/\s+/) : [];

    switch (cmd) {
      case 'start':    return handleStart(chatId, user);
      case 'help':     return handleHelp(chatId);
      case 'balance':  return handleBalance(chatId, args);
      case 'price':    return handlePrice(chatId, args);
      case 'status':   return handleStatus(chatId, args);
      case 'connect':  return handleConnect(chatId, args);
      case 'disconnect': return handleDisconnect(chatId);
      case 'agent':    return handleAgent(chatId);
      case 'switch':   return handleSwitch(chatId, args);
      default:
        // Unknown command — treat as free text
        return handleFreeText(chatId, text, user);
    }
  }

  // Plain text
  return handleFreeText(chatId, text, user);
}

// ── Long-polling (local dev) ──────────────────────────────────────────────────

let _pollActive = false;
let _pollOffset = 0;

async function startLongPolling() {
  if (!BOT_TOKEN) {
    console.warn('[Telegram] BOT_TOKEN not set — Telegram bot disabled');
    return;
  }
  if (WEBHOOK_URL) {
    console.log('[Telegram] WEBHOOK_URL set — skipping long-polling (use webhook mode)');
    return;
  }
  if (_pollActive) return;
  _pollActive = true;
  console.log('[Telegram] Starting long-polling…');

  // Force-clear any existing webhook or concurrent session.
  // drop_pending_updates: true also kills leftover sessions causing 409.
  try {
    await tgRequest('deleteWebhook', { drop_pending_updates: true }, 10000);
    console.log('[Telegram] Webhook cleared');
  } catch (e) {
    console.warn('[Telegram] deleteWebhook failed (non-fatal):', e.message);
  }

  // Give Telegram a moment to release the previous session before we start
  await new Promise(r => setTimeout(r, 2000));

  const poll = async () => {
    if (!_pollActive) return;
    try {
      const { result } = await tgRequest('getUpdates', {
        offset:  _pollOffset,
        timeout: 30,          // Telegram server-side long-poll seconds
        allowed_updates: ['message', 'edited_message']
      }, 35000);             // axios timeout must be > Telegram timeout (30s → 35s)
      for (const update of result || []) {
        _pollOffset = update.update_id + 1;
        processUpdate(update).catch(e => console.error('[Telegram] processUpdate error:', e.message));
      }
      // Success — next poll immediately after the long-poll returns
      if (_pollActive) setImmediate(poll);
    } catch (err) {
      if (!_pollActive) return;
      const status = err.response?.status;
      if (status === 409) {
        // Another instance is polling — wait longer before retrying
        console.warn('[Telegram] 409 Conflict — another instance detected, retrying in 5s…');
        setTimeout(poll, 5000);
      } else {
        console.error('[Telegram] Poll error:', err.message);
        setTimeout(poll, 2000);
      }
    }
  };

  poll();
}

function stopLongPolling() {
  _pollActive = false;
}

// ── Webhook registration (production) ────────────────────────────────────────

async function registerWebhook() {
  if (!BOT_TOKEN || !WEBHOOK_URL) return;
  try {
    const result = await tgRequest('setWebhook', {
      url: `${WEBHOOK_URL}/telegram/webhook`,
      allowed_updates: ['message', 'edited_message'],
      drop_pending_updates: true
    });
    console.log('[Telegram] Webhook registered:', result.description || result.ok);
  } catch (err) {
    console.error('[Telegram] Failed to register webhook:', err.message);
  }
}

async function getWebhookInfo() {
  if (!BOT_TOKEN) return null;
  return tgRequest('getWebhookInfo');
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Push a notification message to a specific Telegram chatId.
 * Called by webhookService or any other service.
 */
async function fireToTelegram(chatId, text) {
  return sendMessage(String(chatId), text);
}

/**
 * Get bot info (verifies token is valid).
 */
async function getBotInfo() {
  return tgRequest('getMe');
}

module.exports = {
  processUpdate,
  sendMessage,
  fireToTelegram,
  startLongPolling,
  stopLongPolling,
  registerWebhook,
  getWebhookInfo,
  getBotInfo,
  upsertTelegramUser,
  getTelegramUser
};
