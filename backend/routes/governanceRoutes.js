const express = require('express');
const router = express.Router();
const {
  listProposals,
  castVote,
  delegateVotes,
  createProposal,
  getVotingPower
} = require('../controllers/governanceController');

// GET /governance/proposals/:governorAddress — list recent proposals
router.get('/proposals/:governorAddress', listProposals);

// POST /governance/vote — cast a vote
router.post('/vote', castVote);

// POST /governance/delegate — delegate voting power
router.post('/delegate', delegateVotes);

// POST /governance/create — create a new proposal
router.post('/create', createProposal);

// GET /governance/votes/:tokenAddress/:address — voting power
router.get('/votes/:tokenAddress/:address', getVotingPower);

module.exports = router;
