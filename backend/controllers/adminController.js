const supabase = require('../config/supabase');
const { successResponse, errorResponse } = require('../utils/helpers');
const crypto = require('crypto');

const ADMIN_SECRET = process.env.ADMIN_SECRET;

function checkAdminAuth(req, res) {
  const provided = req.headers['x-admin-secret'] || req.query.secret;
  if (!ADMIN_SECRET) {
    return res.status(503).json(errorResponse('Admin dashboard not configured. Set ADMIN_SECRET in .env'));
  }
  if (!provided || !crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(ADMIN_SECRET))) {
    return res.status(403).json(errorResponse('Invalid admin secret'));
  }
  return null;
}

/**
 * GET /admin/stats
 * Aggregate usage statistics
 */
async function getStats(req, res) {
  const authError = checkAdminAuth(req, res);
  if (authError) return authError;

  try {
    if (!supabase) return res.status(503).json(errorResponse('Database not configured'));

    const [
      { count: totalUsers },
      { count: totalAgents },
      { count: totalConversations },
      { count: conversationsToday },
      { count: webhookDeliveries },
      { count: webhookFailures },
      { count: scheduleJobs }
    ] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('agents').select('*', { count: 'exact', head: true }),
      supabase.from('conversations').select('*', { count: 'exact', head: true }),
      supabase.from('conversations').select('*', { count: 'exact', head: true })
        .gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
      supabase.from('webhook_delivery_logs').select('*', { count: 'exact', head: true }),
      supabase.from('webhook_delivery_logs').select('*', { count: 'exact', head: true }).eq('success', false),
      supabase.from('scheduled_jobs').select('*', { count: 'exact', head: true })
    ]);

    // Recent errors from conversations (last 24h)
    const yesterday = new Date(Date.now() - 86_400_000).toISOString();
    const { data: recentConvs } = await supabase
      .from('conversations')
      .select('agent_id, created_at')
      .gte('created_at', yesterday)
      .order('created_at', { ascending: false })
      .limit(100);

    // Top agents by conversation count today
    const agentCounts = {};
    for (const c of (recentConvs || [])) {
      agentCounts[c.agent_id] = (agentCounts[c.agent_id] || 0) + 1;
    }
    const topAgents = Object.entries(agentCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([agentId, count]) => ({ agentId, conversationsLast24h: count }));

    return res.json(successResponse({
      totals: {
        users: totalUsers,
        agents: totalAgents,
        conversations: totalConversations,
        conversationsToday,
        webhookDeliveries,
        webhookFailures,
        webhookSuccessRate: webhookDeliveries
          ? ((1 - webhookFailures / webhookDeliveries) * 100).toFixed(1) + '%'
          : 'N/A',
        scheduledJobs: scheduleJobs
      },
      topAgentsLast24h: topAgents,
      generatedAt: new Date().toISOString()
    }));
  } catch (error) {
    console.error('Admin stats error:', error);
    return res.status(500).json(errorResponse('Failed to fetch stats', error.message));
  }
}

/**
 * GET /admin/agents
 * List all agents with usage metrics
 */
async function listAgents(req, res) {
  const authError = checkAdminAuth(req, res);
  if (authError) return authError;

  try {
    if (!supabase) return res.status(503).json(errorResponse('Database not configured'));

    const { data: agents, error } = await supabase
      .from('agents')
      .select('id, name, description, created_at, user_id, is_active')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) throw error;
    return res.json(successResponse({ agents, count: agents.length }));
  } catch (error) {
    return res.status(500).json(errorResponse('Failed to fetch agents', error.message));
  }
}

/**
 * GET /admin/webhook-logs
 * Recent webhook delivery log (last 100 entries)
 */
async function getWebhookLogs(req, res) {
  const authError = checkAdminAuth(req, res);
  if (authError) return authError;

  try {
    if (!supabase) return res.status(503).json(errorResponse('Database not configured'));

    const { data: logs, error } = await supabase
      .from('webhook_delivery_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;
    return res.json(successResponse({ logs, count: logs.length }));
  } catch (error) {
    return res.status(500).json(errorResponse('Failed to fetch webhook logs', error.message));
  }
}

module.exports = { getStats, listAgents, getWebhookLogs };
