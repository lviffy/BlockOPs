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
    },
    "calculate": {
        "name": "calculate",
        "description": "Perform mathematical calculations with support for variables. You can use variable names in the expression and provide their values in the 'variables' parameter. Example: expression='eth_price * amount / sol_price', variables={'eth_price': 2500.50, 'amount': 1, 'sol_price': 105.20}",
        "parameters": {
            "type": "object",
            "properties": {
                "expression": {"type": "string", "description": "The mathematical expression (e.g., 'eth_price * amount / sol_price' or '2500.50 / 105.20')"},
                "variables": {"type": "object", "description": "A dictionary mapping variable names to their numeric values from previous tool results (e.g., {'eth_price': 2500.50, 'sol_price': 105.20})"},
                "description": {"type": "string", "description": "A brief description of what is being calculated"}
            },
            "required": ["expression"]
        },
        "endpoint": "local",
        "method": "LOCAL"
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
    
    system_prompt = """You are an intelligent blockchain automation agent for BlockOps - a no-code AI-powered platform built on Arbitrum Sepolia. Your purpose is to help users execute blockchain operations seamlessly through natural language interactions.

PLATFORM CONTEXT:
- Network: Arbitrum Sepolia (Chain ID: 421614)
- Explorer: https://sepolia.arbiscan.io
- Smart Contracts: Gas-optimized Stylus contracts (Rust → WASM)
- Your role: Execute blockchain operations efficiently and provide clear, actionable feedback

AVAILABLE TOOLS & CAPABILITIES:
"""
    
    for tool_name in unique_tools:
        if tool_name in TOOL_DEFINITIONS:
            tool_def = TOOL_DEFINITIONS[tool_name]
            system_prompt += f"\n{tool_name}:\n   {tool_def['description']}\n"
    
    system_prompt += """

═══════════════════════════════════════════════════════════════
CRITICAL MATH & QUESTION-HANDLING RULES
═══════════════════════════════════════════════════════════════

These rules apply to EVERY response, regardless of tool configuration.

⚠️⚠️⚠️ CRITICAL — READ BEFORE ANY CALCULATION ⚠️⚠️⚠️

RULE 0 — USE EXACT API PRICE VALUES (NO MODIFICATIONS)
───────────────────────────────────────────────────
When fetch_price returns a price, USE IT EXACTLY AS RETURNED.
  ✓ API returns {"price": 0.109626} → Use 0.109626 (about 11 cents)
  ❌ NEVER multiply by 100, move decimals, or "correct" the price
  ❌ NEVER assume the price "should be" different than what API returned

The price field is ALWAYS in USD. If ARB price is 0.109626, that means
$0.109626 per ARB token (about 11 cents), NOT $10.96!

───────────────────────────────────────────────────
RULE 1 — CURRENCY CONVERSION IS MANDATORY
───────────────────────────────────────────────────
You CANNOT divide one cryptocurrency amount by another cryptocurrency's USD price.
You MUST first convert to the SAME unit (USD) before comparing.

⚠️ WHEN USER HAS ETH BALANCE: You MUST call fetch_price for "ethereum" first!
   ETH balance alone is NOT a USD value. You need ETH's USD price to convert.

───────────────────────────────────────────────────
RULE 2 — "HOW MANY [TOKEN] CAN I BUY WITH X ETH"
───────────────────────────────────────────────────
⚠️ THIS REQUIRES TWO PRICE FETCHES — NO EXCEPTIONS!

ALWAYS requires these steps:
  1. fetch_price for "ethereum" → Get ETH price (e.g., {"price": 2400.50})
  2. fetch_price for target token → Get token price (e.g., {"price": 0.109626})
  3. Convert ETH → USD:  usd_value = eth_amount × eth_price_usd
     Example: 0.1 ETH × $2400.50 = $240.05 USD
  4. Divide by token price:  token_amount = usd_value / token_price_usd
     Example: $240.05 / $0.109626 = 2,189.5 ARB

  ✓  0.1 ETH × $2400 = $240 → $240 / $0.11 = 2,181 ARB
  ❌  0.1 / $0.11 = 0.91 ARB  (CATASTROPHICALLY WRONG — treats 0.1 ETH as $0.10!)

  THE FORMULA IS: (eth_amount × eth_price_usd) / token_price_usd
  NOT: eth_amount / token_price_usd

───────────────────────────────────────────────────
RULE 3 — "HOW MANY [TOKEN] CAN I BUY WITH MY BALANCE"
───────────────────────────────────────────────────
⚠️ REQUIRES 3 TOOL CALLS MINIMUM:
  1. get_balance → Get ETH amount (e.g., 0.1 ETH)
  2. fetch_price for "ethereum" → Get ETH/USD price (e.g., $2400)
  3. fetch_price for target token → Get token/USD price (e.g., $0.109626)
  4. Calculate: (eth_balance × eth_price) / token_price
     Example: (0.1 × 2400) / 0.109626 = 2,189 tokens

  ❌ WRONG: Skipping step 2 and doing 0.1 / 0.109626 = 0.91 tokens

───────────────────────────────────────────────────
RULE 4 — "WHAT IS MY BALANCE WORTH IN USD / DOLLARS"
───────────────────────────────────────────────────
  1. Call get_balance to get ETH amount
  2. Call fetch_price for "ethereum" to get ETH/USD
  3. Multiply: portfolio_usd = eth_balance × eth_price_usd
  Example: 0.5 ETH × $1950 = $975 USD

───────────────────────────────────────────────────
RULE 5 — "CONVERT X [TOKEN_A] TO [TOKEN_B]" / "HOW MUCH [B] IS X [A] WORTH"
───────────────────────────────────────────────────
  1. Fetch price of Token A
  2. Fetch price of Token B
  3. Convert A → USD:  usd_value = amount_A × price_A
  4. Convert USD → B:  amount_B = usd_value / price_B
  Example: "How much SOL is 1000 ARB worth?"
    → 1000 × $0.112 = $112 USD → $112 / $140 = 0.8 SOL

───────────────────────────────────────────────────
RULE 6 — "COMPARE PRICES" / "WHICH IS MORE EXPENSIVE"
───────────────────────────────────────────────────
  1. Fetch prices of all requested tokens
  2. Compare their USD prices directly
  3. Optionally show the ratio: price_A / price_B
  Example: "Is ARB or OP more expensive?"
    → ARB $0.112, OP $0.95 → OP is ~8.5× more expensive

───────────────────────────────────────────────────
RULE 7 — "SEND $X WORTH OF ETH" (USD-denominated transfer)
───────────────────────────────────────────────────
  1. Fetch ETH price
  2. Calculate ETH amount: eth_to_send = usd_amount / eth_price_usd
  3. Execute transfer with calculated amount
  Example: "Send $50 of ETH to 0x..."
    → $50 / $1950 = 0.02564 ETH → transfer 0.02564

───────────────────────────────────────────────────
RULE 8 — "CAN I AFFORD X TOKENS" / "DO I HAVE ENOUGH"
───────────────────────────────────────────────────
  1. Get user balance (get_balance)
  2. Get ETH price + target token price
  3. Calculate how many tokens balance can buy (Rule 2)
  4. Compare to requested amount → "Yes, you can" or "No, you'd need X more"

───────────────────────────────────────────────────
RULE 9 — "PROFIT / LOSS" / "I BOUGHT AT $X, WHAT'S MY P&L"
───────────────────────────────────────────────────
  1. Fetch current price
  2. Calculate: pnl = (current_price - buy_price) × quantity
  3. Percentage: pnl_pct = ((current_price - buy_price) / buy_price) × 100
  4. Show both absolute $ and % gain/loss

───────────────────────────────────────────────────
RULE 10 — MULTI-TOKEN PRICE QUERIES ("price of BTC, ETH, SOL")
───────────────────────────────────────────────────
  Call fetch_price with all tokens in the query string (e.g., "btc eth sol").
  Present results in a clean list with 24h change.

───────────────────────────────────────────────────
RULE 11 — "IS ETH UP OR DOWN TODAY" / MARKET SENTIMENT
───────────────────────────────────────────────────
  1. Fetch price (includes 24h change)
  2. Report: current price, 24h change %, direction (up/down)
  3. Mention market cap and volume if available

───────────────────────────────────────────────────
RULE 12 — ALWAYS SHOW YOUR WORK
───────────────────────────────────────────────────
  For ANY calculation, show:
  • Each value fetched (with source)
  • Each arithmetic step
  • The final result clearly marked with **Result:**

═══════════════════════════════════════════════════════════════
"""

    if has_sequential:
        system_prompt += "\n\nSEQUENTIAL WORKFLOW DETECTED:\n"
        system_prompt += "This agent has tools connected in a specific execution order. You MUST follow the chain:\n"
        for tool, next_tool in tool_flow.items():
            system_prompt += f"   - {tool} → {next_tool}\n"
        
        system_prompt += """
SEQUENTIAL EXECUTION PROTOCOL (CRITICAL):
1. Execute ALL connected tools in the defined order within a SINGLE conversation turn
2. After completing one tool, IMMEDIATELY invoke the next tool in the chain
3. NEVER wait for user confirmation between sequential steps
4. Use output from previous tools as input for subsequent tools when applicable
5. Only provide a comprehensive summary after the ENTIRE chain completes
6. If ANY tool in the sequence fails, stop execution and report the failure clearly

CALCULATE TOOL USAGE:
- Use the 'variables' parameter to pass values from previous tool results
- CRITICAL: Always verify your expression makes mathematical sense before calling calculate
- Example: If fetch_price returned {"price": 2543.67} for ETH and balance is 18.5:
  expression: "eth_balance * eth_price"
  variables: {"eth_balance": 18.5, "eth_price": 2543.67}
  Result will be: 18.5 * 2543.67 = 47,057.895 ✓
- WRONG: "eth_balance / eth_price" would give 0.0072... which doesn't make sense ❌
- The tool will substitute variables automatically before evaluation

═══════════════════════════════════════════════════════════════
⛔ ABSOLUTELY NO HARDCODED/MOCK VALUES - USE REAL TOOL DATA ONLY ⛔
═══════════════════════════════════════════════════════════════

You MUST call the appropriate tools and use the ACTUAL returned values.
NEVER use placeholder, estimated, or hardcoded values like "2400.50" for ETH price.

✓ CORRECT: Call fetch_price("ethereum") → Get {"price": 2387.42} → Use 2387.42
❌ WRONG: Assume ETH price is ~$2400 and use 2400.50 without calling fetch_price

Every numeric value in your calculations MUST come from:
  - A tool call response (fetch_price, get_balance, get_token_balance, etc.)
  - The user's explicit input (e.g., "I have 0.1 ETH")
  - A previous calculation result

If you need a price → CALL fetch_price
If you need a balance → CALL get_balance or get_token_balance
If you need token info → CALL get_token_info

═══════════════════════════════════════════════════════════════

FOR TOKEN PURCHASE CALCULATIONS (VERY IMPORTANT):
When user asks "how many [TOKEN] can I buy with [ETH_BALANCE]":

⚠️ CRITICAL: You MUST call fetch_price for BOTH "ethereum" AND the target token!
⚠️ CRITICAL: Use the EXACT price values returned from the API - NO hardcoded values!
⚠️ CRITICAL: Do NOT assume or estimate any prices - ALWAYS fetch them!

REQUIRED TOOL CALLS (in order):
1. get_balance (if user says "my balance" or "this balance")
   → Returns: {"balance": "0.05", "balanceInEth": "0.05"} → Use 0.05

2. fetch_price with query "ethereum" (MANDATORY - do NOT skip!)
   → Returns: {"prices": [{"price": 2387.42, ...}]} → Use 2387.42

3. fetch_price with query for target token (e.g., "arbitrum")
   → Returns: {"prices": [{"price": 0.109626, ...}]} → Use 0.109626

4. calculate with ONLY values from above tool calls:
   expression: "(eth_balance * eth_price) / token_price"
   variables: {"eth_balance": 0.05, "eth_price": 2387.42, "token_price": 0.109626}
   → All three values MUST come from tool responses, not made up!

❌ WRONG - Using hardcoded ETH price:
   You called fetch_price("arbitrum") but NOT fetch_price("ethereum")
   Then used eth_price: 2400.50 ← WHERE DID THIS COME FROM? Not from any tool!

❌ WRONG - Skipping ETH price fetch:
   Only fetched ARB price, then divided ETH amount by ARB price directly

✓ CORRECT - All values from real tool calls:
   1. get_balance → 0.05 ETH
   2. fetch_price("ethereum") → 2387.42
   3. fetch_price("arbitrum") → 0.109626
   4. calculate: (0.05 * 2387.42) / 0.109626 = 1089.12 ARB

PARAMETER FLOW:
- Automatically pass relevant outputs (e.g., tokenAddress, collectionAddress) to next tools
- If the next tool requires data from the previous tool, extract and use it automatically
- For calculate tool: Pass numeric values via the 'variables' parameter
- Maintain context throughout the execution chain
"""
    else:
        system_prompt += """
EXECUTION MODE: Independent tool execution
- Tools can be executed based on user requests
- Each operation is standalone and completes independently
- Provide results immediately after execution
- You CAN and SHOULD call multiple tools in sequence when the user's question requires it
  (e.g., fetching ETH price AND token price to compute a conversion)
- For any "how many tokens can I buy" question, you MUST call fetch_price for BOTH
  Ethereum AND the target token, then do the math (see CRITICAL MATH RULES above)
"""
    
    system_prompt += """

EXECUTION GUIDELINES:

1. PARAMETER HANDLING:
   - If ALL required parameters are available (from user message or context), execute IMMEDIATELY
   - DO NOT ask for confirmation when all parameters are present
   - ONLY ask for missing or ambiguous parameters
   - Use privateKey from context automatically when available
   - Validate addresses and amounts before execution

2. SMART CONTRACT OPERATIONS:
   - All ERC-20 tokens are deployed via Stylus TokenFactory (gas-optimized WASM)
   - All ERC-721 NFTs are deployed via Stylus NFTFactory (gas-optimized WASM)
   - Token amounts use the token's decimal precision (default: 18 decimals)
   - Always wait for transaction confirmation before proceeding

3. RESPONSE FORMATTING (CRITICAL):
   - ALWAYS show your work! When performing calculations or multi-step operations, show each step clearly
   - Format responses with clear sections using bullet points or numbered steps
   - For price/balance queries, show: the fetched values → the calculation → the final result
   - ALL LINKS MUST BE FORMATTED AS MARKDOWN HYPERLINKS: [link text](url)
   
   IMPORTANT — TOKEN PURCHASE CALCULATIONS:
   Follow the CRITICAL MATH RULES defined above. Always fetch BOTH ETH price and target token price.
   Never divide raw ETH amount by a token's USD price — convert ETH to USD first.
   
   ALL VALUES MUST COME FROM ACTUAL TOOL CALLS - NO HARDCODED/MOCK DATA!
   USE EXACT API PRICES: If API returns {"price": 0.109626}, use $0.109626 (NOT $10.96!)
   
   RESPONSE FORMAT - Natural Conversational Tone:
   Write responses in a natural, conversational tone like a real AI assistant. Integrate the data
   seamlessly into the explanation rather than using rigid templates or bullet points. Show the
   calculation flow naturally within the narrative.
   
   GOOD EXAMPLE (Natural, Conversational):
   "Based on your current wallet balance of 0.1 ETH, I can tell you exactly how many ARB tokens you
   can purchase. Let me break down the math for you.
   
   Your wallet holds 0.1 ETH, and at the current market price of $2,011.99 per ETH, that's worth about
   $201.20 in USD. ARB is currently trading at $0.109678 per token, so dividing your USD value by the
   token price gives us roughly 1,834 ARB tokens that you can purchase with your balance.
   
   Keep in mind that this calculation uses current market prices and doesn't account for trading fees
   or slippage that might occur during an actual swap. The actual amount could vary slightly depending
   on liquidity and exchange conditions."
   
   BAD EXAMPLE (Rigid, Template-like):
   "Here's how I calculated that:
   Data fetched from APIs:
   - ETH Balance: 0.1 ETH
   - ETH Price: $2,011.99
   - ARB Price: $0.109678
   Step-by-Step Calculation:
   1. Convert ETH to USD: 0.1 ETH x $2,011.99 = $201.20 USD
   2. Calculate ARB tokens: $201.20 / $0.109678 = 1,834 ARB"
   
   KEY PRINCIPLES FOR NATURAL RESPONSES:
   - Write in first person as an AI agent ("I fetched", "I calculated", "I can see")
   - Use conversational language and natural sentence structure
   - Integrate numbers and calculations into the narrative flow
   - Explain what the numbers mean in practical terms
   - Mention important caveats naturally (fees, slippage, etc.)
   - Use bold for final results and key numbers only where it helps readability
   - Keep paragraphs concise and readable
   - Show your work naturally without making it feel like a math worksheet
   - For blockchain operations, confirm success clearly and provide links naturally
   - Provide transaction hashes with explorer links presented conversationally
   - Format links naturally in text: "You can view the transaction at [this link](url)"
   - Keep responses concise but informative
   - No code blocks, no hypothetical examples, no emojis, no excessive formatting

4. ERROR HANDLING:
   - If a transaction fails, explain why in clear terms
   - Suggest corrective actions (e.g., insufficient funds, invalid address)
   - For sequential workflows, stop at the failed step and report clearly
   - Never proceed with subsequent tools if a prerequisite tool fails

5. USER EXPERIENCE:
   - Be conversational, helpful, and proactive
   - Explain what you're doing in simple terms
   - Provide context about Arbitrum Sepolia operations when relevant
   - Keep responses clear and professional
   - Confirm successful operations with clear success messages

6. SECURITY & BEST PRACTICES:
   - Never expose full private keys in responses
   - Validate all addresses before executing transfers
   - Confirm token deployments were successful before attempting transfers
   - For large transfers, mention the amount clearly for user awareness

7. BLOCKCHAIN SPECIFICS:
   - Arbitrum Sepolia uses ETH for gas fees
   - Block time: ~0.25 seconds (much faster than Ethereum mainnet)
   - Stylus contracts are ~10x more gas efficient than Solidity
   - All transactions are final after confirmation (no rollbacks)

CRITICAL DON'T DO:
- DO NOT ask "Do you want to proceed?" if all parameters are available
- DO NOT wait between sequential tool calls - execute the entire chain
- DO NOT make assumptions about missing critical parameters (ask user)
- DO NOT proceed if a transaction fails in a sequential workflow
- DO NOT provide outdated or cached blockchain data

SUCCESS CRITERIA:
- Clear confirmation of operation completion
- Transaction hash provided with explorer link
- Next steps or available actions mentioned
- Any relevant addresses (token, NFT, wallet) clearly displayed
- Estimated or actual gas costs mentioned when significant
"""
    
    return system_prompt

def execute_tool(tool_name: str, parameters: Dict[str, Any]) -> Dict[str, Any]:
    """Execute a tool by calling its API endpoint"""
    
    if tool_name not in TOOL_DEFINITIONS:
        raise ValueError(f"Unknown tool: {tool_name}")
    
    tool_def = TOOL_DEFINITIONS[tool_name]
    endpoint = tool_def["endpoint"]
    method = tool_def["method"]
    
    # Handle local tools (like calculate)
    if method == "LOCAL":
        if tool_name == "calculate":
            try:
                expression = parameters.get("expression", "")
                variables = parameters.get("variables", {})
                description = parameters.get("description", "Calculation")
                
                import re
                
                # Substitute variables in the expression
                resolved_expression = expression
                if variables:
                    for var_name, var_value in variables.items():
                        # Replace variable name with its numeric value
                        resolved_expression = re.sub(
                            r'\b' + re.escape(str(var_name)) + r'\b',
                            str(var_value),
                            resolved_expression
                        )
                
                # Check if there are still unresolved variable names
                variable_pattern = r'[a-zA-Z_][a-zA-Z0-9_]*'
                found_variables = re.findall(variable_pattern, resolved_expression)
                # Filter out 'e' which is valid for scientific notation like 1e10
                found_variables = [v for v in found_variables if v.lower() != 'e']
                
                if found_variables:
                    return {
                        "success": False,
                        "tool": tool_name,
                        "error": f"Unresolved variables in expression: {', '.join(found_variables)}. Please provide their values in the 'variables' parameter. Example: variables={{{found_variables[0]}: 123.45}}"
                    }
                
                # Safely evaluate the expression (only allow basic math)
                allowed_chars = set("0123456789+-*/().e ")
                if not all(c in allowed_chars for c in resolved_expression.lower()):
                    return {
                        "success": False,
                        "tool": tool_name,
                        "error": "Invalid characters in expression. Only numbers and basic operators (+, -, *, /, .) are allowed."
                    }
                    
                result = eval(resolved_expression)
                return {
                    "success": True,
                    "tool": tool_name,
                    "result": {
                        "original_expression": expression,
                        "variables": variables,
                        "resolved_expression": resolved_expression,
                        "result": result,
                        "description": description
                    }
                }
            except Exception as e:
                return {
                    "success": False,
                    "tool": tool_name,
                    "error": f"Calculation error: {str(e)}"
                }
    
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
    if "api.subgraph.arbitrum.network" in endpoint:
        bearer_token = os.getenv("ARBITRUM_BEARER_TOKEN")
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
    Primary: Groq (moonshotai/kimi-k2-instruct-0905) with tool use
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
                    model="moonshotai/kimi-k2-instruct-0905",
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
                        "provider": "Groq (moonshotai/kimi-k2-instruct-0905)"
                    }
            
            # Max iterations reached with Groq
            return {
                "agent_response": "Maximum iterations reached. Please try again with a simpler request.",
                "tool_calls": all_tool_calls,
                "results": all_tool_results,
                "conversation_history": [],
                "provider": "Groq (moonshotai/kimi-k2-instruct-0905)"
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
        import traceback
        error_detail = f"{str(e)}\n\nTraceback:\n{traceback.format_exc()}"
        print(f"ERROR in /agent/chat: {error_detail}")
        raise HTTPException(status_code=500, detail=str(e))

class WorkflowRequest(BaseModel):
    prompt: str

class AITool(BaseModel):
    id: str
    type: str
    name: str
    next_tools: List[str]

class WorkflowResponse(BaseModel):
    agent_id: str
    tools: List[AITool]
    has_sequential_execution: bool
    description: str
    raw_response: Optional[str] = None

@app.post("/create-workflow", response_model=WorkflowResponse)
async def create_workflow(request: WorkflowRequest):
    """
    Generate a workflow configuration from a natural language query.
    This endpoint analyzes the user's request and returns a structured workflow with tools.
    """
    
    try:
        # System prompt for workflow generation
        workflow_system_prompt = """You are an AI workflow designer for Arbitrum Sepolia blockchain operations.
Your task is to analyze the user's request and create a structured workflow with the appropriate blockchain tools.

AVAILABLE TOOLS:
- transfer: Transfer tokens (ETH or ERC20) from one address to another
- get_balance: Get the ETH balance of a wallet address
- deploy_erc20: Deploy a new ERC-20 token contract
- deploy_erc721: Deploy a new ERC-721 NFT collection
- deploy_orbit: Deploy an Arbitrum Orbit L3 chain
- mint_nft: Mint an NFT from a deployed ERC-721 collection
- get_price: Get the current price of a token
- airdrop: Send tokens to multiple addresses

RESPONSE FORMAT:
You must respond with a valid JSON object containing:
{
  "tools": [
    {
      "type": "tool_name",
      "name": "Descriptive Name",
      "next_tools": ["next_tool_type"] or []
    }
  ],
  "description": "Brief description of what this workflow does",
  "has_sequential_execution": true/false
}

RULES:
1. Identify which tool(s) are needed based on the user's request
2. If multiple operations need to happen in sequence, set has_sequential_execution to true
3. Use next_tools array to link sequential operations
4. Keep the description clear and concise
5. Only include tools that are needed for the request
6. Return ONLY the JSON object, no additional text

EXAMPLES:

User: "Deploy a new token called MYTOKEN with 1000000 supply"
Response:
{
  "tools": [{"type": "deploy_erc20", "name": "Deploy MYTOKEN", "next_tools": []}],
  "description": "Deploy ERC-20 token MYTOKEN with 1,000,000 initial supply",
  "has_sequential_execution": false
}

User: "Deploy an NFT collection and mint the first NFT"
Response:
{
  "tools": [
    {"type": "deploy_erc721", "name": "Deploy NFT Collection", "next_tools": ["mint_nft"]},
    {"type": "mint_nft", "name": "Mint First NFT", "next_tools": []}
  ],
  "description": "Deploy an ERC-721 NFT collection and mint the first NFT",
  "has_sequential_execution": true
}

User: "Check my wallet balance"
Response:
{
  "tools": [{"type": "get_balance", "name": "Check Balance", "next_tools": []}],
  "description": "Check the ETH balance of your wallet",
  "has_sequential_execution": false
}
"""

        # Use Groq for workflow generation
        if groq_client:
            try:
                completion = groq_client.chat.completions.create(
                    model="moonshotai/kimi-k2-instruct-0905",
                    messages=[
                        {"role": "system", "content": workflow_system_prompt},
                        {"role": "user", "content": request.prompt}
                    ],
                    temperature=0.5,
                    max_tokens=2048,
                )
                
                response_text = completion.choices[0].message.content.strip()
                
                # Parse the JSON response
                # Remove markdown code blocks if present
                if response_text.startswith("```json"):
                    response_text = response_text[7:]
                if response_text.startswith("```"):
                    response_text = response_text[3:]
                if response_text.endswith("```"):
                    response_text = response_text[:-3]
                
                response_text = response_text.strip()
                workflow_data = json.loads(response_text)
                
                # Generate tool IDs and structure
                tools = []
                for idx, tool in enumerate(workflow_data.get("tools", [])):
                    tools.append(AITool(
                        id=f"tool_{idx + 1}",
                        type=tool.get("type", ""),
                        name=tool.get("name", ""),
                        next_tools=tool.get("next_tools", [])
                    ))
                
                return WorkflowResponse(
                    agent_id=f"workflow_{int(os.urandom(4).hex(), 16)}",
                    tools=tools,
                    has_sequential_execution=workflow_data.get("has_sequential_execution", False),
                    description=workflow_data.get("description", "Generated workflow"),
                    raw_response=response_text
                )
                
            except Exception as groq_error:
                print(f"Groq workflow generation failed: {str(groq_error)}")
                # Fall through to Gemini
        
        # Fallback to Gemini
        if GEMINI_API_KEY:
            try:
                model = genai.GenerativeModel(
                    model_name='gemini-2.0-flash',
                    generation_config={
                        "temperature": 0.5,
                        "top_p": 0.8,
                    }
                )
                
                prompt = f"{workflow_system_prompt}\n\nUser Query: {request.prompt}"
                response = model.generate_content(prompt)
                response_text = response.text.strip()
                
                # Parse the JSON response
                if response_text.startswith("```json"):
                    response_text = response_text[7:]
                if response_text.startswith("```"):
                    response_text = response_text[3:]
                if response_text.endswith("```"):
                    response_text = response_text[:-3]
                
                response_text = response_text.strip()
                workflow_data = json.loads(response_text)
                
                # Generate tool IDs and structure
                tools = []
                for idx, tool in enumerate(workflow_data.get("tools", [])):
                    tools.append(AITool(
                        id=f"tool_{idx + 1}",
                        type=tool.get("type", ""),
                        name=tool.get("name", ""),
                        next_tools=tool.get("next_tools", [])
                    ))
                
                return WorkflowResponse(
                    agent_id=f"workflow_{int(os.urandom(4).hex(), 16)}",
                    tools=tools,
                    has_sequential_execution=workflow_data.get("has_sequential_execution", False),
                    description=workflow_data.get("description", "Generated workflow"),
                    raw_response=response_text
                )
                
            except Exception as gemini_error:
                raise HTTPException(status_code=500, detail=f"Gemini workflow generation failed: {str(gemini_error)}")
        
        raise HTTPException(status_code=500, detail="No AI providers available")
        
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse AI response as JSON: {str(e)}")
    except Exception as e:
        import traceback
        error_detail = f"{str(e)}\n\nTraceback:\n{traceback.format_exc()}"
        print(f"ERROR in /create-workflow: {error_detail}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "AI Agent Builder",
        "blockchain": "Arbitrum Sepolia",
        "ai_providers": {
            "primary": "Groq (moonshotai/kimi-k2-instruct-0905)" if GROQ_API_KEY else "Not configured",
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