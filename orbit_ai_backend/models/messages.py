"""
API request/response message schemas.
"""
from typing import Optional
from pydantic import BaseModel, Field

from .conversation import ConfigProgress


class ChatRequest(BaseModel):
    """Request body for /api/orbit-ai/chat endpoint."""
    session_id: str = Field(..., description="Conversation session ID (UUID)")
    message: str = Field(..., min_length=1, description="User message")
    wallet_address: Optional[str] = Field(None, description="Connected wallet address")
    user_id: Optional[str] = Field(None, description="Privy user ID")


class ChatResponse(BaseModel):
    """Response from /api/orbit-ai/chat endpoint."""
    session_id: str
    message: str
    phase: str  # greeting, discovery, configuration, review, deploying, deployed
    current_step: Optional[str] = None
    config_progress: Optional[ConfigProgress] = None
    collected_params: Optional[dict] = None  # Live collected values for form
    config: Optional[dict] = None  # Full config when in review/deployed phase
    deployment: Optional[dict] = None  # Deployment info when deploying/deployed
    quick_actions: Optional[list[dict]] = None  # [{label, value}] for inline buttons


class SessionResponse(BaseModel):
    """Response from /api/orbit-ai/session/{id} endpoint."""
    session_id: str
    phase: str
    current_step: Optional[str] = None
    config_progress: Optional[ConfigProgress] = None
    config: Optional[dict] = None
    messages: list[dict] = Field(default_factory=list)


class DeployRequest(BaseModel):
    """Request body for /api/orbit-ai/deploy endpoint."""
    session_id: str
    config_id: Optional[str] = None  # Config ID if already saved


class DeployResponse(BaseModel):
    """Response from /api/orbit-ai/deploy endpoint."""
    deployment_id: str
    status: str  # started, in_progress, completed, failed
    message: str


class DeployStatusResponse(BaseModel):
    """Response from /api/orbit-ai/deploy/status/{id} endpoint."""
    deployment_id: str
    status: str
    progress: int = 0
    current_step: Optional[str] = None
    error: Optional[str] = None
    result: Optional[dict] = None  # Deployment result when completed


class PresetResponse(BaseModel):
    """A use-case preset configuration."""
    id: str
    name: str
    description: str
    icon: str  # emoji
    defaults: dict


class PresetsListResponse(BaseModel):
    """Response from /api/orbit-ai/presets endpoint."""
    presets: list[PresetResponse]


class HealthResponse(BaseModel):
    """Health check response."""
    status: str = "healthy"
    version: str = "1.0.0"
    service: str = "orbit-ai-backend"
