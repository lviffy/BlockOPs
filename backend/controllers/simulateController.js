const axios = require('axios');
const { ethers } = require('ethers');
const { getProvider } = require('../utils/blockchain');
const { successResponse, errorResponse, validateRequiredFields } = require('../utils/helpers');

const TENDERLY_BASE = 'https://api.tenderly.co/api/v1';
const TENDERLY_ACCOUNT = process.env.TENDERLY_ACCOUNT_SLUG;
const TENDERLY_PROJECT = process.env.TENDERLY_PROJECT_SLUG;
const TENDERLY_ACCESS_KEY = process.env.TENDERLY_ACCESS_KEY;

function tenderlyHeaders() {
  return { 'X-Access-Key': TENDERLY_ACCESS_KEY, 'Content-Type': 'application/json' };
}

/**
 * POST /simulate
 * Simulate a transaction via Tenderly before sending it on-chain.
 * Body: {
 *   from, to, value?, data?, gas?, gasPrice?,
 *   abi? (array), functionName? (string), args? (array)  — builds calldata automatically
 * }
 */
async function simulateTransaction(req, res) {
  try {
    const { from, to, value, data, gas, gasPrice, abi, functionName, args } = req.body;

    if (!to) return res.status(400).json(errorResponse('"to" address is required'));
    if (!from) return res.status(400).json(errorResponse('"from" address is required'));

    // ── Build calldata from ABI if provided ──────────────────────────────────
    let calldata = data || '0x';
    if (abi && functionName) {
      try {
        const iface = new ethers.Interface(abi);
        calldata = iface.encodeFunctionData(functionName, args || []);
      } catch (e) {
        return res.status(400).json(errorResponse('Failed to encode calldata', e.message));
      }
    }

    // ── Tenderly simulation ─────────────────────────────────────────────────
    if (TENDERLY_ACCESS_KEY && TENDERLY_ACCOUNT && TENDERLY_PROJECT) {
      try {
        const provider = getProvider();
        const network = await provider.getNetwork();

        const payload = {
          network_id: String(network.chainId),
          from,
          to,
          input: calldata,
          value: value ? String(value) : '0',
          gas: gas || 500000,
          gas_price: gasPrice || '0',
          save: false,
          save_if_fails: false
        };

        const { data: result } = await axios.post(
          `${TENDERLY_BASE}/account/${TENDERLY_ACCOUNT}/project/${TENDERLY_PROJECT}/simulate`,
          payload,
          { headers: tenderlyHeaders(), timeout: 20000 }
        );

        const sim = result.transaction;
        const calls = result.transaction?.transaction_info?.call_trace;

        return res.json(successResponse({
          source: 'Tenderly',
          status: sim?.status ? 'success' : 'reverted',
          gasUsed: sim?.gas_used,
          gasLimit: sim?.gas,
          revertReason: sim?.error_message || null,
          logs: (result.transaction?.transaction_info?.logs || []).map(l => ({
            address: l.raw?.address,
            topics: l.raw?.topics,
            data: l.raw?.data
          })),
          callTrace: calls ? { type: calls.type, from: calls.from, to: calls.to, output: calls.output } : null,
          balanceChanges: result.transaction?.transaction_info?.balance_diff || [],
          tenderlyUrl: `https://www.tenderly.co/tx/${network.chainId}/${sim?.hash}`
        }));
      } catch (tenderlyError) {
        console.warn('Tenderly API error, falling back to eth_call:', tenderlyError.response?.data?.error || tenderlyError.message);
      }
    }

    // ── Fallback: eth_call dry-run ─────────────────────────────────────────
    const provider = getProvider();
    let gasUsed = null;
    let revertReason = null;
    let success = false;

    try {
      const result = await provider.call({ from, to, data: calldata, value: value || 0 });
      success = true;

      // Estimate gas
      try {
        const gasEst = await provider.estimateGas({ from, to, data: calldata, value: value || 0 });
        gasUsed = gasEst.toString();
      } catch {}

      return res.json(successResponse({
        source: 'eth_call',
        status: 'success',
        gasUsed,
        returnData: result,
        note: 'Tenderly not configured. Set TENDERLY_ACCESS_KEY, TENDERLY_ACCOUNT_SLUG, TENDERLY_PROJECT_SLUG for richer simulation.'
      }));
    } catch (callError) {
      // Decode revert
      revertReason = callError.message;
      try {
        const reason = callError.data;
        if (reason && reason.startsWith('0x08c379a0')) {
          const decoded = ethers.AbiCoder.defaultAbiCoder().decode(['string'], '0x' + reason.slice(10));
          revertReason = decoded[0];
        }
      } catch {}

      return res.json(successResponse({
        source: 'eth_call',
        status: 'reverted',
        revertReason,
        gasUsed: null
      }));
    }
  } catch (error) {
    console.error('Simulate error:', error);
    return res.status(500).json(errorResponse('Simulation failed', error.message));
  }
}

module.exports = { simulateTransaction };
