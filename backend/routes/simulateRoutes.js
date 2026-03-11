const express = require('express');
const router = express.Router();
const { simulateTransaction } = require('../controllers/simulateController');

// POST /simulate — simulate a tx via Tenderly or eth_call fallback
router.post('/', simulateTransaction);

module.exports = router;
