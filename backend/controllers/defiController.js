const { ethers } = require('ethers');
const { getProvider, getWallet } = require('../utils/blockchain');
const { successResponse, errorResponse, validateRequiredFields, getTxExplorerUrl } = require('../utils/helpers');

// Aave V3 Pool ABI (minimal - just the operations we need)
const AAVE_POOL_ABI = [
  'function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external',
  'function withdraw(address asset, uint256 amount, address to) external returns (uint256)',
  'function getReserveData(address asset) external view returns (tuple(tuple(uint256 data) configuration, uint128 liquidityIndex, uint128 currentLiquidityRate, uint128 variableBorrowIndex, uint128 currentVariableBorrowRate, uint128 currentStableBorrowRate, uint40 lastUpdateTimestamp, uint16 id, address aTokenAddress, address stableDebtTokenAddress, address variableDebtTokenAddress, address interestRateStrategyAddress, uint128 accruedToTreasury, uint128 unbacked, uint128 isolationModeTotalDebt))',
  'function getUserAccountData(address user) external view returns (uint256 totalCollateralBase, uint256 totalDebtBase, uint256 availableBorrowsBase, uint256 currentLiquidationThreshold, uint256 ltv, uint256 healthFactor)'
];

// Aave V3 Rewards Controller ABI
const REWARDS_ABI = [
  'function claimAllRewards(address[] calldata assets, address to) external returns (address[] rewardsList, uint256[] claimedAmounts)',
  'function getUserRewards(address[] calldata assets, address user, address reward) external view returns (uint256)'
];

// ERC20 approve ABI
const ERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function decimals() external view returns (uint8)',
  'function symbol() external view returns (string)'
];

// Aave V3 on Arbitrum Sepolia (testnet addresses)
const AAVE_ADDRESSES = {
  pool: process.env.AAVE_POOL_ADDRESS || '0xBfC91D59fdAA134A4ED45f7B584cAf96D7792Eff',
  rewards: process.env.AAVE_REWARDS_ADDRESS || '0x8164Cc65827dcFe994AB23944CBC90e0aa80bFcb',
  // Arbitrum Sepolia USDC test address
  usdc: process.env.AAVE_USDC_ADDRESS || '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d'
};

async function getPoolContract(signerOrProvider) {
  return new ethers.Contract(AAVE_ADDRESSES.pool, AAVE_POOL_ABI, signerOrProvider);
}

/**
 * POST /defi/deposit
 * Supply an asset to Aave V3 pool to earn yield
 * Body: { privateKey, asset, amount }
 */
async function deposit(req, res) {
  try {
    const { privateKey, asset, amount } = req.body;

    const validationError = validateRequiredFields(req.body, ['privateKey', 'asset', 'amount']);
    if (validationError) return res.status(400).json(validationError);

    if (!ethers.isAddress(asset)) {
      return res.status(400).json(errorResponse('Invalid asset address'));
    }

    const provider = getProvider();
    const wallet = getWallet(privateKey, provider);
    const token = new ethers.Contract(asset, ERC20_ABI, wallet);
    const pool = await getPoolContract(wallet);

    const decimals = await token.decimals();
    const symbol = await token.symbol();
    const amountWei = ethers.parseUnits(amount.toString(), decimals);

    // Approve pool to spend tokens
    const allowance = await token.allowance(wallet.address, AAVE_ADDRESSES.pool);
    if (allowance < amountWei) {
      const approveTx = await token.approve(AAVE_ADDRESSES.pool, ethers.MaxUint256);
      await approveTx.wait();
    }

    // Supply to pool
    const tx = await pool.supply(asset, amountWei, wallet.address, 0);
    const receipt = await tx.wait();

    return res.json(successResponse({
      type: 'aave_deposit',
      transactionHash: receipt.hash,
      explorerUrl: getTxExplorerUrl(receipt.hash),
      wallet: wallet.address,
      asset,
      symbol,
      amount,
      amountWei: amountWei.toString(),
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      note: `Supplied ${amount} ${symbol} to Aave V3. You will receive a${symbol} tokens representing your deposit.`
    }));
  } catch (error) {
    console.error('Aave deposit error:', error);
    return res.status(500).json(errorResponse('Aave deposit failed', error.message));
  }
}

/**
 * POST /defi/withdraw
 * Withdraw a supplied asset from Aave V3
 * Body: { privateKey, asset, amount } — use amount "max" for full withdrawal
 */
