const express = require('express');
const { PORT, NETWORK_NAME, FACTORY_ADDRESS, NFT_FACTORY_ADDRESS } = require('./config/constants');

// Import routes
const tokenRoutes = require('./routes/tokenRoutes');
const nftRoutes = require('./routes/nftRoutes');
const transferRoutes = require('./routes/transferRoutes');
const healthRoutes = require('./routes/healthRoutes');
const priceRoutes = require('./routes/priceRoutes');
const nlExecutorRoutes = require('./routes/nlExecutorRoutes');

// Initialize Express app
const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS middleware (optional - uncomment if needed)
// app.use((req, res, next) => {
//   res.header('Access-Control-Allow-Origin', '*');
//   res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
//   res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
//   next();
// });

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/health', healthRoutes);
app.use('/token', tokenRoutes);
app.use('/nft', nftRoutes);
app.use('/transfer', transferRoutes);
app.use('/price', priceRoutes);
app.use('/nl-executor', nlExecutorRoutes);

// Legacy routes for backwards compatibility
app.post('/deploy-token', require('./controllers/tokenController').deployToken);
app.post('/deploy-nft-collection', require('./controllers/nftController').deployNFTCollection);
app.post('/mint-nft', require('./controllers/nftController').mintNFT);
app.get('/balance/:address', require('./controllers/transferController').getBalance);
app.get('/token-info/:tokenAddress', require('./controllers/tokenController').getTokenInfo);
app.get('/token-balance/:tokenAddress/:ownerAddress', require('./controllers/tokenController').getTokenBalance);
app.get('/nft-info/:collectionAddress/:tokenId', require('./controllers/nftController').getNFTInfo);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.path,
    method: req.method
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: error.message
  });
});

// Start server
const server = app.listen(PORT, () => {
  console.log('\n' + '='.repeat(50));
  console.log('🚀 n8nrollup Backend Server');
  console.log('='.repeat(50));
  console.log(`📡 Server running on port ${PORT}`);
  console.log(`🌐 Network: ${NETWORK_NAME}`);
  console.log(`🏭 TokenFactory: ${FACTORY_ADDRESS}`);
  console.log(`🎨 NFTFactory: ${NFT_FACTORY_ADDRESS}`);
  console.log('\n📍 API Endpoints:');
  console.log('  Health Check:');
  console.log('    GET  /health');
  console.log('\n  Token Operations:');
  console.log('    POST /token/deploy');
  console.log('    GET  /token/info/:tokenAddress');
  console.log('    GET  /token/balance/:tokenAddress/:ownerAddress');
  console.log('\n  NFT Operations:');
  console.log('    POST /nft/deploy-collection');
  console.log('    POST /nft/mint');
  console.log('    GET  /nft/info/:collectionAddress/:tokenId');
  console.log('\n  Transfer Operations:');
  console.log('    POST /transfer');
  console.log('    GET  /transfer/balance/:address');
  console.log('\n  Natural Language Executor:');
  console.log('    GET  /nl-executor/discover/:contractAddress');
  console.log('    POST /nl-executor/execute');
  console.log('    POST /nl-executor/quick-execute');
  console.log('\n' + '='.repeat(50) + '\n');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});

module.exports = app;
