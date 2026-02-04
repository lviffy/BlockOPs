// Network and Contract Configuration
require('dotenv').config();

module.exports = {
  // Network Configuration
  ARBITRUM_SEPOLIA_RPC: 'https://sepolia-rollup.arbitrum.io/rpc',
  NETWORK_NAME: 'Arbitrum Sepolia',
  EXPLORER_BASE_URL: 'https://sepolia.arbiscan.io',
  
  // Contract Addresses
  FACTORY_ADDRESS: process.env.TOKEN_FACTORY_ADDRESS || '0x0000000000000000000000000000000000000000',
  NFT_FACTORY_ADDRESS: process.env.NFT_FACTORY_ADDRESS || '0x0000000000000000000000000000000000000000',
  
  // Server Configuration
  PORT: process.env.PORT || 3000,
  
  // API Keys
  GROQ_API_KEY: process.env.GROQ_API_KEY || '',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  ETHERSCAN_API_KEY: process.env.ETHERSCAN_API_KEY || '',
  PINATA_API_KEY: process.env.PINATA_API_KEY || '',
  PINATA_SECRET_KEY: process.env.PINATA_SECRET_KEY || '',
  
  // Etherscan V2 API Configuration
  ETHERSCAN_V2_BASE_URL: 'https://api.etherscan.io/v2/api',
  ARBITRUM_SEPOLIA_CHAIN_ID: 421614
};