async function withdraw(req, res) {
  try {
    const { privateKey, asset, amount } = req.body;

    const validationError = validateRequiredFields(req.body, ['privateKey', 'asset', 'amount']);
    if (validationError) return res.status(400).json(validationError);

    if (!ethers.isAddress(asset)) {
      return res.status(400).json(errorResponse('Invalid asset address'));
    }

    const provider = getProvider();
    const wallet = getWallet(privateKey, provider);
    const token = new ethers.Contract(asset, ERC20_ABI, provider);
    const pool = await getPoolContract(wallet);

    const decimals = await token.decimals();
    const symbol = await token.symbol();

    const amountWei = (amount === 'max' || amount === 'all')
      ? ethers.MaxUint256
      : ethers.parseUnits(amount.toString(), decimals);

    const tx = await pool.withdraw(asset, amountWei, wallet.address);
    const receipt = await tx.wait();

    return res.json(successResponse({
      type: 'aave_withdraw',
      transactionHash: receipt.hash,
      explorerUrl: getTxExplorerUrl(receipt.hash),
      wallet: wallet.address,
      asset,
      symbol,
      amount: amount === 'max' ? 'all' : amount,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString()
    }));
  } catch (error) {
    console.error('Aave withdraw error:', error);
    return res.status(500).json(errorResponse('Aave withdraw failed', error.message));
  }
}

/**
 * GET /defi/apy
 * Fetch current APY for major pools on Aave V3
 */
async function getAPY(req, res) {
  try {
    const provider = getProvider();
    const pool = await getPoolContract(provider);

    const assets = req.query.assets
      ? req.query.assets.split(',').filter(a => ethers.isAddress(a.trim()))
      : [AAVE_ADDRESSES.usdc];

    const results = await Promise.allSettled(
      assets.map(async (asset) => {
        const data = await pool.getReserveData(asset);
        // currentLiquidityRate is in RAY (1e27), APY = ((1 + rate/SECONDS_PER_YEAR)^SECONDS_PER_YEAR) - 1
        const RAY = 10n ** 27n;
        const SECONDS_PER_YEAR = 31536000n;
        const rate = data.currentLiquidityRate; // BigInt
        // Simple approximation: APY ≈ rate / RAY * 100
        const apyApprox = Number(rate * 10000n / RAY) / 100; // in %

        const token = new ethers.Contract(asset, ERC20_ABI, provider);
        let symbol = asset;
        try { symbol = await token.symbol(); } catch {}

        return { asset, symbol, supplyApy: apyApprox.toFixed(2) + '%', aTokenAddress: data.aTokenAddress };
      })
    );

    const apyData = results.map((r, i) =>
      r.status === 'fulfilled' ? r.value : { asset: assets[i], error: r.reason?.message }
    );

    return res.json(successResponse({ pools: apyData, source: 'Aave V3 Arbitrum Sepolia' }));
  } catch (error) {
    console.error('Aave APY error:', error);
    return res.status(500).json(errorResponse('Failed to fetch APY', error.message));
  }
}

/**
 * POST /defi/claim
 * Claim all pending Aave rewards for an address
 * Body: { privateKey, assets?: string[] }
 */
async function claimRewards(req, res) {
  try {
    const { privateKey, assets } = req.body;

    const validationError = validateRequiredFields(req.body, ['privateKey']);
    if (validationError) return res.status(400).json(validationError);

    const provider = getProvider();
    const wallet = getWallet(privateKey, provider);

    // Default to USDC aToken if no assets specified
    const rewardAssets = assets && assets.length > 0 ? assets : [AAVE_ADDRESSES.usdc];

    const rewardsController = new ethers.Contract(AAVE_ADDRESSES.rewards, REWARDS_ABI, wallet);
    const tx = await rewardsController.claimAllRewards(rewardAssets, wallet.address);
    const receipt = await tx.wait();

    return res.json(successResponse({
      type: 'aave_claim_rewards',
      transactionHash: receipt.hash,
      explorerUrl: getTxExplorerUrl(receipt.hash),
      wallet: wallet.address,
      assets: rewardAssets,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString()
    }));
  } catch (error) {
    console.error('Aave claim error:', error);
    return res.status(500).json(errorResponse('Claim failed', error.message));
  }
}

/**
 * GET /defi/account/:address
 * Get user account summary on Aave (collateral, health factor, etc.)
 */
async function getAccountData(req, res) {
  try {
    const { address } = req.params;
    if (!ethers.isAddress(address)) return res.status(400).json(errorResponse('Invalid address'));

    const provider = getProvider();
    const pool = await getPoolContract(provider);
    const data = await pool.getUserAccountData(address);

    const BASE = 10n ** 8n; // Aave uses 1e8 base for USD values
    return res.json(successResponse({
      address,
      totalCollateralUSD: (Number(data.totalCollateralBase) / 1e8).toFixed(2),
      totalDebtUSD: (Number(data.totalDebtBase) / 1e8).toFixed(2),
      availableBorrowsUSD: (Number(data.availableBorrowsBase) / 1e8).toFixed(2),
      currentLiquidationThreshold: (Number(data.currentLiquidationThreshold) / 100).toFixed(2) + '%',
      ltv: (Number(data.ltv) / 100).toFixed(2) + '%',
      healthFactor: data.healthFactor === ethers.MaxUint256 ? 'N/A (no debt)' : (Number(data.healthFactor) / 1e18).toFixed(4)
    }));
  } catch (error) {
    console.error('Aave account data error:', error);
    return res.status(500).json(errorResponse('Failed to fetch account data', error.message));
  }
}

module.exports = { deposit, withdraw, getAPY, claimRewards, getAccountData };
