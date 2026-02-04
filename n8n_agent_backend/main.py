from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import os
from dotenv import load_dotenv
import google.generativeai as genai
from groq import Groq
import json
import requests
import uvicorn

load_dotenv()

app = FastAPI(title="AI Agent Builder - Arbitrum Sepolia Edition")

# Add CORS middleware to allow requests from anywhere
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allow all methods
    allow_headers=["*"],  # Allow all headers
)

# Configure API Keys
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# Initialize clients
groq_client = None
if GROQ_API_KEY:
    groq_client = Groq(api_key=GROQ_API_KEY)
    print("✓ Groq client initialized (Primary)")

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    print("✓ Gemini configured (Fallback)")

if not GROQ_API_KEY and not GEMINI_API_KEY:
    raise ValueError("At least one of GROQ_API_KEY or GEMINI_API_KEY must be set")

# Backend URL - configurable via environment or defaults to localhost
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:3000")

# Tool Definitions
TOOL_DEFINITIONS = {
    "transfer": {
        "name": "transfer",
        "description": "Transfer tokens from one address to another. Requires privateKey, toAddress, amount, and optionally tokenId for ERC20 transfers (omit for native ETH).",
        "parameters": {
            "type": "object",
            "properties": {
                "privateKey": {"type": "string", "description": "Private key of the sender wallet"},
                "toAddress": {"type": "string", "description": "Recipient wallet address"},
                "amount": {"type": "string", "description": "Amount of tokens to transfer"},
                "tokenId": {"type": "string", "description": "Token ID from factory (optional, for ERC20 transfers only, omit for ETH)"}
            },
            "required": ["privateKey", "toAddress", "amount"]
        },
        "endpoint": f"{BACKEND_URL}/transfer",
        "method": "POST"
    },
    "get_balance": {
        "name": "get_balance",
        "description": "Get ETH balance of a wallet address. Requires only the wallet address.",
        "parameters": {
            "type": "object",
            "properties": {
                "address": {"type": "string", "description": "Wallet address to check balance"}
            },
            "required": ["address"]
        },
        "endpoint": f"{BACKEND_URL}/transfer/balance/{{address}}",
        "method": "GET"
    },
    "deploy_erc20": {
        "name": "deploy_erc20",
        "description": "Deploy a new ERC-20 token via Stylus TokenFactory. Returns a tokenId. Requires privateKey, name, symbol, and initialSupply. Optional: decimals (default 18).",
        "parameters": {
            "type": "object",
            "properties": {
                "privateKey": {"type": "string", "description": "Private key of the deployer wallet"},
                "name": {"type": "string", "description": "Token name"},
                "symbol": {"type": "string", "description": "Token symbol"},
                "initialSupply": {"type": "string", "description": "Initial token supply"},
                "decimals": {"type": "number", "description": "Token decimals (optional, default 18)"}
            },
            "required": ["privateKey", "name", "symbol", "initialSupply"]
        },
        "endpoint": f"{BACKEND_URL}/token/deploy",
        "method": "POST"
    },
    "deploy_erc721": {
        "name": "deploy_erc721",
        "description": "Deploy a new ERC-721 NFT collection via Stylus NFTFactory. Requires privateKey, name, symbol, and baseURI.",
        "parameters": {
            "type": "object",
            "properties": {
                "privateKey": {"type": "string", "description": "Private key of the deployer wallet"},
                "name": {"type": "string", "description": "NFT collection name"},
                "symbol": {"type": "string", "description": "NFT collection symbol"},
                "baseURI": {"type": "string", "description": "Base URI for token metadata (e.g., ipfs://...)"}
            },
            "required": ["privateKey", "name", "symbol", "baseURI"]
        },
        "endpoint": f"{BACKEND_URL}/nft/deploy-collection",
        "method": "POST"
    },
    "fetch_price": {
        "name": "fetch_price",
        "description": "Fetch the current price of any cryptocurrency. Supports queries like 'bitcoin', 'ethereum price', 'btc eth sol'. Returns real-time prices from CoinGecko API with 24h change, market cap, and volume data. If vsCurrency is not provided, it defaults to 'usd'.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Query string for cryptocurrency (e.g., 'bitcoin', 'ethereum price', 'btc eth sol')"},
                "vsCurrency": {"type": "string", "description": "Currency to show price in (e.g., 'usd', 'eur', 'inr'). Defaults to 'usd' if not provided."}
            },
            "required": ["query"]
        },
        "endpoint": f"{BACKEND_URL}/price/token",
        "method": "POST"
    },
    "get_token_info": {
        "name": "get_token_info",
        "description": "Get detailed information about a deployed token using its tokenId. Returns name, symbol, decimals, total supply, and creator.",
        "parameters": {
            "type": "object",
            "properties": {
                "tokenId": {"type": "string", "description": "The token ID returned from deployment"}
            },
            "required": ["tokenId"]
        },
        "endpoint": f"{BACKEND_URL}/token/info/{{tokenId}}",
        "method": "GET"
    },
    "get_token_balance": {
        "name": "get_token_balance",
        "description": "Get token balance for a specific address. Requires tokenId and ownerAddress.",
        "parameters": {
            "type": "object",
            "properties": {
                "tokenId": {"type": "string", "description": "The token ID"},
                "ownerAddress": {"type": "string", "description": "Wallet address to check balance"}
            },
            "required": ["tokenId", "ownerAddress"]
        },
        "endpoint": f"{BACKEND_URL}/token/balance/{{tokenId}}/{{ownerAddress}}",
        "method": "GET"
    },
    "mint_nft": {
        "name": "mint_nft",
        "description": "Mint a new NFT in an existing collection. Requires privateKey, collectionAddress, and toAddress.",
        "parameters": {
            "type": "object",
            "properties": {
                "privateKey": {"type": "string", "description": "Private key of the collection creator"},
                "collectionAddress": {"type": "string", "description": "NFT collection contract address"},
                "toAddress": {"type": "string", "description": "Recipient wallet address"}
            },
            "required": ["privateKey", "collectionAddress", "toAddress"]
        },
        "endpoint": f"{BACKEND_URL}/nft/mint",
        "method": "POST"
    },
    "get_nft_info": {
        "name": "get_nft_info",
        "description": "Get information about a specific NFT. Requires collectionAddress and tokenId.",
        "parameters": {
            "type": "object",
            "properties": {
                "collectionAddress": {"type": "string", "description": "NFT collection contract address"},
                "tokenId": {"type": "string", "description": "Token ID within the collection"}
            },
            "required": ["collectionAddress", "tokenId"]
        },
        "endpoint": f"{BACKEND_URL}/nft/info/{{collectionAddress}}/{{tokenId}}",
        "method": "GET"
    }
}

