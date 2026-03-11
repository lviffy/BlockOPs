const express = require('express');
const router = express.Router();
const { deposit, withdraw, getAPY, claimRewards, getAccountData } = require('../controllers/defiController');

// POST /defi/deposit — supply asset to Aave V3
router.post('/deposit', deposit);

// POST /defi/withdraw — withdraw from Aave V3
router.post('/withdraw', withdraw);

// GET /defi/apy — current APY for pools
router.get('/apy', getAPY);

// POST /defi/claim — claim Aave rewards
router.post('/claim', claimRewards);

// GET /defi/account/:address — user account summary
router.get('/account/:address', getAccountData);

module.exports = router;
