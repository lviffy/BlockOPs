"""
Pydantic models for conversation state and session management.
"""
from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class ConversationPhase(str, Enum):
    """Phases of the configuration conversation."""
    GREETING = "greeting"
    DISCOVERY = "discovery"
    CONFIGURATION = "configuration"
    REVIEW = "review"
    DEPLOYING = "deploying"
    DEPLOYED = "deployed"


class ConfigStep(str, Enum):
    """Steps within the configuration phase."""
    USE_CASE = "use_case"
    CHAIN_NAME = "chain_name"
    PARENT_CHAIN = "parent_chain"
    DATA_AVAILABILITY = "data_availability"
    VALIDATORS = "validators"
    OWNER_ADDRESS = "owner_address"
    NATIVE_TOKEN = "native_token"
    BLOCK_TIME = "block_time"
    GAS_LIMIT = "gas_limit"
    CHALLENGE_PERIOD = "challenge_period"
    COMPLETE = "complete"


# Order of steps for iteration
CONFIG_STEP_ORDER = [
    ConfigStep.USE_CASE,
    ConfigStep.CHAIN_NAME,
    ConfigStep.PARENT_CHAIN,
    ConfigStep.DATA_AVAILABILITY,
    ConfigStep.VALIDATORS,
    ConfigStep.OWNER_ADDRESS,
    ConfigStep.NATIVE_TOKEN,
    ConfigStep.BLOCK_TIME,
    ConfigStep.GAS_LIMIT,
    ConfigStep.CHALLENGE_PERIOD,
    ConfigStep.COMPLETE,
]


class Message(BaseModel):
    """A single message in the conversation."""
    id: str
    role: str  # "user" | "assistant"
    content: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    quick_actions: Optional[list[dict]] = None  # [{label, value}] for inline buttons


class ConfigProgress(BaseModel):
    """Progress through configuration steps."""
    completed: list[str] = Field(default_factory=list)
    remaining: list[str] = Field(default_factory=list)
    percentage: int = 0


class ConversationSession(BaseModel):
    """Full conversation session state."""
    session_id: str
    user_id: Optional[str] = None
    wallet_address: Optional[str] = None
    
    # State
    phase: ConversationPhase = ConversationPhase.GREETING
    current_step: ConfigStep = ConfigStep.USE_CASE
    
    # History
    messages: list[Message] = Field(default_factory=list)
    
    # Collected parameters (values collected from conversation)
    collected_params: dict = Field(default_factory=dict)
    
    # Final config (built from collected_params)
    config: Optional[dict] = None
    
    # Deployment
    deployment_id: Optional[str] = None
    deployment_status: Optional[str] = None
    
    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    def get_progress(self) -> ConfigProgress:
        """Calculate configuration progress."""
        completed = []
        remaining = []
        
        current_idx = CONFIG_STEP_ORDER.index(self.current_step)
        
        for i, step in enumerate(CONFIG_STEP_ORDER):
            if step == ConfigStep.COMPLETE:
                continue
            if i < current_idx:
                completed.append(step.value)
            else:
                remaining.append(step.value)
        
        total = len(CONFIG_STEP_ORDER) - 1  # Exclude COMPLETE
        pct = int((len(completed) / total) * 100) if total > 0 else 0
        
        return ConfigProgress(
            completed=completed,
            remaining=remaining,
            percentage=pct
        )
    
    def advance_step(self) -> bool:
        """Advance to the next configuration step. Returns True if advanced."""
        try:
            current_idx = CONFIG_STEP_ORDER.index(self.current_step)
            if current_idx < len(CONFIG_STEP_ORDER) - 1:
                self.current_step = CONFIG_STEP_ORDER[current_idx + 1]
                self.updated_at = datetime.utcnow()
                return True
        except ValueError:
            pass
        return False
    
    def go_back_step(self) -> bool:
        """Go back to the previous step. Returns True if went back."""
        try:
            current_idx = CONFIG_STEP_ORDER.index(self.current_step)
            if current_idx > 0:
                self.current_step = CONFIG_STEP_ORDER[current_idx - 1]
                self.updated_at = datetime.utcnow()
                return True
        except ValueError:
            pass
        return False
