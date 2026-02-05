const supabase = require('../config/supabase');
const { buildContext, truncateMessage } = require('../utils/memory');
const { chatWithAI } = require('../services/aiService');

/**
 * Main chat endpoint - handles conversation and AI response
 * POST /api/chat
 */
async function chat(req, res) {
  if (!supabase) {
    return res.status(503).json({ 
      error: 'Conversation service not available. Supabase not configured.' 
    });
  }

  try {
    const { agentId, userId, message, conversationId, systemPrompt } = req.body;

    // Validation
    if (!agentId || !userId || !message) {
      return res.status(400).json({ 
        error: 'Missing required fields: agentId, userId, message' 
      });
    }

    // Truncate message if too long
    const truncatedMessage = truncateMessage(message);

    // Get or create conversation
    let convId = conversationId;
    let isNewConversation = false;

    if (!convId) {
      // Create new conversation
      const { data, error } = await supabase
        .from('conversations')
        .insert({ 
          agent_id: agentId, 
          user_id: userId, 
          title: truncatedMessage.slice(0, 100) // Use first 100 chars as title
        })
        .select()
        .single();
      
      if (error) {
        console.error('Error creating conversation:', error);
        throw new Error('Failed to create conversation');
      }
      
      convId = data.id;
      isNewConversation = true;
    }

    // Save user message
    const { error: msgError } = await supabase
      .from('conversation_messages')
      .insert({ 
        conversation_id: convId, 
        role: 'user', 
        content: truncatedMessage 
      });

    if (msgError) {
      console.error('Error saving user message:', msgError);
      throw new Error('Failed to save message');
    }

    // Get conversation history (last 30 messages due to auto-cleanup)
    const { data: messages, error: fetchError } = await supabase
      .from('conversation_messages')
      .select('role, content, created_at')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true });

    if (fetchError) {
      console.error('Error fetching messages:', fetchError);
      throw new Error('Failed to fetch conversation history');
    }

    // Build context for AI (respects token limits)
    const defaultSystemPrompt = systemPrompt || 
      'You are a helpful AI assistant for blockchain operations. Provide clear, accurate, and concise responses. Use **bold** formatting sparingly and only for important terms or key points that need emphasis. Do not overuse formatting. IMPORTANT: You do not have access to real-time data, APIs, or tools. If asked about current prices, balances, or on-chain data, clearly state that you cannot fetch real-time data and the user should use the appropriate blockchain tools or APIs directly.';
    
    const { context, tokenCount } = buildContext(messages, defaultSystemPrompt);

    console.log(`[Chat] Context built: ${context.length} messages, ~${tokenCount} tokens`);

    // Call AI
    const aiResponse = await chatWithAI(context);

    // Save AI response
    const { error: aiMsgError } = await supabase
      .from('conversation_messages')
      .insert({ 
        conversation_id: convId, 
        role: 'assistant', 
        content: aiResponse 
      });

    if (aiMsgError) {
      console.error('Error saving AI message:', aiMsgError);
      // Don't throw - we already have the response
    }

    // Return response
    res.json({
      conversationId: convId,
      message: aiResponse,
      isNewConversation,
      messageCount: messages.length + 2, // +2 for the messages we just added
      tokenCount
    });

  } catch (error) {
    console.error('[Chat] Error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to process message' 
    });
  }
}

/**
 * List user's conversations
 * GET /api/conversations?userId=xxx&agentId=xxx&limit=20
 */
