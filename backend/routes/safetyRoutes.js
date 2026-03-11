const express = require('express');
const router = express.Router();
const { checkContractSafety } = require('../controllers/safetyController');

// POST /safety/check — run pre-flight risk checks on a contract
router.post('/check', checkContractSafety);

module.exports = router;
