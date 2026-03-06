/**
 * Agent Routes
 * 
 * RESTful API for managing custom AI agents.
 * All routes require API key authentication (via apiKeyAuth middleware).
 */

const express = require('express');
const router = express.Router();
const {
  createAgent,
  listAgents,
  getAgent,
  updateAgent,
  regenerateApiKey,
  deleteAgent
} = require('../controllers/agentController');

// ─────────────────────────────────────────────────────────────────────────────
// Agent CRUD
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /agents
 * Create a new agent and get an API key (shown only once)
 * 
 * Body: { userId, name, description?, systemPrompt?, enabledTools?, walletAddress?, isPublic? }
 * Response: { success, agent: { id, name, apiKey, ... }, warning }
 */
router.post('/', createAgent);

/**
 * GET /agents?userId=xxx
 * List all agents for a user
 * 
 * Response: { success, agents: [...] }
 */
router.get('/', listAgents);

/**
 * GET /agents/:id?userId=xxx
 * Get single agent details (with Telegram link status)
 * 
 * Response: { success, agent: { ..., linkedToTelegram, telegramChatId } }
 */
router.get('/:id', getAgent);

/**
 * PATCH /agents/:id
 * Update agent configuration
 * 
 * Body: { userId, name?, description?, systemPrompt?, enabledTools?, ... }
 * Response: { success, agent: { ... } }
 */
router.patch('/:id', updateAgent);

/**
 * POST /agents/:id/regenerate-key
 * Regenerate API key (old key becomes invalid)
 * 
 * Body: { userId }
 * Response: { success, apiKey, apiKeyPrefix, warning }
 */
router.post('/:id/regenerate-key', regenerateApiKey);

/**
 * DELETE /agents/:id?userId=xxx
 * Delete an agent (also unlinks from Telegram)
 * 
 * Response: { success, message, unlinkedChats }
 */
router.delete('/:id', deleteAgent);

module.exports = router;
