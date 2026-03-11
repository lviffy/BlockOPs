const express = require('express');
const router = express.Router();
const { uploadToIPFS, getIPFSMetadata, listPins } = require('../controllers/ipfsController');

// POST /ipfs/upload — pin JSON or file to IPFS
router.post('/upload', uploadToIPFS);

// GET /ipfs/metadata/:cid — fetch metadata from IPFS gateway
router.get('/metadata/:cid', getIPFSMetadata);

// GET /ipfs/pins — list pinned files
router.get('/pins', listPins);

module.exports = router;
