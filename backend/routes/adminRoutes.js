const express = require('express');
const router = express.Router();
const { getStats, listAgents, getWebhookLogs } = require('../controllers/adminController');

// GET /admin/stats — aggregate platform statistics
router.get('/stats', getStats);

// GET /admin/agents — list all agents
router.get('/agents', listAgents);

// GET /admin/webhook-logs — recent webhook delivery log
router.get('/webhook-logs', getWebhookLogs);

module.exports = router;
