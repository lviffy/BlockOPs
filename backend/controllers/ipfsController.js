const axios = require('axios');
const FormData = require('form-data');
const { PINATA_API_KEY, PINATA_SECRET_KEY } = require('../config/constants');
const { successResponse, errorResponse, validateRequiredFields } = require('../utils/helpers');

const PINATA_BASE = 'https://api.pinata.cloud';
const IPFS_GATEWAY = 'https://gateway.pinata.cloud/ipfs';

function pinataHeaders() {
  return {
    pinata_api_key: PINATA_API_KEY,
    pinata_secret_api_key: PINATA_SECRET_KEY
  };
}

/**
 * POST /ipfs/upload
 * Pin JSON metadata or a file to IPFS via Pinata
 * Body: { json?: object, name?: string } — for JSON upload
 *       { base64?: string, mimeType?: string, name?: string } — for file upload
 */
async function uploadToIPFS(req, res) {
  try {
    if (!PINATA_API_KEY || !PINATA_SECRET_KEY) {
      return res.status(503).json(errorResponse('Pinata credentials not configured. Set PINATA_API_KEY and PINATA_SECRET_KEY in .env'));
    }

    const { json, base64, mimeType, name } = req.body;

    if (!json && !base64) {
      return res.status(400).json(errorResponse('Provide either "json" (object) or "base64" (base64-encoded file content)'));
    }

    let cid, size;

    if (json) {
      // Pin JSON
      const payload = {
        pinataContent: json,
        pinataMetadata: { name: name || `blockops-metadata-${Date.now()}` }
      };
      const { data } = await axios.post(`${PINATA_BASE}/pinning/pinJSONToIPFS`, payload, {
        headers: { ...pinataHeaders(), 'Content-Type': 'application/json' }
      });
      cid = data.IpfsHash;
      size = data.PinSize;
    } else {
      // Pin binary/file
      const buf = Buffer.from(base64, 'base64');
      const form = new FormData();
      form.append('file', buf, {
        filename: name || `upload-${Date.now()}`,
        contentType: mimeType || 'application/octet-stream'
      });
      form.append('pinataMetadata', JSON.stringify({ name: name || `blockops-file-${Date.now()}` }));
      const { data } = await axios.post(`${PINATA_BASE}/pinning/pinFileToIPFS`, form, {
        headers: { ...pinataHeaders(), ...form.getHeaders() },
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      });
      cid = data.IpfsHash;
      size = data.PinSize;
    }

    return res.json(successResponse({
      cid,
      url: `ipfs://${cid}`,
      gatewayUrl: `${IPFS_GATEWAY}/${cid}`,
      size,
      name: name || null
    }));
  } catch (error) {
    console.error('IPFS upload error:', error.response?.data || error.message);
    return res.status(500).json(errorResponse('IPFS upload failed', error.response?.data?.error || error.message));
  }
}

/**
 * GET /ipfs/metadata/:cid
 * Fetch JSON metadata from IPFS gateway
 */
async function getIPFSMetadata(req, res) {
  try {
    const { cid } = req.params;
    if (!cid) return res.status(400).json(errorResponse('CID is required'));

    const { data } = await axios.get(`${IPFS_GATEWAY}/${cid}`, { timeout: 15000 });

    return res.json(successResponse({
      cid,
      gatewayUrl: `${IPFS_GATEWAY}/${cid}`,
      metadata: data
    }));
  } catch (error) {
    console.error('IPFS fetch error:', error.message);
    return res.status(500).json(errorResponse('Failed to fetch IPFS metadata', error.message));
  }
}

/**
 * GET /ipfs/pins
 * List pinned files for this Pinata account
 */
async function listPins(req, res) {
  try {
    if (!PINATA_API_KEY || !PINATA_SECRET_KEY) {
      return res.status(503).json(errorResponse('Pinata credentials not configured'));
    }
    const { pageLimit = 20, pageOffset = 0 } = req.query;
    const { data } = await axios.get(`${PINATA_BASE}/data/pinList`, {
      headers: pinataHeaders(),
      params: { status: 'pinned', pageLimit, pageOffset }
    });
    return res.json(successResponse({ pins: data.rows, count: data.count }));
  } catch (error) {
    console.error('IPFS list pins error:', error.response?.data || error.message);
    return res.status(500).json(errorResponse('Failed to list pins', error.message));
  }
}

module.exports = { uploadToIPFS, getIPFSMetadata, listPins };
