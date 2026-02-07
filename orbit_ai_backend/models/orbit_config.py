"""
Pydantic models for Orbit L3 chain configuration.
"""
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field, field_validator
import re


class DataAvailabilityMode(str, Enum):
    """Data availability modes for Orbit chains."""
    ANYTRUST = "anytrust"
    ROLLUP = "rollup"


class ParentChain(str, Enum):
    """Supported parent chains."""
    ARBITRUM_SEPOLIA = "arbitrum-sepolia"
    ARBITRUM_ONE = "arbitrum-one"
    ARBITRUM_NOVA = "arbitrum-nova"


class NativeToken(BaseModel):
    """Native token configuration."""
    name: str = "Ether"
    symbol: str = "ETH"
    decimals: int = 18


class ChainConfig(BaseModel):
    """Detailed chain configuration."""
    chain_name: str
    native_token: NativeToken = Field(default_factory=NativeToken)
    sequencer_url: Optional[str] = None
    block_time: int = 2  # seconds
    gas_limit: int = 30_000_000
    challenge_period_days: int = 7


class OrbitConfig(BaseModel):
    """Complete Orbit L3 chain configuration."""
    # Required
    name: str = Field(..., description="URL-friendly chain name")
    chain_id: int = Field(..., ge=412000, le=999999, description="Unique chain ID")
    parent_chain: ParentChain = ParentChain.ARBITRUM_SEPOLIA
    owner_address: str = Field(..., description="Chain owner wallet address")
    
    # Validators
    validators: list[str] = Field(default_factory=list, min_length=1)
    
    # Data availability
    data_availability: DataAvailabilityMode = DataAvailabilityMode.ANYTRUST
    
    # Chain config
    chain_config: ChainConfig
    
    # Auto-generated
    sequencer_address: Optional[str] = None
    batch_poster_address: Optional[str] = None
    
    # Metadata
    use_case: Optional[str] = None  # gaming, defi, enterprise, nft, general
    
    @field_validator("owner_address", "sequencer_address", "batch_poster_address")
    @classmethod
    def validate_address(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        if not re.match(r"^0x[a-fA-F0-9]{40}$", v):
            raise ValueError("Invalid Ethereum address format")
        return v.lower()
    
    @field_validator("validators")
    @classmethod
    def validate_validators(cls, v: list[str]) -> list[str]:
        validated = []
        for addr in v:
            if not re.match(r"^0x[a-fA-F0-9]{40}$", addr):
                raise ValueError(f"Invalid validator address: {addr}")
            validated.append(addr.lower())
        return validated
    
    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        # Make URL-friendly: lowercase, replace spaces with hyphens
        clean = re.sub(r"[^a-zA-Z0-9\s-]", "", v)
        clean = re.sub(r"\s+", "-", clean).lower().strip("-")
        if not clean:
            raise ValueError("Chain name must contain alphanumeric characters")
        return clean
    
    def to_backend_format(self) -> dict:
        """Convert to format expected by Node.js backend."""
        return {
            "name": self.name,
            "chainId": str(self.chain_id),
            "parentChain": self.parent_chain.value,
            "owner": self.owner_address,
            "validators": self.validators,
            "chainConfig": {
                "chainName": self.chain_config.chain_name,
                "nativeToken": {
                    "name": self.chain_config.native_token.name,
                    "symbol": self.chain_config.native_token.symbol,
                    "decimals": self.chain_config.native_token.decimals,
                },
                "sequencerUrl": self.chain_config.sequencer_url or f"https://sequencer-{self.name}.example.com",
                "blockTime": self.chain_config.block_time,
                "gasLimit": self.chain_config.gas_limit,
            },
            "dataAvailability": self.data_availability.value,
        }


class PartialOrbitConfig(BaseModel):
    """Partial config during collection (all fields optional)."""
    name: Optional[str] = None
    chain_id: Optional[int] = None
    parent_chain: Optional[str] = None
    owner_address: Optional[str] = None
    validators: Optional[list[str]] = None
    data_availability: Optional[str] = None
    chain_name: Optional[str] = None
    native_token_name: Optional[str] = None
    native_token_symbol: Optional[str] = None
    block_time: Optional[int] = None
    gas_limit: Optional[int] = None
    challenge_period_days: Optional[int] = None
    use_case: Optional[str] = None
