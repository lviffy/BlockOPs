const { ethers } = require('ethers');
const { FACTORY_ADDRESS } = require('../config/constants');
const { FACTORY_ABI, ERC20_TOKEN_ABI } = require('../config/abis');
const { getProvider, getWallet, getContract, parseEventFromReceipt } = require('../utils/blockchain');
const { 
  successResponse, 
  errorResponse, 
  validateRequiredFields, 
  getTxExplorerUrl, 
  getAddressExplorerUrl,
  logTransaction 
} = require('../utils/helpers');

/**
 * Deploy ERC20 Token via Stylus TokenFactory
 */
async function deployToken(req, res) {
  try {
    const { privateKey, name, symbol, initialSupply, decimals = 18 } = req.body;

    // Validate required fields
    const validationError = validateRequiredFields(req.body, ['privateKey', 'name', 'symbol', 'initialSupply']);
    if (validationError) {
      return res.status(400).json(validationError);
    }

    // Check if factory is configured
    if (FACTORY_ADDRESS === '0x0000000000000000000000000000000000000000') {
      return res.status(500).json(
        errorResponse('TokenFactory contract address not configured. Please set TOKEN_FACTORY_ADDRESS in environment variables.')
      );
    }

    const provider = getProvider();
    const wallet = getWallet(privateKey, provider);

    // Check balance for gas
    const balance = await provider.getBalance(wallet.address);
    logTransaction('Deploy Token', { name, symbol, decimals, initialSupply, balance: ethers.formatEther(balance) });
    
    if (balance === 0n) {
      return res.status(400).json(
        errorResponse('Insufficient balance for gas fees', 'Please fund your wallet with ETH on Arbitrum Sepolia')
      );
    }

    // Connect to factory
    const factory = getContract(FACTORY_ADDRESS, FACTORY_ABI, wallet);

    // Convert name and symbol to bytes32
    const nameBytes32 = ethers.encodeBytes32String(name);
    const symbolBytes32 = ethers.encodeBytes32String(symbol);

    // Convert values to BigInt
    const decimalsBigInt = BigInt(decimals.toString());
    const initialSupplyBigInt = BigInt(initialSupply.toString());

    // Estimate gas
    let gasEstimate;
    let estimatedCost = null;
    try {
      gasEstimate = await factory.createToken.estimateGas(nameBytes32, symbolBytes32, decimalsBigInt, initialSupplyBigInt);
      
      const feeData = await provider.getFeeData();
      if (feeData.gasPrice) {
        const estimatedCostWei = gasEstimate * feeData.gasPrice;
        estimatedCost = ethers.formatEther(estimatedCostWei);
        
        // Check if balance is sufficient
        const gasBuffer = estimatedCostWei * 12n / 10n;
        if (balance < gasBuffer) {
          return res.status(400).json(
            errorResponse('Insufficient balance for gas fees', {
              balance: ethers.formatEther(balance),
              estimatedCost: estimatedCost,
              required: ethers.formatEther(gasBuffer)
            })
          );
        }
      }
    } catch (estimateError) {
      console.warn('Gas estimation failed:', estimateError.message);
    }

    // Create token
    const tx = gasEstimate 
      ? await factory.createToken(nameBytes32, symbolBytes32, decimalsBigInt, initialSupplyBigInt, { gasLimit: gasEstimate * 12n / 10n })
      : await factory.createToken(nameBytes32, symbolBytes32, decimalsBigInt, initialSupplyBigInt);

    console.log('Transaction sent:', tx.hash);

    // Wait for confirmation
    const receipt = await tx.wait();
    console.log('Transaction confirmed in block:', receipt.blockNumber);

    // The createToken function returns the token_id
    // We need to decode it from the transaction result
    const tokenId = receipt.logs && receipt.logs.length > 0 
      ? await factory.getTokenCount() - 1n // Get the last created token ID
      : 0n;
    
    console.log('Token created with ID:', tokenId.toString());

    // Get token info using getTokenInfo
    let tokenInfo = { name, symbol, decimals, totalSupply: initialSupply };
    try {
      const [nameBytes, symbolBytes, decimalsResult, totalSupply, creator] = await factory.getTokenInfo(tokenId);
      tokenInfo = {
        name: ethers.decodeBytes32String(nameBytes),
        symbol: ethers.decodeBytes32String(symbolBytes),
        decimals: Number(decimalsResult),
        totalSupply: totalSupply.toString(),
        creator: creator
      };
    } catch (error) {
      console.warn('Could not fetch token info:', error.message);
    }

    return res.json(
      successResponse({
        message: 'Token deployed successfully via Stylus TokenFactory',
        tokenId: tokenId.toString(),
        factoryAddress: FACTORY_ADDRESS,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        estimatedCost: estimatedCost,
        creator: wallet.address,
        tokenInfo: tokenInfo,
        explorerUrl: getAddressExplorerUrl(FACTORY_ADDRESS),
        transactionUrl: getTxExplorerUrl(receipt.hash)
      })
    );

  } catch (error) {
    console.error('Deploy token error:', error);
    return res.status(500).json(
      errorResponse(error.message, error.reason || error.code)
    );
  }
}

/**
 * Get token information
 */
async function getTokenInfo(req, res) {
  try {
    const { tokenId } = req.params;
    const provider = getProvider();
    const factory = getContract(FACTORY_ADDRESS, FACTORY_ABI, provider);
    
    const [nameBytes, symbolBytes, decimals, totalSupply, creator] = await factory.getTokenInfo(BigInt(tokenId));
    
    const name = ethers.decodeBytes32String(nameBytes);
    const symbol = ethers.decodeBytes32String(symbolBytes);
    
    return res.json(
      successResponse({
        tokenId: tokenId,
        factoryAddress: FACTORY_ADDRESS,
        name: name,
        symbol: symbol,
        decimals: Number(decimals),
        totalSupply: ethers.formatUnits(totalSupply, Number(decimals)),
        totalSupplyRaw: totalSupply.toString(),
        creator: creator,
        network: 'Arbitrum Sepolia'
      })
    );
  } catch (error) {
    return res.status(500).json(errorResponse(error.message));
  }
}

/**
 * Get token balance
 */
async function getTokenBalance(req, res) {
  try {
    const { tokenId, ownerAddress } = req.params;
    const provider = getProvider();
    const factory = getContract(FACTORY_ADDRESS, ERC20_TOKEN_ABI, provider);
    
    const tokenIdBigInt = BigInt(tokenId);
    const balance = await factory.balanceOf(tokenIdBigInt, ownerAddress);
    
    // Get decimals from token info
    let decimals = 18;
    try {
      const [, , decimalsResult] = await factory.getTokenInfo(tokenIdBigInt);
      decimals = Number(decimalsResult);
    } catch (e) {
      console.log('Could not get decimals, using 18');
    }
    
    return res.json(
      successResponse({
        tokenId: tokenId,
        factoryAddress: FACTORY_ADDRESS,
        ownerAddress: ownerAddress,
        balance: ethers.formatUnits(balance, decimals),
        balanceRaw: balance.toString(),
        decimals: decimals,
        network: 'Arbitrum Sepolia'
      })
    );
  } catch (error) {
    return res.status(500).json(errorResponse(error.message));
  }
}

module.exports = {
  deployToken,
  getTokenInfo,
  getTokenBalance
};
