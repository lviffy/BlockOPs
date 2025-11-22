const { ethers } = require('ethers');
const { ERC20_TOKEN_ABI } = require('../config/abis');
const { getProvider, getWallet, getContract } = require('../utils/blockchain');
const { 
  successResponse, 
  errorResponse, 
  validateRequiredFields, 
  getTxExplorerUrl,
  logTransaction 
} = require('../utils/helpers');

/**
 * Transfer native ETH or ERC20 tokens
 */
async function transfer(req, res) {
  try {
    const { privateKey, toAddress, amount, tokenId } = req.body;

    // Validate required fields
    const validationError = validateRequiredFields(req.body, ['privateKey', 'toAddress', 'amount']);
    if (validationError) {
      return res.status(400).json(validationError);
    }

    const provider = getProvider();
    const wallet = getWallet(privateKey, provider);

    // If tokenId is provided, transfer ERC20 tokens
    if (tokenId !== undefined && tokenId !== null) {
      return await transferERC20(res, wallet, tokenId, toAddress, amount);
    }

    // Transfer native ETH
    return await transferNative(res, wallet, provider, toAddress, amount);

  } catch (error) {
    console.error('Transfer error:', error);
    return res.status(500).json(
      errorResponse(error.message, error.reason || error.code)
    );
  }
}

/**
 * Transfer ERC20 tokens
 */
async function transferERC20(res, wallet, tokenId, toAddress, amount) {
  const { FACTORY_ADDRESS } = require('../config/constants');
  
  logTransaction('Transfer ERC20', { tokenId, toAddress, amount });
  
  const factory = getContract(FACTORY_ADDRESS, ERC20_TOKEN_ABI, wallet);
  const tokenIdBigInt = BigInt(tokenId);
  
  // Get token info and decimals
  let decimals = 18;
  let tokenName = 'Unknown';
  let tokenSymbol = 'UNKNOWN';
  try {
    const [nameBytes, symbolBytes, decimalsResult] = await factory.getTokenInfo(tokenIdBigInt);
    decimals = Number(decimalsResult);
    tokenName = ethers.decodeBytes32String(nameBytes);
    tokenSymbol = ethers.decodeBytes32String(symbolBytes);
  } catch (error) {
    console.log('Could not get token info, defaulting to 18 decimals');
  }
  
  const amountInWei = ethers.parseUnits(amount.toString(), decimals);
  
  // Check balance
  const balance = await factory.balanceOf(tokenIdBigInt, wallet.address);
  console.log('Token balance:', ethers.formatUnits(balance, decimals));
  
  if (balance < amountInWei) {
    return res.status(400).json(
      errorResponse('Insufficient token balance', {
        balance: ethers.formatUnits(balance, decimals),
        required: amount.toString()
      })
    );
  }
  
  // Execute transfer
  const tx = await factory.transfer(tokenIdBigInt, toAddress, amountInWei);
  console.log('Transaction sent:', tx.hash);
  
  const receipt = await tx.wait();
  
  return res.json(
    successResponse({
      type: 'erc20',
      transactionHash: receipt.hash,
      from: wallet.address,
      to: toAddress,
      amount: amount,
      tokenId: tokenId,
      factoryAddress: FACTORY_ADDRESS,
      tokenName: tokenName,
      tokenSymbol: tokenSymbol,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      explorerUrl: getTxExplorerUrl(receipt.hash)
    })
  );
}

/**
 * Transfer native ETH
 */
async function transferNative(res, wallet, provider, toAddress, amount) {
  logTransaction('Transfer Native ETH', { toAddress, amount });
  
  const balance = await provider.getBalance(wallet.address);
  const amountInWei = ethers.parseEther(amount.toString());

  if (balance < amountInWei) {
    return res.status(400).json(
      errorResponse('Insufficient balance', {
        balance: ethers.formatEther(balance),
        required: amount.toString()
      })
    );
  }

  const tx = {
    to: toAddress,
    value: amountInWei,
  };

  const transactionResponse = await wallet.sendTransaction(tx);
  const receipt = await transactionResponse.wait();

  return res.json(
    successResponse({
      type: 'native',
      transactionHash: receipt.hash,
      from: wallet.address,
      to: toAddress,
      amount: amount,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      explorerUrl: getTxExplorerUrl(receipt.hash)
    })
  );
}

/**
 * Get native ETH balance
 */
async function getBalance(req, res) {
  try {
    const { address } = req.params;
    const provider = getProvider();
    const balance = await provider.getBalance(address);
    
    return res.json(
      successResponse({
        address: address,
        balance: ethers.formatEther(balance),
        balanceWei: balance.toString(),
        network: 'Arbitrum Sepolia'
      })
    );
  } catch (error) {
    return res.status(500).json(errorResponse(error.message));
  }
}

module.exports = {
  transfer,
  getBalance
};
