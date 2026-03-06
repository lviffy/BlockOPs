/**
 * Agent Controller
 * 
 * Manages custom AI agents with API keys.
 * Each agent has:
 *   • Custom system prompt (personality)
 *   • Specific tool set (enabled_tools array)
 *   • Optional pre-configured wallet
 *   • API key for authentication
 * 
 * Users create agents via the web UI, then link them to Telegram
 * via /connect <agent-id> <api-key> command.
 */

const crypto = require('crypto');
const bcrypt = require('bcrypt');
const supabase = require('../config/supabase');

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Generate API key
// ─────────────────────────────────────────────────────────────────────────────

function generateApiKey() {
  const randomPart = crypto.randomBytes(32).toString('hex');
  return `bops_${randomPart}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /agents — Create a new agent
// ─────────────────────────────────────────────────────────────────────────────

async function createAgent(req, res) {
  try {
    const { 
      userId,           // owner ID (from auth or request)
      name, 
      description, 
      systemPrompt, 
      enabledTools,     // array of tool names
      walletAddress,
      avatarUrl,
      isPublic = false
    } = req.body;

    if (!userId || !name) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: userId, name' 
      });
    }

    // Generate API key
    const apiKey = generateApiKey();
    const apiKeyHash = await bcrypt.hash(apiKey, 12);
    const apiKeyPrefix = apiKey.slice(0, 12) + '...';

    // Insert into database
    const { data, error } = await supabase
      .from('agents')
      .insert({
        user_id: userId,
        name,
        description: description || null,
        system_prompt: systemPrompt || null,
        enabled_tools: enabledTools || null,
        wallet_address: walletAddress || null,
        api_key_hash: apiKeyHash,
        api_key_prefix: apiKeyPrefix,
        avatar_url: avatarUrl || null,
        is_public: isPublic
      })
      .select()
      .single();

    if (error) {
      console.error('[Agent] Create error:', error);
      return res.status(500).json({ success: false, error: error.message });
    }

    return res.json({
      success: true,
      agent: {
        id: data.id,
        name: data.name,
        description: data.description,
        apiKey,  // ⚠️ ONLY shown once
        apiKeyPrefix: data.api_key_prefix,
        enabledTools: data.enabled_tools,
        walletAddress: data.wallet_address,
        createdAt: data.created_at
      },
      warning: 'Save this API key now. You won\'t be able to see it again.'
    });

  } catch (err) {
    console.error('[Agent] Create error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /agents — List all agents for a user
// ─────────────────────────────────────────────────────────────────────────────

async function listAgents(req, res) {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing userId parameter' 
      });
    }

    const { data, error } = await supabase
      .from('agents')
      .select('id, name, description, api_key_prefix, enabled_tools, wallet_address, is_public, created_at, updated_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Agent] List error:', error);
      return res.status(500).json({ success: false, error: error.message });
    }

    // Check if any agents are linked to Telegram
    const agentIds = data.map(a => a.id);
    let linkedMap = {};
    
    if (agentIds.length > 0) {
      const { data: telegramLinks } = await supabase
        .from('telegram_users')
        .select('linked_agent_id, chat_id')
        .in('linked_agent_id', agentIds)
        .not('linked_agent_id', 'is', null);
      
      if (telegramLinks) {
        telegramLinks.forEach(link => {
          linkedMap[link.linked_agent_id] = link.chat_id;
        });
      }
    }

    // Enrich agent list with Telegram status
    const agents = data.map(agent => ({
      ...agent,
      linkedToTelegram: !!linkedMap[agent.id],
      telegramChatId: linkedMap[agent.id] || null
    }));

    return res.json({ success: true, agents });

  } catch (err) {
    console.error('[Agent] List error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /agents/:id — Get single agent details
// ─────────────────────────────────────────────────────────────────────────────

async function getAgent(req, res) {
  try {
    const { id } = req.params;
    const { userId } = req.query; // verify ownership

    const { data, error } = await supabase
      .from('agents')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return res.status(404).json({ success: false, error: 'Agent not found' });
    }

    // Verify ownership (optional: skip if public agent)
    if (userId && data.user_id !== userId && !data.is_public) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    // Check Telegram link status
    const { data: telegramLink } = await supabase
      .from('telegram_users')
      .select('chat_id, linked_at')
      .eq('linked_agent_id', id)
      .single();

    return res.json({
      success: true,
      agent: {
        id: data.id,
        userId: data.user_id,
        name: data.name,
        description: data.description,
        systemPrompt: data.system_prompt,
        enabledTools: data.enabled_tools,
        walletAddress: data.wallet_address,
        apiKeyPrefix: data.api_key_prefix,
        avatarUrl: data.avatar_url,
        isPublic: data.is_public,
        linkedToTelegram: !!telegramLink,
        telegramChatId: telegramLink?.chat_id || null,
        linkedAt: telegramLink?.linked_at || null,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      }
    });

  } catch (err) {
    console.error('[Agent] Get error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /agents/:id — Update agent config
// ─────────────────────────────────────────────────────────────────────────────

async function updateAgent(req, res) {
  try {
    const { id } = req.params;
    const { userId, name, description, systemPrompt, enabledTools, walletAddress, avatarUrl, isPublic } = req.body;

    // Verify ownership
    const { data: agent } = await supabase
      .from('agents')
      .select('user_id')
      .eq('id', id)
      .single();

    if (!agent) {
      return res.status(404).json({ success: false, error: 'Agent not found' });
    }

    if (userId && agent.user_id !== userId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    // Build update object (only update provided fields)
    const updates = { updated_at: new Date().toISOString() };
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (systemPrompt !== undefined) updates.system_prompt = systemPrompt;
    if (enabledTools !== undefined) updates.enabled_tools = enabledTools;
    if (walletAddress !== undefined) updates.wallet_address = walletAddress;
    if (avatarUrl !== undefined) updates.avatar_url = avatarUrl;
    if (isPublic !== undefined) updates.is_public = isPublic;

    const { data, error } = await supabase
      .from('agents')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[Agent] Update error:', error);
      return res.status(500).json({ success: false, error: error.message });
    }

    return res.json({
      success: true,
      agent: {
        id: data.id,
        name: data.name,
        description: data.description,
        systemPrompt: data.system_prompt,
        enabledTools: data.enabled_tools,
        walletAddress: data.wallet_address,
        updatedAt: data.updated_at
      }
    });

  } catch (err) {
    console.error('[Agent] Update error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /agents/:id/regenerate-key — Regenerate API key
// ─────────────────────────────────────────────────────────────────────────────

async function regenerateApiKey(req, res) {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    // Verify ownership
    const { data: agent } = await supabase
      .from('agents')
      .select('user_id')
      .eq('id', id)
      .single();

    if (!agent) {
      return res.status(404).json({ success: false, error: 'Agent not found' });
    }

    if (userId && agent.user_id !== userId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    // Generate new API key
    const newApiKey = generateApiKey();
    const newApiKeyHash = await bcrypt.hash(newApiKey, 12);
    const newApiKeyPrefix = newApiKey.slice(0, 12) + '...';

    // Update database
    const { error } = await supabase
      .from('agents')
      .update({
        api_key_hash: newApiKeyHash,
        api_key_prefix: newApiKeyPrefix,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) {
      console.error('[Agent] Regenerate key error:', error);
      return res.status(500).json({ success: false, error: error.message });
    }

    // Also update any linked Telegram users (so old hash is invalidated)
    await supabase
      .from('telegram_users')
      .update({ agent_api_key_hash: newApiKeyHash })
      .eq('linked_agent_id', id);

    return res.json({
      success: true,
      apiKey: newApiKey,  // ⚠️ ONLY shown once
      apiKeyPrefix: newApiKeyPrefix,
      warning: 'Old API key has been revoked. Update all integrations (Telegram, etc.)'
    });

  } catch (err) {
    console.error('[Agent] Regenerate key error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /agents/:id — Delete an agent
// ─────────────────────────────────────────────────────────────────────────────

async function deleteAgent(req, res) {
  try {
    const { id } = req.params;
    const { userId } = req.query;

    // Verify ownership
    const { data: agent } = await supabase
      .from('agents')
      .select('user_id, name')
      .eq('id', id)
      .single();

    if (!agent) {
      return res.status(404).json({ success: false, error: 'Agent not found' });
    }

    if (userId && agent.user_id !== userId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    // Unlink from any Telegram chats (foreign key ON DELETE SET NULL will handle this automatically)
    // But we'll explicitly clear for logging
    const { data: linkedChats } = await supabase
      .from('telegram_users')
      .select('chat_id')
      .eq('linked_agent_id', id);

    // Delete agent
    const { error } = await supabase
      .from('agents')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[Agent] Delete error:', error);
      return res.status(500).json({ success: false, error: error.message });
    }

    return res.json({
      success: true,
      message: `Agent "${agent.name}" deleted`,
      unlinkedChats: linkedChats?.length || 0
    });

  } catch (err) {
    console.error('[Agent] Delete error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Get agent by ID (internal, used by telegramService)
// ─────────────────────────────────────────────────────────────────────────────

async function getAgentById(agentId) {
  try {
    const { data } = await supabase
      .from('agents')
      .select('*')
      .eq('id', agentId)
      .single();
    return data;
  } catch (err) {
    console.error('[Agent] getAgentById error:', err);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Verify API key (used during Telegram /connect)
// ─────────────────────────────────────────────────────────────────────────────

async function verifyApiKey(agentId, apiKey) {
  try {
    const { data } = await supabase
      .from('agents')
      .select('api_key_hash')
      .eq('id', agentId)
      .single();

    if (!data) return false;
    
    return await bcrypt.compare(apiKey, data.api_key_hash);
  } catch (err) {
    console.error('[Agent] verifyApiKey error:', err);
    return false;
  }
}

module.exports = {
  createAgent,
  listAgents,
  getAgent,
  updateAgent,
  regenerateApiKey,
  deleteAgent,
  getAgentById,
  verifyApiKey
};
