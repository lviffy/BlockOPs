const { ethers } = require('ethers');
const { getProvider } = require('../utils/blockchain');
const { successResponse, errorResponse } = require('../utils/helpers');

/**
 * GET /tx/status/:hash/stream
 * Server-Sent Events stream that pushes live transaction confirmation status.
 * The client connects once and receives events until the tx is confirmed or a timeout occurs.
 */
async function streamTxStatus(req, res) {
  const { hash } = req.params;

  if (!hash || !/^0x[0-9a-fA-F]{64}$/.test(hash)) {
    return res.status(400).json(errorResponse('Invalid transaction hash'));
  }

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  res.flushHeaders();

  const send = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    // res.flush() if available (compression middleware)
    if (typeof res.flush === 'function') res.flush();
  };

  const provider = getProvider();
  const POLL_INTERVAL_MS = 3000;
  const TIMEOUT_MS = 120_000; // 2 minutes max
  const startTime = Date.now();

  send('status', { txHash: hash, state: 'watching', message: 'Watching for transaction...' });

  // Check for existing receipt first
  try {
    const receipt = await provider.getTransactionReceipt(hash);
    if (receipt) {
      const state = receipt.status === 1 ? 'confirmed' : 'failed';
      send('status', {
        txHash: hash,
        state,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        confirmations: (await provider.getBlockNumber()) - receipt.blockNumber,
        status: receipt.status
      });
      send('done', { txHash: hash, state });
      return res.end();
    }
  } catch {}

  // Poll until confirmed or timed out
  const interval = setInterval(async () => {
    if (Date.now() - startTime > TIMEOUT_MS) {
      send('timeout', { txHash: hash, message: 'No confirmation after 2 minutes' });
      send('done', { txHash: hash, state: 'timeout' });
      clearInterval(interval);
      return res.end();
    }

    try {
      // Check mempool first
      const pendingTx = await provider.getTransaction(hash);
      if (!pendingTx) {
        send('status', { txHash: hash, state: 'not_found', message: 'Transaction not found in mempool yet' });
        return;
      }

      send('status', { txHash: hash, state: 'pending', nonce: pendingTx.nonce, gasPrice: pendingTx.gasPrice?.toString() });

      const receipt = await provider.getTransactionReceipt(hash);
      if (receipt) {
        const latestBlock = await provider.getBlockNumber();
        const confirmations = latestBlock - receipt.blockNumber;
        const state = receipt.status === 1 ? 'confirmed' : 'failed';

        send('status', {
          txHash: hash,
          state,
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed.toString(),
          effectiveGasPrice: receipt.gasPrice?.toString(),
          confirmations,
          status: receipt.status
        });

        if (confirmations >= 1) {
          send('done', { txHash: hash, state });
          clearInterval(interval);
          res.end();
        }
      }
    } catch (error) {
      send('error', { txHash: hash, message: error.message });
    }
  }, POLL_INTERVAL_MS);

  // Clean up when client disconnects
  req.on('close', () => {
    clearInterval(interval);
  });
}

/**
 * GET /tx/status/:hash
 * One-shot (non-streaming) transaction status check
 */
async function getTxStatus(req, res) {
  const { hash } = req.params;
  if (!hash || !/^0x[0-9a-fA-F]{64}$/.test(hash)) {
    return res.status(400).json(errorResponse('Invalid transaction hash'));
  }

  try {
    const provider = getProvider();
    const [tx, receipt] = await Promise.all([
      provider.getTransaction(hash),
      provider.getTransactionReceipt(hash)
    ]);

    if (!tx && !receipt) {
      return res.status(404).json(errorResponse('Transaction not found'));
    }

    const latestBlock = await provider.getBlockNumber();

    return res.json(successResponse({
      txHash: hash,
      state: receipt ? (receipt.status === 1 ? 'confirmed' : 'failed') : 'pending',
      blockNumber: receipt?.blockNumber || null,
      confirmations: receipt ? latestBlock - receipt.blockNumber : 0,
      gasUsed: receipt?.gasUsed.toString() || null,
      status: receipt?.status ?? null,
      from: tx?.from || null,
      to: tx?.to || null,
      value: tx?.value?.toString() || null,
      nonce: tx?.nonce ?? null
    }));
  } catch (error) {
    return res.status(500).json(errorResponse('Failed to fetch tx status', error.message));
  }
}

module.exports = { streamTxStatus, getTxStatus };
