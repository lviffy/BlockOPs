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
const supabase = require('../config/supabase');

const BOT_TOKEN    = process.env.TELEGRAM_BOT_TOKEN || '';
const WEBHOOK_URL  = process.env.TELEGRAM_WEBHOOK_URL || '';
const BACKEND_URL  = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3000}`;
const MASTER_KEY   = process.env.MASTER_API_KEY || '';

const TG_API = BOT_TOKEN ? `https://api.telegram.org/bot${BOT_TOKEN}` : null;

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
    console.error(`[Telegram] sendMessage to ${chatId} failed:`, err.message);
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
    `I'm your on-chain assistant. Here's what you can do:\n\n` +
    `🔹 /balance \`<address>\` — check ETH balance\n` +
    `🔹 /price \`<token>\` — get token price (e.g. /price ETH)\n` +
    `🔹 /status \`<txHash>\` — look up a transaction\n` +
    `🔹 /help — show this menu\n\n` +
    `Or just type any blockchain question in plain English!`
  );
}

async function handleHelp(chatId) {
  await sendMessage(chatId,
    `*BlockOps Bot Commands*\n\n` +
    `/balance \`<address>\` — ETH balance for an address\n` +
    `/price \`<token>\` — current token price\n` +
    `/status \`<txHash>\` — transaction status\n` +
    `/help — this message\n\n` +
    `You can also ask me anything in plain English, e.g.:\n` +
    `_"What is the gas price right now?"_\n` +
    `_"Show me the portfolio for 0x1234..."_`
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
    await sendMessage(chatId, `💰 Balance for \`${address.slice(0, 10)}...\`\n*${bal} ETH*`);
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

// ── Free-text → AI chat pipeline ─────────────────────────────────────────────

async function handleFreeText(chatId, text, user) {
  // Ensure user exists
  await upsertTelegramUser({ chatId, username: user.username, firstName: user.first_name });

  // Use chatId as both agentId + userId for Telegram sessions
  // (real agents can link their agentId via /start <agentId>)
  const telegramUser = await getTelegramUser(chatId);
  // Use the row's UUID (telegram_users.id) so conversations.agent_id (UUID) stays valid.
  // Fall back to agent_id column if the user linked a real BlockOps agent.
  const agentId = telegramUser?.agent_id || telegramUser?.id || `tg-${chatId}`;
  const userId  = `tg-user-${chatId}`;

  // Send "typing…" indicator
  await tgRequest('sendChatAction', { chat_id: chatId, action: 'typing' }).catch(() => {});

  try {
    const { data } = await axios.post(`${BACKEND_URL}/api/chat`, {
      agentId,
      userId,
      message: text
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
      case 'start': return handleStart(chatId, user);
      case 'help':  return handleHelp(chatId);
      case 'balance': return handleBalance(chatId, args);
      case 'price':   return handlePrice(chatId, args);
      case 'status':  return handleStatus(chatId, args);
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
