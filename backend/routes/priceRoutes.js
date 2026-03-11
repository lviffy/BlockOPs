const express = require('express');
const router = express.Router();
const { getTokenPrice, getPriceHistory, getPriceChart } = require('../controllers/priceController');

// POST /price/token — current price (NLP query)
router.post('/token', getTokenPrice);

// GET /price/history/:coin — OHLCV candlestick data
router.get('/history/:coin', getPriceHistory);

// GET /price/chart/:coin — close-price series for charting
router.get('/chart/:coin', getPriceChart);

module.exports = router;
