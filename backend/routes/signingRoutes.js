const express = require('express');
const router = express.Router();
const { createSession, revokeSession } = require('../controllers/signingController');

// POST /signing/session — store encrypted private key, get back a sessionToken
router.post('/session', createSession);

// DELETE /signing/session — revoke a session token
router.delete('/session', revokeSession);

module.exports = router;