# Pydantic Models
class ToolConnection(BaseModel):
    tool: str
    next_tool: Optional[str] = None

class AgentRequest(BaseModel):
    tools: List[ToolConnection]
    user_message: str
    private_key: Optional[str] = None

class AgentResponse(BaseModel):
    agent_response: str
    tool_calls: List[Dict[str, Any]]
    results: List[Dict[str, Any]]

# Helper Functions
def convert_to_gemini_tools(tool_names: List[str]) -> List[Dict[str, Any]]:
    """Convert tool definitions to Gemini function declaration format"""
    function_declarations = []
    
    for tool_name in tool_names:
        if tool_name in TOOL_DEFINITIONS:
            tool_def = TOOL_DEFINITIONS[tool_name]
            
            # Deep copy to avoid modifying original
            import copy
            parameters = copy.deepcopy(tool_def["parameters"])
            
            # Convert types to uppercase for Gemini (STRING, NUMBER, OBJECT, etc.)
            if "type" in parameters:
                parameters["type"] = parameters["type"].upper()
            
            if "properties" in parameters:
                for prop_name, prop_def in parameters["properties"].items():
                    if "type" in prop_def:
                        prop_def["type"] = prop_def["type"].upper()
            
            function_declarations.append({
                "name": tool_def["name"],
                "description": tool_def["description"],
                "parameters": parameters
            })
            
    return function_declarations

