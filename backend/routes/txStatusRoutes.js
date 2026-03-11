const express = require('express');
const router = express.Router();
const { streamTxStatus, getTxStatus } = require('../controllers/txStatusController');

// GET /tx/status/:hash — one-shot status check
router.get('/status/:hash', getTxStatus);

// GET /tx/status/:hash/stream — SSE live status stream
router.get('/status/:hash/stream', streamTxStatus);

module.exports = router;