async function listConversations(req, res) {
  if (!supabase) {
    return res.status(503).json({ 
      error: 'Conversation service not available. Supabase not configured.' 
    });
  }

  try {
    const { userId, agentId, limit = 20 } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'Missing userId parameter' });
    }

    let query = supabase
      .from('conversations')
      .select('id, agent_id, title, message_count, created_at, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(parseInt(limit));

    if (agentId) {
      query = query.eq('agent_id', agentId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error listing conversations:', error);
      throw new Error('Failed to list conversations');
    }

    res.json({ 
      conversations: data,
      count: data.length 
    });

  } catch (error) {
    console.error('[List Conversations] Error:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Get messages for a conversation
 * GET /api/conversations/:conversationId/messages
 */
async function getMessages(req, res) {
  if (!supabase) {
    return res.status(503).json({ 
      error: 'Conversation service not available. Supabase not configured.' 
    });
  }

  try {
    const { conversationId } = req.params;
    const { limit = 50 } = req.query;

    const { data, error } = await supabase
      .from('conversation_messages')
      .select('id, role, content, tool_calls, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(parseInt(limit));

    if (error) {
      console.error('Error getting messages:', error);
      throw new Error('Failed to get messages');
    }

    res.json({ 
      messages: data,
      count: data.length 
    });

  } catch (error) {
    console.error('[Get Messages] Error:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Get a single conversation
 * GET /api/conversations/:conversationId
 */
async function getConversation(req, res) {
  if (!supabase) {
    return res.status(503).json({ 
      error: 'Conversation service not available. Supabase not configured.' 
    });
  }

  try {
    const { conversationId } = req.params;

    const { data, error } = await supabase
      .from('conversations')
      .select('id, agent_id, user_id, title, message_count, created_at, updated_at')
      .eq('id', conversationId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Conversation not found' });
      }
      throw error;
    }

    res.json({ conversation: data });

  } catch (error) {
    console.error('[Get Conversation] Error:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Delete a conversation
 * DELETE /api/conversations/:conversationId
 */
async function deleteConversation(req, res) {
  if (!supabase) {
    return res.status(503).json({ 
      error: 'Conversation service not available. Supabase not configured.' 
    });
  }

  try {
    const { conversationId } = req.params;

    const { error } = await supabase
      .from('conversations')
      .delete()
      .eq('id', conversationId);

    if (error) {
      console.error('Error deleting conversation:', error);
      throw new Error('Failed to delete conversation');
    }

    res.json({ 
      success: true,
      message: 'Conversation deleted successfully'
    });

  } catch (error) {
    console.error('[Delete Conversation] Error:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Update conversation title
 * PATCH /api/conversations/:conversationId
 */
async function updateConversation(req, res) {
  if (!supabase) {
    return res.status(503).json({ 
      error: 'Conversation service not available. Supabase not configured.' 
    });
  }

  try {
    const { conversationId } = req.params;
    const { title } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Missing title' });
    }

    const { data, error } = await supabase
      .from('conversations')
      .update({ title: title.slice(0, 200) })
      .eq('id', conversationId)
      .select()
      .single();

    if (error) {
      console.error('Error updating conversation:', error);
      throw new Error('Failed to update conversation');
    }

    res.json({ 
      conversation: data,
      message: 'Title updated successfully'
    });

  } catch (error) {
    console.error('[Update Conversation] Error:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Get database statistics (admin only)
 * GET /api/admin/stats
 */
async function getStats(req, res) {
  if (!supabase) {
    return res.status(503).json({ 
      error: 'Conversation service not available. Supabase not configured.' 
    });
  }

  try {
    // Check admin authorization
    const authHeader = req.headers.authorization;
    const expectedAuth = process.env.ADMIN_SECRET 
      ? `Bearer ${process.env.ADMIN_SECRET}`
      : null;

    if (!expectedAuth || authHeader !== expectedAuth) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { data, error } = await supabase.rpc('get_database_stats');

    if (error) {
      console.error('Error getting stats:', error);
      throw new Error('Failed to get statistics');
    }

    res.json({ stats: data[0] || {} });

  } catch (error) {
    console.error('[Get Stats] Error:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Manual cleanup endpoint (admin only)
 * POST /api/admin/cleanup
 */
async function runCleanup(req, res) {
  if (!supabase) {
    return res.status(503).json({ 
      error: 'Conversation service not available. Supabase not configured.' 
    });
  }

  try {
    // Check admin authorization
    const authHeader = req.headers.authorization;
    const expectedAuth = process.env.ADMIN_SECRET 
      ? `Bearer ${process.env.ADMIN_SECRET}`
      : null;

    if (!expectedAuth || authHeader !== expectedAuth) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const maxDelete = req.body.maxDelete || 100;

    const { data, error } = await supabase.rpc('delete_stale_conversations', {
      max_delete: maxDelete
    });

    if (error) {
      console.error('Error running cleanup:', error);
      throw new Error('Failed to run cleanup');
    }

    const deletedCount = data[0]?.deleted_count || 0;

    res.json({ 
      success: true,
      deletedCount,
      message: `Deleted ${deletedCount} stale conversation(s)`
    });

  } catch (error) {
    console.error('[Cleanup] Error:', error);
    res.status(500).json({ error: error.message });
  }
}

module.exports = {
  chat,
  listConversations,
  getMessages,
  getConversation,
  deleteConversation,
  updateConversation,
  getStats,
  runCleanup
};