def build_system_prompt(tool_connections: List[ToolConnection]) -> str:
    """Build a dynamic system prompt based on connected tools"""
    
    # Extract unique tools
    unique_tools = set()
    tool_flow = {}
    
    for conn in tool_connections:
        unique_tools.add(conn.tool)
        if conn.next_tool:
            unique_tools.add(conn.next_tool)
            tool_flow[conn.tool] = conn.next_tool
    
    # Check if sequential execution exists
    has_sequential = any(conn.next_tool for conn in tool_connections)
    
    system_prompt = """You are an AI agent for the Somnia blockchain platform. You help users perform blockchain operations using the tools available to you.

AVAILABLE TOOLS:
"""
    
    for tool_name in unique_tools:
        if tool_name in TOOL_DEFINITIONS:
            tool_def = TOOL_DEFINITIONS[tool_name]
            system_prompt += f"\n- {tool_name}: {tool_def['description']}\n"
    
    if has_sequential:
        system_prompt += "\n\nTOOL EXECUTION FLOW:\n"
        system_prompt += "Some tools are connected in sequence. You MUST execute them in the specified order:\n"
        for tool, next_tool in tool_flow.items():
            system_prompt += f"- After {tool} completes, YOU MUST IMMEDIATELY call {next_tool}\n"
        
        system_prompt += """
SEQUENTIAL EXECUTION INSTRUCTIONS - CRITICAL:
1. When tools are connected sequentially, you MUST execute ALL tools in the chain
2. After completing one tool, IMMEDIATELY proceed to call the next tool in the sequence
3. DO NOT wait for user confirmation between sequential tool calls
4. Execute all sequential tools in ONE conversation turn
5. Only provide a final summary after ALL sequential tools have been completed
6. If you have all the required parameters for the entire sequence, execute all tools immediately
"""
    else:
        system_prompt += """
INSTRUCTIONS:
1. You can perform any of the available operations based on user requests
2. Ask for required parameters if not provided
3. Execute the appropriate tool based on user needs
4. Provide clear results and next steps
"""
    
    system_prompt += """
IMPORTANT RULES:
- Only use the tools that are available to you
- If ALL required parameters are provided (either in the user message or in the context), execute the tool IMMEDIATELY without asking for confirmation
- ONLY ask for parameters that are missing or unclear - DO NOT ask for confirmation if you have all required information
- If a privateKey is needed and provided in the context, use it automatically
- Be conversational and helpful
- Provide transaction hashes and explorer links when available
- Explain what each operation does in simple terms
- For sequential executions, complete the ENTIRE chain before responding
- DO NOT ask "Do you want to proceed?" if you have all the required parameters
"""
    
    return system_prompt

def execute_tool(tool_name: str, parameters: Dict[str, Any]) -> Dict[str, Any]:
    """Execute a tool by calling its API endpoint"""
    
    if tool_name not in TOOL_DEFINITIONS:
        raise ValueError(f"Unknown tool: {tool_name}")
    
    tool_def = TOOL_DEFINITIONS[tool_name]
    endpoint = tool_def["endpoint"]
    method = tool_def["method"]
    
    # Handle URL parameters for GET requests
    url_params_to_replace = {
        "{address}": "address",
        "{tokenId}": "tokenId",
        "{ownerAddress}": "ownerAddress",
        "{collectionAddress}": "collectionAddress"
    }
    
    params_for_request = parameters.copy()
    
    # Replace URL parameters
    for placeholder, param_name in url_params_to_replace.items():
        if placeholder in endpoint and param_name in params_for_request:
            endpoint = endpoint.replace(placeholder, str(params_for_request[param_name]))
            del params_for_request[param_name]
    
    # Prepare headers - check if Bearer token is needed
    headers = {}
    if "api.subgraph.somnia.network" in endpoint:
        bearer_token = os.getenv("SOMNIA_BEARER_TOKEN")
        if bearer_token:
            headers["Authorization"] = f"Bearer {bearer_token}"
    
    try:
        if method == "POST":
            response = requests.post(endpoint, json=params_for_request, headers=headers, timeout=60)
        elif method == "GET":
            response = requests.get(endpoint, headers=headers, timeout=60)
        else:
            raise ValueError(f"Unsupported HTTP method: {method}")
        
        response.raise_for_status()
        return {
            "success": True,
            "tool": tool_name,
            "result": response.json()
        }
    except requests.exceptions.RequestException as e:
        return {
            "success": False,
            "tool": tool_name,
            "error": str(e)
        }

def get_openai_tools(tool_names: List[str]) -> List[Dict[str, Any]]:
    """Convert tool definitions to OpenAI function calling format"""
    
    tools = []
    for tool_name in tool_names:
        if tool_name in TOOL_DEFINITIONS:
            tool_def = TOOL_DEFINITIONS[tool_name]
            tools.append({
                "type": "function",
                "function": {
                    "name": tool_def["name"],
                    "description": tool_def["description"],
                    "parameters": tool_def["parameters"]
                }
            })
    
    return tools

