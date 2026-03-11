const axios = require('axios');
const { ETHERSCAN_API_KEY, ARBITRUM_SEPOLIA_CHAIN_ID, ARBITRUM_SEPOLIA_RPC } = require('../config/constants');
const { successResponse, errorResponse, validateRequiredFields } = require('../utils/helpers');
const { ethers } = require('ethers');
const { getProvider } = require('../utils/blockchain');

const ETHERSCAN_BASE = 'https://api.etherscan.io/v2/api';

// Public blocklist sources checked as part of safety analysis
const KNOWN_SCAM_PATTERNS = [
  /airdrop.*claim/i,
  /free.*token/i,
  /verify.*wallet/i,
  /security.*update/i
];

/**
 * POST /safety/check
 * Run pre-flight risk checks on a contract address before approving or interacting
 * Body: { contractAddress, spenderAddress? }
 */
async function checkContractSafety(req, res) {
  try {
    const { contractAddress, spenderAddress } = req.body;

    const validationError = validateRequiredFields(req.body, ['contractAddress']);
    if (validationError) return res.status(400).json(validationError);

    if (!ethers.isAddress(contractAddress)) {
      return res.status(400).json(errorResponse('Invalid contract address'));
    }

    const provider = getProvider();
    const results = {
      address: contractAddress,
      checks: {},
      riskScore: 0,          // 0 = safe, higher = riskier
      riskLevel: 'unknown',  // safe / low / medium / high
      warnings: [],
      recommendation: ''
    };

    // ── 1. Is it a contract (has code)? ─────────────────────────────────────
    const code = await provider.getCode(contractAddress);
    results.checks.isContract = code !== '0x';
    if (!results.checks.isContract) {
      results.warnings.push('Address has no bytecode — this is an EOA (wallet), not a contract');
      results.riskScore += 20;
    }

    // ── 2. Etherscan verification ────────────────────────────────────────────
    try {
      const { data: verifyData } = await axios.get(ETHERSCAN_BASE, {
        params: {
          chainid: ARBITRUM_SEPOLIA_CHAIN_ID,
          module: 'contract',
          action: 'getsourcecode',
          address: contractAddress,
          apikey: ETHERSCAN_API_KEY
        },
        timeout: 10000
      });
      const src = verifyData?.result?.[0];
      results.checks.isVerified = src?.SourceCode && src.SourceCode !== '';
      results.checks.contractName = src?.ContractName || null;
      results.checks.compilerVersion = src?.CompilerVersion || null;
      if (!results.checks.isVerified) {
        results.warnings.push('Contract source is NOT verified on Etherscan — cannot inspect code');
        results.riskScore += 30;
      }
    } catch {
      results.checks.isVerified = null;
      results.warnings.push('Could not check Etherscan verification (API error)');
    }

    // ── 3. Contract name heuristic scam check ───────────────────────────────
    const name = results.checks.contractName || '';
    const scamNameMatch = KNOWN_SCAM_PATTERNS.some(p => p.test(name));
    results.checks.scamNamePattern = scamNameMatch;
    if (scamNameMatch) {
      results.warnings.push(`Contract name "${name}" matches common scam patterns`);
      results.riskScore += 40;
    }

    // ── 4. Age / first tx check via Etherscan ───────────────────────────────
    try {
      const { data: txData } = await axios.get(ETHERSCAN_BASE, {
        params: {
          chainid: ARBITRUM_SEPOLIA_CHAIN_ID,
          module: 'account',
          action: 'txlist',
          address: contractAddress,
          startblock: 0,
          endblock: 99999999,
          page: 1,
          offset: 1,
          sort: 'asc',
          apikey: ETHERSCAN_API_KEY
        },
        timeout: 10000
      });
      const firstTx = txData?.result?.[0];
      if (firstTx) {
        const deployedAt = new Date(parseInt(firstTx.timeStamp) * 1000);
        const ageHours = (Date.now() - deployedAt.getTime()) / 3_600_000;
        results.checks.deployedAt = deployedAt.toISOString();
        results.checks.ageHours = Math.round(ageHours);
        if (ageHours < 24) {
          results.warnings.push(`Contract was deployed less than 24 hours ago (${Math.round(ageHours)}h ago) — very new`);
          results.riskScore += 25;
        }
      }
    } catch {
      results.checks.deployedAt = null;
    }

    // ── 5. Spender-specific checks ──────────────────────────────────────────
    if (spenderAddress && ethers.isAddress(spenderAddress)) {
      results.checks.spender = { address: spenderAddress };
      const spenderCode = await provider.getCode(spenderAddress);
      results.checks.spender.isContract = spenderCode !== '0x';
      if (!results.checks.spender.isContract) {
        results.warnings.push('Spender is an EOA wallet, not a contract — unusual for approvals');
        results.riskScore += 15;
      }
    }

    // ── Risk classification ──────────────────────────────────────────────────
    if (results.riskScore === 0) {
      results.riskLevel = 'safe';
      results.recommendation = 'No risk indicators found. Proceed with normal caution.';
    } else if (results.riskScore < 30) {
      results.riskLevel = 'low';
      results.recommendation = 'Minor concerns. Review warnings before proceeding.';
    } else if (results.riskScore < 60) {
      results.riskLevel = 'medium';
      results.recommendation = 'Multiple risk factors detected. Verify the contract manually before interacting.';
    } else {
      results.riskLevel = 'high';
      results.recommendation = 'HIGH RISK — do NOT interact with this contract until thoroughly verified.';
    }

    return res.json(successResponse(results));
  } catch (error) {
    console.error('Safety check error:', error);
    return res.status(500).json(errorResponse('Safety check failed', error.message));
  }
}

module.exports = { checkContractSafety };
