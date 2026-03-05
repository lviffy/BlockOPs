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
const { fireEvent } = require('../services/webhookService')

/**
 * Transfer native ETH or ERC20 tokens
 * LEGACY: Uses private key (server-side signing) - Use prepareTransfer for MetaMask
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

    const agentId = req.apiKey?.agentId || null;

    // If tokenId is provided, transfer ERC20 tokens
    if (tokenId !== undefined && tokenId !== null) {
      return await transferERC20(res, wallet, tokenId, toAddress, amount, agentId);
    }

    // Transfer native ETH
    return await transferNative(res, wallet, provider, toAddress, amount, agentId);

  } catch (error) {
    console.error('Transfer error:', error);
    return res.status(500).json(
      errorResponse(error.message, error.reason || error.code)
    );
  }
}

/**
 * Prepare transfer transaction for MetaMask signing (client-side)
 * Returns transaction data for user to sign with their wallet
 */
async function prepareTransfer(req, res) {
  try {
    const { fromAddress, toAddress, amount, tokenId } = req.body;

    // Validate required fields
    const validationError = validateRequiredFields(req.body, ['fromAddress', 'toAddress', 'amount']);
    if (validationError) {
      return res.status(400).json(validationError);
    }

    const provider = getProvider();

    // If tokenId is provided, prepare ERC20 transfer
    if (tokenId !== undefined && tokenId !== null) {
      return await prepareERC20Transfer(res, provider, fromAddress, tokenId, toAddress, amount);
    }

    // Prepare native ETH transfer
    return await prepareNativeTransfer(res, provider, fromAddress, toAddress, amount);

  } catch (error) {
    console.error('Prepare transfer error:', error);
    return res.status(500).json(
      errorResponse(error.message, error.reason || error.code)
    );
  }
}

/**
 * Transfer ERC20 tokens
 */
async function transferERC20(res, wallet, tokenId, toAddress, amount, agentId = null) {
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

  const txData = {
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
  };

  fireEvent(agentId, 'tx.confirmed', txData);

  return res.json(successResponse(txData));
}

/**
 * Transfer native ETH
 */
async function transferNative(res, wallet, provider, toAddress, amount, agentId = null) {
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

  const txData = {
    type: 'native',
    transactionHash: receipt.hash,
    from: wallet.address,
    to: toAddress,
    amount: amount,
    blockNumber: receipt.blockNumber,
    gasUsed: receipt.gasUsed.toString(),
    explorerUrl: getTxExplorerUrl(receipt.hash)
  };

  fireEvent(agentId, 'tx.confirmed', txData);

  return res.json(successResponse(txData));
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

/**
 * Prepare ERC20 transfer transaction for client-side signing
 */
async function prepareERC20Transfer(res, provider, fromAddress, tokenId, toAddress, amount) {
  const { FACTORY_ADDRESS } = require('../config/constants');
  
  logTransaction('Prepare ERC20 Transfer', { fromAddress, tokenId, toAddress, amount });
  
  const factory = getContract(FACTORY_ADDRESS, ERC20_TOKEN_ABI, provider);
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
  const balance = await factory.balanceOf(tokenIdBigInt, fromAddress);
  console.log('Token balance:', ethers.formatUnits(balance, decimals));
  
  if (balance < amountInWei) {
    return res.status(400).json(
      errorResponse('Insufficient token balance', {
        balance: ethers.formatUnits(balance, decimals),
        required: amount.toString()
      })
    );
  }
  
  // Prepare transaction data
  const data = factory.interface.encodeFunctionData('transfer', [tokenIdBigInt, toAddress, amountInWei]);
  
  return res.json(
    successResponse({
      type: 'erc20',
      requiresMetaMask: true,
      transaction: {
        to: FACTORY_ADDRESS,
        from: fromAddress,
        data: data,
        value: '0x0'
      },
      details: {
        tokenId: tokenId,
        tokenName: tokenName,
        tokenSymbol: tokenSymbol,
        amount: amount,
        toAddress: toAddress,
        fromAddress: fromAddress
      }
    })
  );
}

/**
 * Prepare native ETH transfer transaction for client-side signing
 */
async function prepareNativeTransfer(res, provider, fromAddress, toAddress, amount) {
  logTransaction('Prepare Native ETH Transfer', { fromAddress, toAddress, amount });
  
  const balance = await provider.getBalance(fromAddress);
  const amountInWei = ethers.parseEther(amount.toString());

  if (balance < amountInWei) {
    return res.status(400).json(
      errorResponse('Insufficient balance', {
        balance: ethers.formatEther(balance),
        required: amount.toString()
      })
    );
  }

  // Return transaction object for MetaMask
  return res.json(
    successResponse({
      type: 'native',
      requiresMetaMask: true,
      transaction: {
        to: toAddress,
        from: fromAddress,
        value: amountInWei.toString()
      },
      details: {
        amount: amount,
        toAddress: toAddress,
        fromAddress: fromAddress
      }
    })
  );
}

module.exports = {
  transfer,
  prepareTransfer,
  getBalance
};
