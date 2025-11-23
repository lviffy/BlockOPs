-- Arbitrum Orbit L3 Configuration Tables
-- Migration for orbit builder feature

-- Create orbit_configs table
CREATE TABLE IF NOT EXISTS orbit_configs (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255),
    name VARCHAR(255) NOT NULL,
    chain_id BIGINT NOT NULL UNIQUE,
    description TEXT,
    parent_chain VARCHAR(50) NOT NULL,
    native_token VARCHAR(255),
    data_availability VARCHAR(50) DEFAULT 'anytrust',
    validators JSONB DEFAULT '[]'::jsonb,
    challenge_period INTEGER DEFAULT 604800,
    stake_token VARCHAR(255),
    l2_gas_price DECIMAL(20, 10) DEFAULT 0.1,
    l1_gas_price DECIMAL(20, 10) DEFAULT 10,
    sequencer_address VARCHAR(255),
    owner_address VARCHAR(255) NOT NULL,
    batch_poster_address VARCHAR(255),
    status VARCHAR(50) DEFAULT 'draft',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create orbit_deployments table
CREATE TABLE IF NOT EXISTS orbit_deployments (
    id VARCHAR(255) PRIMARY KEY,
    config_id VARCHAR(255) NOT NULL REFERENCES orbit_configs(id) ON DELETE CASCADE,
    user_id VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending',
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    transaction_hash VARCHAR(255),
    chain_address VARCHAR(255),
    explorer_url TEXT,
    rpc_url TEXT,
    logs JSONB DEFAULT '[]'::jsonb,
    error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_orbit_configs_user_id ON orbit_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_orbit_configs_status ON orbit_configs(status);
CREATE INDEX IF NOT EXISTS idx_orbit_configs_chain_id ON orbit_configs(chain_id);
CREATE INDEX IF NOT EXISTS idx_orbit_deployments_config_id ON orbit_deployments(config_id);
CREATE INDEX IF NOT EXISTS idx_orbit_deployments_user_id ON orbit_deployments(user_id);
CREATE INDEX IF NOT EXISTS idx_orbit_deployments_status ON orbit_deployments(status);

-- Create updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_orbit_configs_updated_at ON orbit_configs;
CREATE TRIGGER update_orbit_configs_updated_at
    BEFORE UPDATE ON orbit_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_orbit_deployments_updated_at ON orbit_deployments;
CREATE TRIGGER update_orbit_deployments_updated_at
    BEFORE UPDATE ON orbit_deployments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE orbit_configs IS 'Stores Arbitrum Orbit L3 chain configurations';
COMMENT ON TABLE orbit_deployments IS 'Tracks deployment status and results for L3 chains';

COMMENT ON COLUMN orbit_configs.chain_id IS 'Unique blockchain chain ID (1-4294967295)';
COMMENT ON COLUMN orbit_configs.parent_chain IS 'Parent chain to deploy on (arbitrum-one, arbitrum-sepolia, etc.)';
COMMENT ON COLUMN orbit_configs.data_availability IS 'Data availability mode (anytrust or rollup)';
COMMENT ON COLUMN orbit_configs.validators IS 'Array of validator addresses in JSON format';
COMMENT ON COLUMN orbit_configs.challenge_period IS 'Challenge period in seconds (default 7 days)';
COMMENT ON COLUMN orbit_configs.status IS 'Configuration status (draft, deploying, deployed, failed)';

COMMENT ON COLUMN orbit_deployments.logs IS 'Deployment progress logs in JSON array format';
COMMENT ON COLUMN orbit_deployments.chain_address IS 'Deployed chain contract address';
COMMENT ON COLUMN orbit_deployments.rpc_url IS 'RPC endpoint URL for the deployed L3 chain';
