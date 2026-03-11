const { ethers } = require('ethers');
const { getProvider, getWallet } = require('../utils/blockchain');
const { successResponse, errorResponse, validateRequiredFields, getTxExplorerUrl } = require('../utils/helpers');

// EIP-2612 permit ABI
const PERMIT_ABI = [
  'function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external',
  'function nonces(address owner) external view returns (uint256)',
  'function DOMAIN_SEPARATOR() external view returns (bytes32)',
  'function name() external view returns (string)',
  'function symbol() external view returns (string)',
  'function decimals() external view returns (uint8)',
  'function version() external view returns (string)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  // permit detection
  'function supportsInterface(bytes4 interfaceId) external view returns (bool)'
];

/**
 * Check if a token supports EIP-2612 permit
 */
async function supportsPermit(tokenContract) {
  try {
    await tokenContract.DOMAIN_SEPARATOR();
    await tokenContract.nonces(ethers.ZeroAddress);
    return true;
  } catch {
    return false;
  }
}

/**
 * POST /allowance/permit
 * Sign and submit an EIP-2612 gasless permit (replaces approve + transferFrom pattern)
 * Body: { privateKey, tokenAddress, spenderAddress, amount, deadline? }
 */
async function permitToken(req, res) {
  try {
    const { privateKey, tokenAddress, spenderAddress, amount, deadline } = req.body;

    const validationError = validateRequiredFields(req.body, ['privateKey', 'tokenAddress', 'spenderAddress', 'amount']);
    if (validationError) return res.status(400).json(validationError);

    if (!ethers.isAddress(tokenAddress) || !ethers.isAddress(spenderAddress)) {
      return res.status(400).json(errorResponse('Invalid token or spender address'));
    }

    const provider = getProvider();
    const wallet = getWallet(privateKey, provider);
    const token = new ethers.Contract(tokenAddress, PERMIT_ABI, provider);

    // ── Check permit support ─────────────────────────────────────────────────
    const hasPermit = await supportsPermit(token);
    if (!hasPermit) {
      return res.status(400).json(errorResponse(
        'This token does not support EIP-2612 permit. Use /allowance/approve instead.',
        { tokenAddress, fallback: 'POST /allowance/approve' }
      ));
    }

    // ── Fetch token metadata ─────────────────────────────────────────────────
    const [name, symbol, decimals, nonce, domainSeparator] = await Promise.all([
      token.name(),
      token.symbol(),
      token.decimals(),
      token.nonces(wallet.address),
      token.DOMAIN_SEPARATOR()
    ]);

    // Some tokens expose a `version()` — default to "1"
    let version = '1';
    try { version = await token.version(); } catch { /* not all tokens have version() */ }

    // ── Build deadline ─────────────────────────────────────────────────────
    const deadlineTs = deadline
      ? BigInt(deadline)
      : BigInt(Math.floor(Date.now() / 1000) + 3600); // 1 hour from now

    // ── Resolve amount ─────────────────────────────────────────────────────
    let amountWei;
    if (amount === 'unlimited' || amount === 'max') {
      amountWei = ethers.MaxUint256;
    } else {
      amountWei = ethers.parseUnits(amount.toString(), decimals);
    }

    // ── Build EIP-712 typed data ──────────────────────────────────────────────
    const { chainId } = await provider.getNetwork();

    const domain = {
      name,
      version,
      chainId: Number(chainId),
      verifyingContract: tokenAddress
    };

    const types = {
      Permit: [
        { name: 'owner', type: 'address' },
        { name: 'spender', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' }
      ]
    };

    const message = {
      owner: wallet.address,
      spender: spenderAddress,
      value: amountWei,
      nonce,
      deadline: deadlineTs
    };

    const sig = await wallet.signTypedData(domain, types, message);
    const { v, r, s } = ethers.Signature.from(sig);

    // ── Submit permit tx ─────────────────────────────────────────────────────
    const tokenWithSigner = token.connect(wallet);
    const tx = await tokenWithSigner.permit(
      wallet.address,
      spenderAddress,
      amountWei,
      deadlineTs,
      v, r, s
    );
    const receipt = await tx.wait();

    return res.json(successResponse({
      type: 'permit',
      transactionHash: receipt.hash,
      owner: wallet.address,
      tokenAddress,
      tokenSymbol: symbol,
      spenderAddress,
      amount: amount === 'unlimited' || amount === 'max' ? 'unlimited' : amount,
      deadline: new Date(Number(deadlineTs) * 1000).toISOString(),
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      explorerUrl: getTxExplorerUrl(receipt.hash),
      network: 'Arbitrum Sepolia',
      note: 'EIP-2612 gasless permit — no separate approve() transaction needed'
    }));
  } catch (error) {
    console.error('Permit error:', error);
    return res.status(500).json(errorResponse('Permit failed', error.message));
  }
}

module.exports = { permitToken };
