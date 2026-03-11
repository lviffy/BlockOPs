const { ethers } = require('ethers');
const { getProvider, getWallet } = require('../utils/blockchain');
const { successResponse, errorResponse, validateRequiredFields, getTxExplorerUrl } = require('../utils/helpers');

// OpenZeppelin Governor ABI (minimal)
const GOVERNOR_ABI = [
  // Proposals
  'function propose(address[] targets, uint256[] values, bytes[] calldatas, string description) external returns (uint256)',
  'function castVote(uint256 proposalId, uint8 support) external returns (uint256)',
  'function castVoteWithReason(uint256 proposalId, uint8 support, string reason) external returns (uint256)',
  'function state(uint256 proposalId) external view returns (uint8)',
  'function proposalDeadline(uint256 proposalId) external view returns (uint256)',
  'function proposalSnapshot(uint256 proposalId) external view returns (uint256)',
  'function getVotes(address account, uint256 blockNumber) external view returns (uint256)',
  'function hasVoted(uint256 proposalId, address account) external view returns (bool)',
  'function name() external view returns (string)',
  'function votingDelay() external view returns (uint256)',
  'function votingPeriod() external view returns (uint256)',
  'function proposalThreshold() external view returns (uint256)',
  'function quorum(uint256 blockNumber) external view returns (uint256)',
  // Events for query
  'event ProposalCreated(uint256 proposalId, address proposer, address[] targets, uint256[] values, string[] signatures, bytes[] calldatas, uint256 voteStart, uint256 voteEnd, string description)',
  'event VoteCast(address indexed voter, uint256 proposalId, uint8 support, uint256 weight, string reason)'
];

// ERC20Votes / IVotes ABI for delegation
const VOTES_ABI = [
  'function delegate(address delegatee) external',
  'function delegates(address account) external view returns (address)',
  'function getVotes(address account) external view returns (uint256)',
  'function getPastVotes(address account, uint256 blockNumber) external view returns (uint256)'
];

const PROPOSAL_STATES = ['Pending', 'Active', 'Canceled', 'Defeated', 'Succeeded', 'Queued', 'Expired', 'Executed'];
const VOTE_SUPPORT = { against: 0, for: 1, abstain: 2 };

/**
 * GET /governance/proposals/:governorAddress
 * List recent proposals from a Governor contract (via event logs)
 */
async function listProposals(req, res) {
  try {
    const { governorAddress } = req.params;
    const { limit = 10 } = req.query;

    if (!ethers.isAddress(governorAddress)) {
      return res.status(400).json(errorResponse('Invalid governor contract address'));
    }

    const provider = getProvider();
    const governor = new ethers.Contract(governorAddress, GOVERNOR_ABI, provider);

    // Governor name
    let govName = 'Governor';
    try { govName = await governor.name(); } catch {}

    // Fetch ProposalCreated events
    const filter = governor.filters.ProposalCreated();
    const latestBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, latestBlock - 100_000);
    const events = await governor.queryFilter(filter, fromBlock, latestBlock);

    const proposals = await Promise.allSettled(
      events.slice(-Number(limit)).reverse().map(async (e) => {
        const { proposalId, proposer, description, voteStart, voteEnd } = e.args;
        let state;
        try {
          const stateIdx = await governor.state(proposalId);
          state = PROPOSAL_STATES[stateIdx] || String(stateIdx);
        } catch { state = 'unknown'; }

        return {
          proposalId: proposalId.toString(),
          proposer,
          description: description.slice(0, 200) + (description.length > 200 ? '...' : ''),
          voteStart: voteStart.toString(),
          voteEnd: voteEnd.toString(),
          state
        };
      })
    );

    return res.json(successResponse({
      governorAddress,
      governorName: govName,
      proposals: proposals.map(p => p.status === 'fulfilled' ? p.value : { error: p.reason?.message })
    }));
  } catch (error) {
    console.error('List proposals error:', error);
    return res.status(500).json(errorResponse('Failed to list proposals', error.message));
  }
}

/**
 * POST /governance/vote
 * Cast a vote on a Governor proposal
 * Body: { privateKey, governorAddress, proposalId, support (for|against|abstain), reason? }
 */
async function castVote(req, res) {
  try {
    const { privateKey, governorAddress, proposalId, support, reason } = req.body;

    const validationError = validateRequiredFields(req.body, ['privateKey', 'governorAddress', 'proposalId', 'support']);
    if (validationError) return res.status(400).json(validationError);

    if (!ethers.isAddress(governorAddress)) {
      return res.status(400).json(errorResponse('Invalid governor address'));
    }

    const supportNum = typeof support === 'number' ? support : VOTE_SUPPORT[support.toLowerCase()];
    if (supportNum === undefined) {
      return res.status(400).json(errorResponse('support must be "for", "against", "abstain", or 0/1/2'));
    }

    const provider = getProvider();
    const wallet = getWallet(privateKey, provider);
    const governor = new ethers.Contract(governorAddress, GOVERNOR_ABI, wallet);

    // Check already voted
    const alreadyVoted = await governor.hasVoted(proposalId, wallet.address);
    if (alreadyVoted) {
      return res.status(400).json(errorResponse(`Address ${wallet.address} has already voted on proposal ${proposalId}`));
    }

    const tx = reason
      ? await governor.castVoteWithReason(proposalId, supportNum, reason)
      : await governor.castVote(proposalId, supportNum);

    const receipt = await tx.wait();

    return res.json(successResponse({
      type: 'governance_vote',
      transactionHash: receipt.hash,
      explorerUrl: getTxExplorerUrl(receipt.hash),
      voter: wallet.address,
      governorAddress,
      proposalId: proposalId.toString(),
      support: Object.keys(VOTE_SUPPORT).find(k => VOTE_SUPPORT[k] === supportNum),
      reason: reason || null,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString()
    }));
  } catch (error) {
    console.error('Cast vote error:', error);
    return res.status(500).json(errorResponse('Vote failed', error.message));
  }
}

