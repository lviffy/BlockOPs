"""
Orbit AI Backend — FastAPI application.

Multi-turn conversational AI for L3 chain configuration and deployment.
"""
import os
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import httpx
from dotenv import load_dotenv

from models.messages import (
    ChatRequest,
    ChatResponse,
    SessionResponse,
    DeployRequest,
    DeployResponse,
    DeployStatusResponse,
    PresetsListResponse,
    PresetResponse,
    HealthResponse,
)
from core.conversation import get_conversation_manager
from core.config_builder import get_config_builder
from utils.defaults import get_all_presets

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=getattr(logging, os.getenv("LOG_LEVEL", "INFO").upper()),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Backend URL for deployment proxy
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:3000")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup and shutdown."""
    logger.info("Starting Orbit AI Backend...")
    yield
    logger.info("Shutting down Orbit AI Backend...")


app = FastAPI(
    title="Orbit AI Backend",
    description="Conversational AI for Arbitrum Orbit L3 chain deployment",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================================
# Health Check
# ============================================================================

@app.get("/", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    return HealthResponse()


# ============================================================================
# Chat Endpoints
# ============================================================================

@app.post("/api/orbit-ai/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Main conversational endpoint. Maintains multi-turn context."""
    try:
        manager = get_conversation_manager()
        
        # Process the message
        session = await manager.process_message(
            session_id=request.session_id,
            user_message=request.message,
            wallet_address=request.wallet_address,
        )
        
        # Get the latest AI response
        last_message = session.messages[-1] if session.messages else None
        ai_response = last_message.content if last_message and last_message.role == "assistant" else ""
        
        # Build config if in review phase
        config_dict = None
        if session.phase.value in ["review", "deployed"]:
            builder = get_config_builder()
            config = builder.build_from_session(session)
            if config:
                config_dict = config.to_backend_format()
                session.config = config_dict
        
        return ChatResponse(
            session_id=session.session_id,
            message=ai_response,
            phase=session.phase.value,
            current_step=session.current_step.value,
            config_progress=session.get_progress(),
            collected_params=session.collected_params,
            config=config_dict,
            quick_actions=last_message.quick_actions if last_message else None,
        )
    
    except Exception as e:
        logger.error(f"Chat error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/orbit-ai/session/{session_id}", response_model=SessionResponse)
async def get_session(session_id: str):
    """Retrieve conversation history and current state."""
    manager = get_conversation_manager()
    session = manager.get_session(session_id)
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return SessionResponse(
        session_id=session.session_id,
        phase=session.phase.value,
        current_step=session.current_step.value,
        config_progress=session.get_progress(),
        config=session.config,
        messages=[
            {"id": m.id, "role": m.role, "content": m.content, "timestamp": m.timestamp.isoformat()}
            for m in session.messages
        ],
    )


@app.post("/api/orbit-ai/session/{session_id}/reset", response_model=SessionResponse)
async def reset_session(session_id: str):
    """Reset a conversation to start over."""
    manager = get_conversation_manager()
    session = manager.reset_session(session_id)
    
    return SessionResponse(
        session_id=session.session_id,
        phase=session.phase.value,
        current_step=session.current_step.value,
        config_progress=session.get_progress(),
        config=None,
        messages=[
            {"id": m.id, "role": m.role, "content": m.content, "timestamp": m.timestamp.isoformat()}
            for m in session.messages
        ],
    )


# ============================================================================
# Presets Endpoint
# ============================================================================

@app.get("/api/orbit-ai/presets", response_model=PresetsListResponse)
async def get_presets():
    """Returns use-case presets with recommended defaults."""
    presets = get_all_presets()
    return PresetsListResponse(
        presets=[
            PresetResponse(
                id=p["id"],
                name=p["name"],
                description=p["description"],
                icon=p["icon"],
                defaults=p["defaults"],
            )
            for p in presets
        ]
    )


# ============================================================================
# Deployment Endpoints (Proxy to Node.js Backend)
# ============================================================================

@app.post("/api/orbit-ai/deploy", response_model=DeployResponse)
async def deploy(request: DeployRequest):
    """Trigger deployment of a finalized configuration."""
    manager = get_conversation_manager()
    session = manager.get_session(request.session_id)
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if not session.config:
        # Try to build config
        builder = get_config_builder()
        config = builder.build_from_session(session)
        if not config:
            raise HTTPException(status_code=400, detail="Configuration not complete")
        session.config = config.to_backend_format()
    
    try:
        async with httpx.AsyncClient() as client:
            # First, save the config to the backend
            save_response = await client.post(
                f"{BACKEND_URL}/api/orbit/config",
                json=session.config,
                timeout=30.0,
            )
            
            if save_response.status_code != 201:
                raise HTTPException(
                    status_code=save_response.status_code,
                    detail=f"Failed to save config: {save_response.text}",
                )
            
            save_data = save_response.json()
            config_id = save_data.get("configId")
            
            # Then trigger deployment
            deploy_response = await client.post(
                f"{BACKEND_URL}/api/orbit/deploy",
                json={"configId": config_id},
                timeout=30.0,
            )
            
            if deploy_response.status_code != 200:
                raise HTTPException(
                    status_code=deploy_response.status_code,
                    detail=f"Failed to deploy: {deploy_response.text}",
                )
            
            deploy_data = deploy_response.json()
            deployment_id = deploy_data.get("deploymentId")
            
            # Update session
            session.deployment_id = deployment_id
            session.deployment_status = "started"
            
            return DeployResponse(
                deployment_id=deployment_id,
                status="started",
                message=f"Deployment initiated for {session.config.get('chainConfig', {}).get('chainName', 'your chain')}",
            )
    
    except httpx.HTTPError as e:
        logger.error(f"Backend connection error: {e}")
        raise HTTPException(status_code=503, detail=f"Backend unavailable: {str(e)}")


@app.get("/api/orbit-ai/deploy/status/{deployment_id}", response_model=DeployStatusResponse)
async def get_deployment_status(deployment_id: str):
    """Poll deployment progress (proxy to Node.js backend)."""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{BACKEND_URL}/api/orbit/deploy/status/{deployment_id}",
                timeout=30.0,
            )
            
            if response.status_code == 404:
                raise HTTPException(status_code=404, detail="Deployment not found")
            
            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Failed to get status: {response.text}",
                )
            
            data = response.json()
            
            return DeployStatusResponse(
                deployment_id=deployment_id,
                status=data.get("status", "unknown"),
                progress=data.get("progress", 0),
                current_step=data.get("currentStep"),
                error=data.get("error"),
                result=data.get("result"),
            )
    
    except httpx.HTTPError as e:
        logger.error(f"Backend connection error: {e}")
        raise HTTPException(status_code=503, detail=f"Backend unavailable: {str(e)}")


# ============================================================================
# Run with Uvicorn
# ============================================================================

if __name__ == "__main__":
    import uvicorn
    
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=True,
        log_level=os.getenv("LOG_LEVEL", "info").lower(),
    )