def process_agent_conversation(
    system_prompt: str,
    user_message: str,
    available_tools: List[str],
    tool_flow: Dict[str, str],
    private_key: Optional[str] = None,
    max_iterations: int = 10
) -> Dict[str, Any]:
    """
    Process the conversation with the AI agent
    Primary: Groq (llama-3.3-70b-versatile) with tool use
    Fallback: Google Gemini
    """
    
    # Add private key context if available
    if private_key:
        system_prompt += f"\n\nCONTEXT: User's private key is available: {private_key}"
    
    all_tool_calls = []
    all_tool_results = []
    iteration = 0
    
    # Build OpenAI-compatible tools for Groq
    openai_tools = get_openai_tools(available_tools)
    
    # Try Groq first (Primary)
    if groq_client:
        try:
            print("Attempting Groq API (Primary)...")
            
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ]
            
            while iteration < max_iterations:
                iteration += 1
                
                groq_response = groq_client.chat.completions.create(
                    model="llama-3.3-70b-versatile",
                    messages=messages,
                    tools=openai_tools if openai_tools else None,
                    tool_choice="auto" if openai_tools else None,
                    temperature=0.7,
                    max_tokens=4096
                )
                
                response_message = groq_response.choices[0].message
                
                # Check if there are tool calls
                if response_message.tool_calls:
                    messages.append(response_message)
                    
                    for tool_call in response_message.tool_calls:
                        function_name = tool_call.function.name
                        function_args = json.loads(tool_call.function.arguments)
                        
                        # Add private key if needed and available
                        if private_key and function_name in TOOL_DEFINITIONS:
                            tool_params = TOOL_DEFINITIONS[function_name]["parameters"]["properties"]
                            if "privateKey" in tool_params and "privateKey" not in function_args:
                                function_args["privateKey"] = private_key
                        
                        all_tool_calls.append({
                            "tool": function_name,
                            "parameters": function_args
                        })
                        
                        # Execute the tool
                        result = execute_tool(function_name, function_args)
                        all_tool_results.append(result)
                        
                        # Add tool result to messages
                        messages.append({
                            "role": "tool",
                            "tool_call_id": tool_call.id,
                            "content": json.dumps(result)
                        })
                        
                        # Check if we need to continue with sequential tools
                        if function_name in tool_flow:
                            next_tool = tool_flow[function_name]
                            messages.append({
                                "role": "user",
                                "content": f"Now immediately call the {next_tool} tool as it is next in the sequential flow."
                            })
                else:
                    # No tool calls, return final response
                    return {
                        "agent_response": response_message.content,
                        "tool_calls": all_tool_calls,
                        "results": all_tool_results,
                        "conversation_history": [],
                        "provider": "Groq (llama-3.3-70b-versatile)"
                    }
            
            # Max iterations reached with Groq
            return {
                "agent_response": "Maximum iterations reached. Please try again with a simpler request.",
                "tool_calls": all_tool_calls,
                "results": all_tool_results,
                "conversation_history": [],
                "provider": "Groq (llama-3.3-70b-versatile)"
            }
            
        except Exception as groq_error:
            print(f"Groq API failed: {str(groq_error)}, falling back to Gemini...")
            # Reset for Gemini fallback
            all_tool_calls = []
            all_tool_results = []
            iteration = 0
    
    # Fallback to Gemini
    if GEMINI_API_KEY:
        print("Attempting Gemini API (Fallback)...")
        
        # Build function declarations for Gemini
        function_declarations = convert_to_gemini_tools(available_tools)

        # Initialize Gemini model with fallback chain
        model_names = [
            'gemini-2.0-flash',
            'gemini-1.5-flash-002',
            'gemini-1.5-flash-001',
            'gemini-1.5-flash'
        ]
        model = None
        chat = None
        last_error = None

        tools_configuration = [{"function_declarations": function_declarations}] if function_declarations else None

        for name in model_names:
            try:
                print(f"Attempting to initialize Gemini model: {name}")
                model = genai.GenerativeModel(
                    model_name=name,
                    tools=tools_configuration,
                    generation_config={
                        "temperature": 0.7,
                        "top_p": 0.8,
                        "top_k": 40,
                    }
                )
                chat = model.start_chat(history=[])
                print(f"Successfully initialized Gemini model: {name}")
                break
            except Exception as e:
                print(f"Failed to initialize {name}: {str(e)}")
                last_error = e
                continue
        
        if not model:
            try:
                print("All Flash models failed. Falling back to Gemini 1.5 Pro...")
                model = genai.GenerativeModel(
                    model_name='gemini-1.5-pro',
                    tools=tools_configuration,
                    generation_config={
                        "temperature": 0.7,
                        "top_p": 0.8,
                        "top_k": 40,
                    }
                )
                chat = model.start_chat(history=[])
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"All AI providers failed. Last error: {str(last_error)}")
        
        full_prompt = f"{system_prompt}\n\nUser: {user_message}"
        
        while iteration < max_iterations:
            iteration += 1
            
            try:
                response = chat.send_message(full_prompt)
            except Exception as e:
                if "429" in str(e):
                    return {
                        "agent_response": "Rate limit exceeded. Please try again in a few moments.",
                        "tool_calls": all_tool_calls,
                        "results": all_tool_results,
                        "conversation_history": [],
                        "provider": "Gemini (rate limited)"
                    }
                raise e
            
            function_calls = []
            if response.candidates and response.candidates[0].content.parts:
                for part in response.candidates[0].content.parts:
                    if hasattr(part, 'function_call') and part.function_call:
                        function_calls.append(part.function_call)
            
            if not function_calls:
                return {
                    "agent_response": response.text,
                    "tool_calls": all_tool_calls,
                    "results": all_tool_results,
                    "conversation_history": [],
                    "provider": "Gemini (fallback)"
                }
            
            for function_call in function_calls:
                function_name = function_call.name
                function_args = dict(function_call.args)
                
                if private_key and function_name in TOOL_DEFINITIONS:
                    tool_params = TOOL_DEFINITIONS[function_name]["parameters"]["properties"]
                    if "privateKey" in tool_params and "privateKey" not in function_args:
                        function_args["privateKey"] = private_key
                
                all_tool_calls.append({
                    "tool": function_name,
                    "parameters": function_args
                })
                
                result = execute_tool(function_name, function_args)
                all_tool_results.append(result)
                
                full_prompt = f"Function {function_name} returned: {json.dumps(result)}"
            
            if all_tool_calls:
                last_tool_executed = all_tool_calls[-1]["tool"]
                if last_tool_executed in tool_flow:
                    next_tool = tool_flow[last_tool_executed]
                    full_prompt += f"\n\nIMPORTANT: You must now immediately call the {next_tool} tool as it is next in the sequential flow."
        
        return {
            "agent_response": "Maximum iterations reached. Please try again with a simpler request.",
            "tool_calls": all_tool_calls,
            "results": all_tool_results,
            "conversation_history": [],
            "provider": "Gemini (fallback)"
        }
    
    raise HTTPException(status_code=500, detail="No AI provider available")

