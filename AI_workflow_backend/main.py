from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import google.generativeai as genai
import json
import os
import logging
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Agent Workflow Builder API - Arbitrum Sepolia Edition")

# Configure Google Gemini
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY not found in environment variables")

genai.configure(api_key=GEMINI_API_KEY)

class WorkflowRequest(BaseModel):
    user_query: str
    temperature: Optional[float] = 0.3
    max_tokens: Optional[int] = 2000

class ToolNode(BaseModel):
    id: str
    type: str
    name: str
    next_tools: List[str] = []

class WorkflowResponse(BaseModel):
    agent_id: str
    tools: List[ToolNode]
    has_sequential_execution: bool
    description: str
    raw_response: Optional[str] = None

# Available tools in the platform
AVAILABLE_TOOLS = [
    "transfer",
    "get_balance",
    "deploy_erc20",
    "deploy_erc721",
    "fetch_token_price"
]

SYSTEM_PROMPT = """You are an AI that converts natural language descriptions of blockchain agent workflows into structured JSON for the Arbitrum Sepolia blockchain.

Available tools:
- transfer: Transfer ETH or ERC-20 tokens between wallets
- get_balance: Fetch balance of ETH for a wallet
- deploy_erc20: Deploy ERC-20 tokens on Arbitrum Sepolia
- deploy_erc721: Deploy ERC-721 NFT tokens on Arbitrum Sepolia
- fetch_token_price: Get the current price of any token using AI-powered search

Your task is to analyze the user's request and create a workflow structure with:
1. An agent node (always present, id: "agent_1")
2. Tool nodes that the agent can use
3. Sequential connections when tools should execute in order
4. Parallel connections when tools are independent

Rules:
- The agent node always has id "agent_1" and type "agent"
- Each tool gets a unique id like "tool_1", "tool_2", etc.
- If tools should execute sequentially (one after another), set the next_tools field
- If tools are independent, they connect directly to the agent with empty next_tools
- Sequential execution examples: "deploy token then transfer", "check balance and then transfer"
- Parallel execution examples: "agent with multiple tools", "various tools available"
- IMPORTANT: Set has_sequential_execution to true if ANY tool has non-empty next_tools array
- IMPORTANT: Set has_sequential_execution to false ONLY if ALL tools have empty next_tools arrays

Return ONLY valid JSON matching this exact structure:
{
  "agent_id": "agent_1",
  "tools": [
    {
      "id": "tool_1",
      "type": "deploy_erc20",
      "name": "Token Deployment",
      "next_tools": ["tool_2"]
    },
    {
      "id": "tool_2",
      "type": "transfer",
      "name": "Transfer Tool",
      "next_tools": []
    }
  ],
  "has_sequential_execution": true,
  "description": "Brief description of the workflow"
}"""

@app.post("/create-workflow", response_model=WorkflowResponse)
async def create_workflow(request: WorkflowRequest):
    """
    Convert natural language workflow description to structured JSON using Google Gemini
    """
    try:
        logger.info(f"Processing workflow request: {request.user_query}")
        logger.info(f"Temperature: {request.temperature}, Max Tokens: {request.max_tokens}")
        
        # Initialize Gemini model with JSON output
        model = genai.GenerativeModel(
            model_name='gemini-2.0-flash-exp',
            generation_config={
                "temperature": request.temperature,
                "max_output_tokens": request.max_tokens,
                "response_mime_type": "application/json"
            }
        )
        
        # Prepare the prompt
        full_prompt = f"{SYSTEM_PROMPT}\n\nUser Query: {request.user_query}\n\nGenerate the workflow JSON:"
        
        # Generate response
        response = model.generate_content(full_prompt)
        raw_content = response.text
        
        logger.info(f"Raw Gemini Response: {raw_content}")
        
        # Parse the response
        workflow_data = json.loads(raw_content)
        workflow_data["raw_response"] = raw_content
        
        logger.info(f"Parsed workflow data: {json.dumps(workflow_data, indent=2)}")
        
        return WorkflowResponse(**workflow_data)
    
    except genai.types.GenerationError as e:
        logger.error(f"Gemini generation error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Gemini generation error: {str(e)}")
    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON response: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Invalid JSON response: {str(e)}")
    except Exception as e:
        logger.error(f"Error processing request: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error processing request: {str(e)}")

@app.get("/available-tools")
async def get_available_tools():
    """
    Get list of available tools in the platform
    """
    return {"tools": AVAILABLE_TOOLS}

@app.get("/health")
async def health_check():
    """
    Health check endpoint
    """
    return {
        "status": "healthy",
        "service": "Agent Workflow Builder",
        "blockchain": "Arbitrum Sepolia",
        "ai_model": "Google Gemini 2.0 Flash"
    }

# Example usage
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)