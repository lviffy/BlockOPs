const { ethers } = require('ethers');
const { NFT_FACTORY_ADDRESS } = require('../config/constants');
const { NFT_FACTORY_ABI, ERC721_COLLECTION_ABI } = require('../config/abis');
const { getProvider, getWallet, getContract, parseEventFromReceipt } = require('../utils/blockchain');
const { 
  successResponse, 
  errorResponse, 
  validateRequiredFields, 
  getTxExplorerUrl, 
  getAddressExplorerUrl,
  logTransaction 
} = require('../utils/helpers');
const { fireEvent } = require('../services/webhookService');

/**
 * Deploy NFT Collection via Stylus NFTFactory
 */
async function deployNFTCollection(req, res) {
  try {
    const { privateKey, name, symbol, baseURI } = req.body;

    // Validate required fields
    const validationError = validateRequiredFields(req.body, ['privateKey', 'name', 'symbol', 'baseURI']);
    if (validationError) {
      return res.status(400).json(validationError);
    }

    // Check if factory is configured
    if (NFT_FACTORY_ADDRESS === '0x0000000000000000000000000000000000000000') {
      return res.status(500).json(
        errorResponse('NFTFactory contract address not configured. Please set NFT_FACTORY_ADDRESS in environment variables.')
      );
    }

    const provider = getProvider();
    const wallet = getWallet(privateKey, provider);

    // Check balance for gas
    const balance = await provider.getBalance(wallet.address);
    logTransaction('Deploy NFT Collection', { name, symbol, baseURI, balance: ethers.formatEther(balance) });
    
    if (balance === 0n) {
      return res.status(400).json(
        errorResponse('Insufficient balance for gas fees', 'Please fund your wallet with ETH on Arbitrum Sepolia')
      );
    }

    // Connect to factory
    const factory = getContract(NFT_FACTORY_ADDRESS, NFT_FACTORY_ABI, wallet);

    // Estimate gas
    let gasEstimate;
    let estimatedCost = null;
    try {
      gasEstimate = await factory.create_collection.estimateGas(name, symbol, baseURI);
      
      const feeData = await provider.getFeeData();
      if (feeData.gasPrice) {
        const estimatedCostWei = gasEstimate * feeData.gasPrice;
        estimatedCost = ethers.formatEther(estimatedCostWei);
        
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

    // Create collection
    const tx = gasEstimate
      ? await factory.create_collection(name, symbol, baseURI, { gasLimit: gasEstimate * 12n / 10n })
      : await factory.create_collection(name, symbol, baseURI);
    
    console.log('Transaction sent:', tx.hash);

    // Wait for confirmation
    const receipt = await tx.wait();
    console.log('Transaction confirmed in block:', receipt.blockNumber);

    // Parse event to get collection address
    const factoryInterface = new ethers.Interface(NFT_FACTORY_ABI);
    const eventArgs = parseEventFromReceipt(receipt, factoryInterface, 'CollectionCreated');
    
    if (!eventArgs) {
      throw new Error('Failed to parse CollectionCreated event from receipt');
    }

    const collectionAddress = eventArgs.collection_address;
    console.log('NFT Collection created at:', collectionAddress);

    const deployData = {
      message: 'NFT Collection deployed successfully via Stylus NFTFactory',
      collectionAddress: collectionAddress,
      transactionHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      estimatedCost: estimatedCost,
      creator: wallet.address,
      collectionInfo: { name, symbol, baseURI },
      explorerUrl: getAddressExplorerUrl(collectionAddress),
      transactionUrl: getTxExplorerUrl(receipt.hash)
    };

    fireEvent(req.apiKey?.agentId || null, 'nft.deployed', deployData);

    return res.json(successResponse(deployData));

  } catch (error) {
    console.error('Deploy NFT collection error:', error);
    return res.status(500).json(
      errorResponse(error.message, error.reason || error.code)
    );
  }
}

/**
 * Mint NFT from collection
 */
async function mintNFT(req, res) {
  try {
    const { privateKey, collectionAddress, toAddress } = req.body;

    // Validate required fields
    const validationError = validateRequiredFields(req.body, ['privateKey', 'collectionAddress', 'toAddress']);
    if (validationError) {
      return res.status(400).json(validationError);
    }

    const provider = getProvider();
    const wallet = getWallet(privateKey, provider);

    logTransaction('Mint NFT', { collectionAddress, toAddress });

    // Connect to NFT contract
    const nftContract = getContract(collectionAddress, ERC721_COLLECTION_ABI, wallet);

    // Mint NFT
    const tx = await nftContract.mint(toAddress);
    console.log('Mint transaction sent:', tx.hash);

    const receipt = await tx.wait();
    console.log('Mint confirmed in block:', receipt.blockNumber);

    // Parse Transfer event to get token ID
    const nftInterface = new ethers.Interface(ERC721_COLLECTION_ABI);
    const eventArgs = parseEventFromReceipt(receipt, nftInterface, 'Transfer');
    
    const tokenId = eventArgs ? eventArgs.token_id.toString() : 'unknown';

    const mintData = {
      message: 'NFT minted successfully',
      tokenId: tokenId,
      collectionAddress: collectionAddress,
      owner: toAddress,
      transactionHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      explorerUrl: getTxExplorerUrl(receipt.hash)
    };

    fireEvent(req.apiKey?.agentId || null, 'nft.minted', mintData);

    return res.json(successResponse(mintData));

  } catch (error) {
    console.error('Mint NFT error:', error);
    return res.status(500).json(
      errorResponse(error.message, error.reason || error.code)
    );
  }
}

/**
 * Get NFT information
 */
async function getNFTInfo(req, res) {
  try {
    const { collectionAddress, tokenId } = req.params;
    const provider = getProvider();
    const nftContract = getContract(collectionAddress, ERC721_COLLECTION_ABI, provider);
    
    const owner = await nftContract.owner_of(BigInt(tokenId));
    const tokenURI = await nftContract.token_uri(BigInt(tokenId));
    const name = await nftContract.name();
    const symbol = await nftContract.symbol();
    
    return res.json(
      successResponse({
        collectionAddress: collectionAddress,
        tokenId: tokenId,
        owner: owner,
        tokenURI: tokenURI,
        collectionName: name,
        collectionSymbol: symbol,
        network: 'Arbitrum Sepolia'
      })
    );
  } catch (error) {
    return res.status(500).json(errorResponse(error.message));
  }
}

module.exports = {
  deployNFTCollection,
  mintNFT,
  getNFTInfo
};
