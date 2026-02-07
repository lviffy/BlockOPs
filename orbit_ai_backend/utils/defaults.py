"""
Smart defaults and use-case presets for Orbit configuration.
"""
from typing import Any


# Use-case presets with recommended defaults
USE_CASE_PRESETS = {
    "gaming": {
        "id": "gaming",
        "name": "Gaming",
        "description": "Optimized for fast transactions and low latency gaming",
        "icon": "🎮",
        "defaults": {
            "data_availability": "anytrust",
            "block_time": 1,
            "gas_limit": 50_000_000,
            "validators": 3,
            "challenge_period_days": 7,
        },
    },
    "defi": {
        "id": "defi",
        "name": "DeFi",
        "description": "Maximum security for financial applications",
        "icon": "💰",
        "defaults": {
            "data_availability": "rollup",
            "block_time": 2,
            "gas_limit": 30_000_000,
            "validators": 5,
            "challenge_period_days": 7,
        },
    },
    "enterprise": {
        "id": "enterprise",
        "name": "Enterprise",
        "description": "Private chain for business applications",
        "icon": "🏢",
        "defaults": {
            "data_availability": "anytrust",
            "block_time": 3,
            "gas_limit": 30_000_000,
            "validators": 5,
            "challenge_period_days": 14,
        },
    },
    "nft": {
        "id": "nft",
        "name": "NFT Platform",
        "description": "Optimized for NFT minting and trading",
        "icon": "🖼️",
        "defaults": {
            "data_availability": "anytrust",
            "block_time": 2,
            "gas_limit": 40_000_000,
            "validators": 3,
            "challenge_period_days": 7,
        },
    },
    "general": {
        "id": "general",
        "name": "General Purpose",
        "description": "Balanced configuration for mixed use cases",
        "icon": "⚡",
        "defaults": {
            "data_availability": "anytrust",
            "block_time": 2,
            "gas_limit": 30_000_000,
            "validators": 3,
            "challenge_period_days": 7,
        },
    },
}


def get_preset(use_case: str) -> dict:
    """Get preset configuration for a use case."""
    return USE_CASE_PRESETS.get(use_case.lower(), USE_CASE_PRESETS["general"])


def get_all_presets() -> list[dict]:
    """Get all available presets."""
    return list(USE_CASE_PRESETS.values())


def get_default_value(use_case: str, field: str) -> Any:
    """Get a specific default value for a use case."""
    preset = get_preset(use_case)
    return preset["defaults"].get(field)


def generate_validators(count: int) -> list[str]:
    """Generate placeholder validator addresses."""
    validators = []
    for i in range(count):
        # Generate address like 0x1111...1111, 0x2222...2222, etc.
        hex_char = hex(i + 1)[2:]
        addr = "0x" + hex_char * 40
        validators.append(addr[:42])  # Ensure exactly 42 chars
    return validators


def generate_sequencer_url(chain_name: str) -> str:
    """Generate a sequencer URL for a chain."""
    clean_name = chain_name.lower().replace(" ", "-").replace("_", "-")
    return f"https://sequencer-{clean_name}.example.com"


def generate_explorer_url(chain_name: str) -> str:
    """Generate an explorer URL for a chain."""
    clean_name = chain_name.lower().replace(" ", "-").replace("_", "-")
    return f"https://{clean_name}-explorer.example.com"


def generate_rpc_url(chain_name: str) -> str:
    """Generate an RPC URL for a chain."""
    clean_name = chain_name.lower().replace(" ", "-").replace("_", "-")
    return f"https://{clean_name}-rpc.example.com"


# Default native token configurations
DEFAULT_NATIVE_TOKEN = {
    "name": "Ether",
    "symbol": "ETH",
    "decimals": 18,
}


# Parent chain options with display names
PARENT_CHAINS = {
    "arbitrum-sepolia": {
        "name": "Arbitrum Sepolia",
        "description": "Testnet - recommended for development",
        "chain_id": 421614,
    },
    "arbitrum-one": {
        "name": "Arbitrum One",
        "description": "Mainnet - for production deployments",
        "chain_id": 42161,
    },
    "arbitrum-nova": {
        "name": "Arbitrum Nova",
        "description": "High-throughput chain with AnyTrust",
        "chain_id": 42170,
    },
}


def get_parent_chain_info(parent_chain: str) -> dict:
    """Get info about a parent chain."""
    return PARENT_CHAINS.get(parent_chain, PARENT_CHAINS["arbitrum-sepolia"])
