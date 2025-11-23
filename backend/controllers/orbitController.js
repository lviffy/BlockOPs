const { ethers } = require('ethers');

/**
 * Orbit L3 Configuration Controller
 * Handles creation, validation, and management of Arbitrum Orbit L3 chain configurations
 */

// In-memory storage for now (will be replaced with database)
const configs = new Map();
const deployments = new Map();

/**
 * Create a new L3 configuration
 * POST /api/orbit/config
 */
async function createConfig(req, res) {
  try {
    const {
      name,
      chainId,
      description,
      // Chain Parameters
      parentChain,
      nativeToken,
      dataAvailability,
      // Validation Parameters
      validators,
      challengePeriod,
      stakeToken,
      // Gas Configuration
      l2GasPrice,
      l1GasPrice,
      // Advanced Settings
      sequencerAddress,
      ownerAddress,
      batchPosterAddress,
    } = req.body;

    // Validation
    if (!name || !chainId || !parentChain) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, chainId, parentChain'
      });
    }

    // Validate chain ID is unique and within range
    if (chainId < 1 || chainId > 4294967295) {
      return res.status(400).json({
        success: false,
        error: 'Chain ID must be between 1 and 4,294,967,295'
      });
    }

    // Validate parent chain
    const validParentChains = ['arbitrum-one', 'arbitrum-sepolia', 'arbitrum-goerli', 'ethereum'];
    if (!validParentChains.includes(parentChain)) {
      return res.status(400).json({
        success: false,
        error: `Invalid parent chain. Must be one of: ${validParentChains.join(', ')}`
      });
    }

    // Validate validators array
    if (validators && !Array.isArray(validators)) {
      return res.status(400).json({
        success: false,
        error: 'Validators must be an array of addresses'
      });
    }

    // Validate addresses
    const addresses = [sequencerAddress, ownerAddress, batchPosterAddress].filter(Boolean);
    for (const addr of addresses) {
      if (!ethers.isAddress(addr)) {
        return res.status(400).json({
          success: false,
          error: `Invalid Ethereum address: ${addr}`
        });
      }
    }

    const configId = `config_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    const config = {
      id: configId,
      name,
      chainId,
      description: description || '',
      parentChain,
      nativeToken: nativeToken || null,
      dataAvailability: dataAvailability || 'anytrust',
      validators: validators || [],
      challengePeriod: challengePeriod || 604800, // 7 days in seconds
      stakeToken: stakeToken || null,
      l2GasPrice: l2GasPrice || '0.1',
      l1GasPrice: l1GasPrice || '10',
      sequencerAddress: sequencerAddress || null,
      ownerAddress: ownerAddress || null,
      batchPosterAddress: batchPosterAddress || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'draft'
    };

    configs.set(configId, config);

    return res.status(201).json({
      success: true,
      message: 'L3 configuration created successfully',
      data: {
        configId,
        config
      }
    });
  } catch (error) {
    console.error('Error creating L3 config:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}

/**
 * Get a configuration by ID
 * GET /api/orbit/config/:id
 */
async function getConfig(req, res) {
  try {
    const { id } = req.params;

    const config = configs.get(id);
    if (!config) {
      return res.status(404).json({
        success: false,
        error: 'Configuration not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: config
    });
  } catch (error) {
    console.error('Error fetching config:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}

/**
 * List all configurations
 * GET /api/orbit/configs
 */
async function listConfigs(req, res) {
  try {
    const allConfigs = Array.from(configs.values());

    return res.status(200).json({
      success: true,
      data: {
        configs: allConfigs,
        count: allConfigs.length
      }
    });
  } catch (error) {
    console.error('Error listing configs:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}

/**
 * Update a configuration
 * PUT /api/orbit/config/:id
 */
async function updateConfig(req, res) {
  try {
    const { id } = req.params;
    const updates = req.body;

    const config = configs.get(id);
    if (!config) {
      return res.status(404).json({
        success: false,
        error: 'Configuration not found'
      });
    }

    // Don't allow updating if already deployed
    if (config.status === 'deployed') {
      return res.status(400).json({
        success: false,
        error: 'Cannot update a deployed configuration'
      });
    }

    const updatedConfig = {
      ...config,
      ...updates,
      id: config.id, // Preserve ID
      createdAt: config.createdAt, // Preserve creation date
      updatedAt: new Date().toISOString()
    };

    configs.set(id, updatedConfig);

    return res.status(200).json({
      success: true,
      message: 'Configuration updated successfully',
      data: updatedConfig
    });
  } catch (error) {
    console.error('Error updating config:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}

/**
 * Delete a configuration
 * DELETE /api/orbit/config/:id
 */
async function deleteConfig(req, res) {
  try {
    const { id } = req.params;

    const config = configs.get(id);
    if (!config) {
      return res.status(404).json({
        success: false,
        error: 'Configuration not found'
      });
    }

    // Don't allow deleting if already deployed
    if (config.status === 'deployed') {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete a deployed configuration'
      });
    }

    configs.delete(id);

    return res.status(200).json({
      success: true,
      message: 'Configuration deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting config:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}

/**
 * Validate a configuration
 * POST /api/orbit/config/:id/validate
 */
async function validateConfig(req, res) {
  try {
    const { id } = req.params;

    const config = configs.get(id);
    if (!config) {
      return res.status(404).json({
        success: false,
        error: 'Configuration not found'
      });
    }

    const validationErrors = [];
    const validationWarnings = [];

    // Check required fields
    if (!config.name) validationErrors.push('Chain name is required');
    if (!config.chainId) validationErrors.push('Chain ID is required');
    if (!config.parentChain) validationErrors.push('Parent chain is required');

    // Check validators
    if (!config.validators || config.validators.length === 0) {
      validationWarnings.push('No validators configured. At least one validator is recommended.');
    }

    // Check sequencer
    if (!config.sequencerAddress) {
      validationWarnings.push('No sequencer address configured. This is required for deployment.');
    }

    // Check owner
    if (!config.ownerAddress) {
      validationWarnings.push('No owner address configured. This is required for deployment.');
    }

    const isValid = validationErrors.length === 0;

    return res.status(200).json({
      success: true,
      data: {
        isValid,
        errors: validationErrors,
        warnings: validationWarnings
      }
    });
  } catch (error) {
    console.error('Error validating config:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}

/**
 * Deploy L3 chain
 * POST /api/orbit/deploy
 */
async function deployChain(req, res) {
  try {
    const { configId } = req.body;

    const config = configs.get(configId);
    if (!config) {
      return res.status(404).json({
        success: false,
        error: 'Configuration not found'
      });
    }

    // Validate configuration before deployment
    const validationErrors = [];
    if (!config.ownerAddress) validationErrors.push('Owner address is required');
    if (!config.sequencerAddress) validationErrors.push('Sequencer address is required');
    if (!config.validators || config.validators.length === 0) {
      validationErrors.push('At least one validator is required');
    }

    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Configuration validation failed',
        details: validationErrors
      });
    }

    const deploymentId = `deploy_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    const deployment = {
      id: deploymentId,
      configId,
      status: 'pending',
      startedAt: new Date().toISOString(),
      completedAt: null,
      transactionHash: null,
      chainAddress: null,
      explorerUrl: null,
      rpcUrl: null,
      logs: ['Deployment initiated...'],
      error: null
    };

    deployments.set(deploymentId, deployment);

    // Update config status
    config.status = 'deploying';
    configs.set(configId, config);

    // Start deployment in background (this is a placeholder)
    // In production, this would call the actual Orbit SDK
    setTimeout(() => {
      simulateDeployment(deploymentId, configId);
    }, 1000);

    return res.status(202).json({
      success: true,
      message: 'Deployment started',
      data: {
        deploymentId,
        status: 'pending'
      }
    });
  } catch (error) {
    console.error('Error deploying chain:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}

/**
 * Get deployment status
 * GET /api/orbit/deploy/status/:id
 */
async function getDeploymentStatus(req, res) {
  try {
    const { id } = req.params;

    const deployment = deployments.get(id);
    if (!deployment) {
      return res.status(404).json({
        success: false,
        error: 'Deployment not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: deployment
    });
  } catch (error) {
    console.error('Error fetching deployment status:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}

/**
 * Simulate deployment process (placeholder)
 * This will be replaced with actual Orbit SDK integration
 */
function simulateDeployment(deploymentId, configId) {
  const deployment = deployments.get(deploymentId);
  const config = configs.get(configId);

  // Simulate deployment steps
  const steps = [
    'Validating configuration...',
    'Deploying rollup contracts...',
    'Configuring validators...',
    'Setting up sequencer...',
    'Initializing chain state...',
    'Verifying deployment...',
    'Deployment complete!'
  ];

  let stepIndex = 0;

  const interval = setInterval(() => {
    if (stepIndex < steps.length) {
      deployment.logs.push(steps[stepIndex]);
      stepIndex++;

      if (stepIndex === steps.length) {
        // Deployment complete
        deployment.status = 'completed';
        deployment.completedAt = new Date().toISOString();
        deployment.transactionHash = `0x${Math.random().toString(16).substring(2, 66)}`;
        deployment.chainAddress = `0x${Math.random().toString(16).substring(2, 42)}`;
        deployment.explorerUrl = `https://sepolia-explorer.arbitrum.io/address/${deployment.chainAddress}`;
        deployment.rpcUrl = `https://l3-${config.chainId}.arbitrum.io/rpc`;

        config.status = 'deployed';
        configs.set(configId, config);

        clearInterval(interval);
      }
    }
  }, 2000);
}

module.exports = {
  createConfig,
  getConfig,
  listConfigs,
  updateConfig,
  deleteConfig,
  validateConfig,
  deployChain,
  getDeploymentStatus
};
