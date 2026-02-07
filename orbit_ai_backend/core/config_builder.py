"""
Config builder: transforms collected params into complete OrbitConfig.
"""
import logging
from typing import Optional

from models.orbit_config import (
    OrbitConfig,
    ChainConfig,
    NativeToken,
    DataAvailabilityMode,
    ParentChain,
)
from models.conversation import ConversationSession
from utils.validators import generate_chain_id
from utils.defaults import (
    generate_validators,
    generate_sequencer_url,
    get_preset,
    DEFAULT_NATIVE_TOKEN,
)

logger = logging.getLogger(__name__)


class ConfigBuilder:
    """Builds complete OrbitConfig from collected conversation parameters."""
    
    def build_from_session(self, session: ConversationSession) -> Optional[OrbitConfig]:
        """Build a complete config from session's collected params."""
        params = session.collected_params
        
        if not params:
            return None
        
        # Get use case preset for defaults
        use_case = params.get("use_case", "general")
        preset = get_preset(use_case)
        defaults = preset.get("defaults", {})
        
        # Extract values with defaults
        chain_name = params.get("chain_name", f"orbit-chain-{generate_chain_id()}")
        
        # Parent chain
        parent_chain_str = params.get("parent_chain", "arbitrum-sepolia")
        try:
            parent_chain = ParentChain(parent_chain_str)
        except ValueError:
            parent_chain = ParentChain.ARBITRUM_SEPOLIA
        
        # Data availability
        da_str = params.get("data_availability", defaults.get("data_availability", "anytrust"))
        try:
            data_availability = DataAvailabilityMode(da_str)
        except ValueError:
            data_availability = DataAvailabilityMode.ANYTRUST
        
        # Validators
        validator_count = params.get("validators", defaults.get("validators", 3))
        if isinstance(validator_count, int):
            validators = generate_validators(validator_count)
        elif isinstance(validator_count, list):
            validators = validator_count
        else:
            validators = generate_validators(3)
        
        # Owner address
        owner = params.get("owner_address")
        if not owner:
            owner = session.wallet_address or "0x0000000000000000000000000000000000000000"
        
        # Native token
        native_token_data = params.get("native_token", DEFAULT_NATIVE_TOKEN)
        if isinstance(native_token_data, dict):
            native_token = NativeToken(**native_token_data)
        else:
            native_token = NativeToken()
        
        # Block time and gas limit
        block_time = params.get("block_time", defaults.get("block_time", 2))
        gas_limit = params.get("gas_limit", defaults.get("gas_limit", 30_000_000))
        challenge_period = params.get("challenge_period", defaults.get("challenge_period_days", 7))
        
        # Build chain config
        chain_config = ChainConfig(
            chain_name=chain_name.replace("-", " ").title(),  # Human readable name
            native_token=native_token,
            sequencer_url=generate_sequencer_url(chain_name),
            block_time=block_time,
            gas_limit=gas_limit,
            challenge_period_days=challenge_period,
        )
        
        # Generate chain ID
        chain_id = generate_chain_id()
        
        # Build complete config
        try:
            config = OrbitConfig(
                name=chain_name.lower().replace(" ", "-"),
                chain_id=chain_id,
                parent_chain=parent_chain,
                owner_address=owner,
                validators=validators,
                data_availability=data_availability,
                chain_config=chain_config,
                use_case=use_case,
            )
            return config
        except Exception as e:
            logger.error(f"Failed to build config: {e}")
            return None
    
    def format_config_summary(self, config: OrbitConfig) -> str:
        """Format config as a summary string for display."""
        lines = [
            f"┌─────────────────────────────────────────┐",
            f"│  {config.chain_config.chain_name} L3 Chain",
            f"├─────────────────────────────────────────┤",
            f"│  Chain ID:        {config.chain_id:,}",
            f"│  Parent Chain:    {config.parent_chain.value.replace('-', ' ').title()}",
            f"│  DA Mode:         {config.data_availability.value.title()}",
            f"│  Block Time:      {config.chain_config.block_time} second(s)",
            f"│  Gas Limit:       {config.chain_config.gas_limit:,}",
            f"│  Validators:      {len(config.validators)}",
            f"│  Native Token:    {config.chain_config.native_token.symbol}",
            f"│  Challenge Period: {config.chain_config.challenge_period_days} days",
            f"│  Owner:           {config.owner_address[:10]}...{config.owner_address[-6:]}",
            f"└─────────────────────────────────────────┘",
        ]
        return "\n".join(lines)
    
    def validate_config(self, config: OrbitConfig) -> tuple[bool, list[str]]:
        """Validate a config and return (is_valid, errors)."""
        errors = []
        
        # Check required fields
        if not config.name:
            errors.append("Chain name is required")
        
        if not config.owner_address or config.owner_address == "0x0000000000000000000000000000000000000000":
            errors.append("Valid owner address is required")
        
        if not config.validators or len(config.validators) < 1:
            errors.append("At least 1 validator is required")
        
        if config.chain_config.block_time < 1 or config.chain_config.block_time > 30:
            errors.append("Block time must be between 1-30 seconds")
        
        if config.chain_config.gas_limit < 1_000_000:
            errors.append("Gas limit too low")
        
        return (len(errors) == 0, errors)


# Singleton instance
_config_builder: Optional[ConfigBuilder] = None


def get_config_builder() -> ConfigBuilder:
    """Get or create the config builder singleton."""
    global _config_builder
    if _config_builder is None:
        _config_builder = ConfigBuilder()
    return _config_builder
