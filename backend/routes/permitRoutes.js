const express = require('express');
const router = express.Router();
const { permitToken } = require('../controllers/permitController');

// POST /allowance/permit — EIP-2612 gasless permit
router.post('/', permitToken);

module.exports = router;