/**
 * POST /governance/delegate
 * Delegate voting power on an ERC20Votes-compatible token
 * Body: { privateKey, tokenAddress, delegatee }
 */
async function delegateVotes(req, res) {
  try {
    const { privateKey, tokenAddress, delegatee } = req.body;

    const validationError = validateRequiredFields(req.body, ['privateKey', 'tokenAddress', 'delegatee']);
    if (validationError) return res.status(400).json(validationError);

    if (!ethers.isAddress(tokenAddress) || !ethers.isAddress(delegatee)) {
      return res.status(400).json(errorResponse('Invalid token or delegatee address'));
    }

    const provider = getProvider();
    const wallet = getWallet(privateKey, provider);
    const token = new ethers.Contract(tokenAddress, VOTES_ABI, wallet);

    const tx = await token.delegate(delegatee);
    const receipt = await tx.wait();

    // Fetch new vote balance
    let votes = '0';
    try {
      const v = await token.getVotes(wallet.address);
      votes = ethers.formatEther(v);
    } catch {}

    return res.json(successResponse({
      type: 'governance_delegate',
      transactionHash: receipt.hash,
      explorerUrl: getTxExplorerUrl(receipt.hash),
      delegator: wallet.address,
      delegatee,
      tokenAddress,
      votingPower: votes,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString()
    }));
  } catch (error) {
    console.error('Delegate error:', error);
    return res.status(500).json(errorResponse('Delegation failed', error.message));
  }
}

/**
 * POST /governance/create
 * Create a new proposal on a Governor contract
 * Body: { privateKey, governorAddress, targets[], values[], calldatas[], description }
 */
async function createProposal(req, res) {
  try {
    const { privateKey, governorAddress, targets, values, calldatas, description } = req.body;

    const validationError = validateRequiredFields(req.body, ['privateKey', 'governorAddress', 'targets', 'calldatas', 'description']);
    if (validationError) return res.status(400).json(validationError);

    if (!ethers.isAddress(governorAddress)) {
      return res.status(400).json(errorResponse('Invalid governor address'));
    }

    if (!Array.isArray(targets) || targets.length === 0) {
      return res.status(400).json(errorResponse('targets must be a non-empty array'));
    }

    const provider = getProvider();
    const wallet = getWallet(privateKey, provider);
    const governor = new ethers.Contract(governorAddress, GOVERNOR_ABI, wallet);

    const vals = values || targets.map(() => 0);
    const tx = await governor.propose(targets, vals, calldatas, description);
    const receipt = await tx.wait();

    // Extract proposalId from event
    let proposalId = null;
    try {
      const iface = new ethers.Interface(GOVERNOR_ABI);
      for (const log of receipt.logs) {
        try {
          const parsed = iface.parseLog(log);
          if (parsed.name === 'ProposalCreated') {
            proposalId = parsed.args.proposalId.toString();
            break;
          }
        } catch {}
      }
    } catch {}

    return res.json(successResponse({
      type: 'governance_propose',
      transactionHash: receipt.hash,
      explorerUrl: getTxExplorerUrl(receipt.hash),
      proposalId,
      proposer: wallet.address,
      governorAddress,
      descriptionPreview: description.slice(0, 100),
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString()
    }));
  } catch (error) {
    console.error('Create proposal error:', error);
    return res.status(500).json(errorResponse('Proposal creation failed', error.message));
  }
}

/**
 * GET /governance/votes/:tokenAddress/:address
 * Get current voting power for an address
 */
async function getVotingPower(req, res) {
  try {
    const { tokenAddress, address } = req.params;
    if (!ethers.isAddress(tokenAddress) || !ethers.isAddress(address)) {
      return res.status(400).json(errorResponse('Invalid address'));
    }

    const provider = getProvider();
    const token = new ethers.Contract(tokenAddress, VOTES_ABI, provider);

    const [votes, delegatee] = await Promise.all([
      token.getVotes(address),
      token.delegates(address)
    ]);

    return res.json(successResponse({
      address,
      tokenAddress,
      votingPower: ethers.formatEther(votes),
      votingPowerRaw: votes.toString(),
      delegatedTo: delegatee,
      selfDelegated: delegatee.toLowerCase() === address.toLowerCase()
    }));
  } catch (error) {
    console.error('Get votes error:', error);
    return res.status(500).json(errorResponse('Failed to fetch voting power', error.message));
  }
}

module.exports = { listProposals, castVote, delegateVotes, createProposal, getVotingPower };
