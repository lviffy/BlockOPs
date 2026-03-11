const crypto = require('crypto');
const supabase = require('../config/supabase');
const { successResponse, errorResponse } = require('../utils/helpers');

const SESSION_EXPIRY_MINUTES = 30;

/**
 * Encrypt a private key for short-term session storage
 * Uses AES-256-GCM with a random IV per session
 */
function encryptKey(privateKey) {
  const masterSecret = process.env.SESSION_MASTER_SECRET;
  if (!masterSecret || masterSecret.length < 32) {
    throw new Error('SESSION_MASTER_SECRET must be set (min 32 chars) to use session-based signing');
  }
  const keyBuf = crypto.createHash('sha256').update(masterSecret).digest();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyBuf, iv);
  const encrypted = Buffer.concat([cipher.update(privateKey, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

/**
 * Decrypt a stored private key
 */
function decryptKey(encryptedB64) {
  const masterSecret = process.env.SESSION_MASTER_SECRET;
  if (!masterSecret) throw new Error('SESSION_MASTER_SECRET not configured');
  const keyBuf = crypto.createHash('sha256').update(masterSecret).digest();
  const buf = Buffer.from(encryptedB64, 'base64');
  const iv = buf.slice(0, 16);
  const authTag = buf.slice(16, 32);
  const encrypted = buf.slice(32);
  const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuf, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

// In-memory session store (Redis recommended in production)
const sessions = new Map();

/**
 * POST /signing/session
 * Store a private key in an encrypted server-side session.
 * Returns a sessionToken — never returns the raw key again.
 * Body: { privateKey }
 */
async function createSession(req, res) {
  try {
    const { privateKey } = req.body;
    if (!privateKey) return res.status(400).json(errorResponse('privateKey is required'));

    // Validate the key is a valid hex private key
    if (!/^(0x)?[0-9a-fA-F]{64}$/.test(privateKey)) {
      return res.status(400).json(errorResponse('Invalid private key format'));
    }

    const sessionToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + SESSION_EXPIRY_MINUTES * 60 * 1000;

    const encrypted = encryptKey(privateKey.startsWith('0x') ? privateKey : '0x' + privateKey);

    sessions.set(sessionToken, { encrypted, expiresAt });

    // Prune expired sessions
    for (const [token, data] of sessions.entries()) {
      if (data.expiresAt < Date.now()) sessions.delete(token);
    }

    return res.json(successResponse({
      sessionToken,
      expiresAt: new Date(expiresAt).toISOString(),
      expiresInMinutes: SESSION_EXPIRY_MINUTES,
      note: 'Use this sessionToken instead of your privateKey for subsequent transaction calls. It expires after ' + SESSION_EXPIRY_MINUTES + ' minutes.'
    }));
  } catch (error) {
    console.error('Create session error:', error);
    return res.status(500).json(errorResponse(error.message));
  }
}

/**
 * DELETE /signing/session
 * Revoke a session token immediately
 * Body: { sessionToken }
 */
async function revokeSession(req, res) {
  try {
    const { sessionToken } = req.body;
    if (!sessionToken) return res.status(400).json(errorResponse('sessionToken is required'));

    const existed = sessions.has(sessionToken);
    sessions.delete(sessionToken);

    return res.json(successResponse({ revoked: existed }));
  } catch (error) {
    return res.status(500).json(errorResponse(error.message));
  }
}

/**
 * Resolve a privateKey or sessionToken to a private key string.
 * Used by other controllers that want to support both auth methods.
 */
function resolvePrivateKey(body) {
  if (body.privateKey) return { key: body.privateKey, fromSession: false };
  if (body.sessionToken) {
    const session = sessions.get(body.sessionToken);
    if (!session) throw new Error('Session not found or expired');
    if (session.expiresAt < Date.now()) {
      sessions.delete(body.sessionToken);
      throw new Error('Session has expired. Create a new session via POST /signing/session');
    }
    return { key: decryptKey(session.encrypted), fromSession: true };
  }
  throw new Error('Either privateKey or sessionToken is required');
}

module.exports = { createSession, revokeSession, resolvePrivateKey };