# API Endpoints
@app.post("/agent/chat", response_model=AgentResponse)
async def chat_with_agent(request: AgentRequest):
    """
    Main endpoint to interact with the AI agent.
    Dynamically configures the agent based on tool connections.
    """
    
    try:
        # Extract unique tools and build flow map
        unique_tools = set()
        tool_flow = {}
        
        for conn in request.tools:
            unique_tools.add(conn.tool)
            if conn.next_tool:
                unique_tools.add(conn.next_tool)
                tool_flow[conn.tool] = conn.next_tool
        
        available_tools = list(unique_tools)
        
        # Validate tools
        for tool in available_tools:
            if tool not in TOOL_DEFINITIONS:
                raise HTTPException(status_code=400, detail=f"Unknown tool: {tool}")
        
        # Build system prompt
        system_prompt = build_system_prompt(request.tools)
        
        # Process conversation with sequential support
        result = process_agent_conversation(
            system_prompt=system_prompt,
            user_message=request.user_message,
            available_tools=available_tools,
            tool_flow=tool_flow,
            private_key=request.private_key
        )
        
        return AgentResponse(
            agent_response=result["agent_response"],
            tool_calls=result["tool_calls"],
            results=result["results"]
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "AI Agent Builder",
        "blockchain": "Arbitrum Sepolia",
        "ai_providers": {
            "primary": "Groq (llama-3.3-70b-versatile)" if GROQ_API_KEY else "Not configured",
            "fallback": "Google Gemini 2.0 Flash" if GEMINI_API_KEY else "Not configured"
        },
        "backend_url": BACKEND_URL
    }

@app.get("/tools")
async def list_tools():
    """List all available tools"""
    return {
        "tools": list(TOOL_DEFINITIONS.keys()),
        "details": TOOL_DEFINITIONS
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)