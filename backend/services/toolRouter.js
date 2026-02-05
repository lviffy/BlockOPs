const { chatWithAI } = require('./aiService');

/**
 * Available tools in the system
 */
const AVAILABLE_TOOLS = {
  fetch_price: {
    name: 'fetch_price',
    description: 'Fetches the current price of any cryptocurrency (e.g., Bitcoin, Ethereum, Solana, etc.)',
    parameters: ['token_name'],
    examples: ['What is the price of Bitcoin?', 'How much is Solana worth?', 'Get me ETH price']
  },
  get_balance: {
    name: 'get_balance',
    description: 'Gets the ETH balance of a wallet address',
    parameters: ['wallet_address'],
    examples: ['What is the balance of 0x123...?', 'Check my wallet balance', 'How much ETH do I have?']
  },
  transfer: {
    name: 'transfer',
    description: 'Transfers ETH or ERC20 tokens from one wallet to another',
    parameters: ['from_address', 'to_address', 'amount', 'token_address (optional)'],
    examples: ['Send 1 ETH to 0x123...', 'Transfer 100 USDC to Alice', 'Pay Bob 0.5 ETH']
  },
  deploy_erc20: {
    name: 'deploy_erc20',
    description: 'Deploys a new ERC20 token contract',
    parameters: ['name', 'symbol', 'decimals', 'initial_supply'],
    examples: ['Deploy a new token called MyToken', 'Create an ERC20 token', 'Launch a new cryptocurrency']
  },
  deploy_erc721: {
    name: 'deploy_erc721',
    description: 'Deploys a new ERC721 NFT collection contract',
    parameters: ['name', 'symbol', 'base_uri'],
    examples: ['Deploy an NFT collection', 'Create a new NFT project', 'Launch an NFT collection']
  },
  mint_nft: {
    name: 'mint_nft',
    description: 'Mints a new NFT in an existing ERC721 collection',
    parameters: ['contract_address', 'to_address', 'token_uri'],
    examples: ['Mint an NFT', 'Create a new NFT in my collection', 'Mint token ID 5']
  },
  get_token_info: {
    name: 'get_token_info',
    description: 'Gets information about an ERC20 token (name, symbol, decimals, total supply)',
    parameters: ['token_address'],
    examples: ['Get info about token 0x123...', 'What is this token?', 'Token details for 0xabc...']
  },
  get_token_balance: {
    name: 'get_token_balance',
    description: 'Gets the balance of a specific ERC20 token for a wallet',
    parameters: ['wallet_address', 'token_address'],
    examples: ['How many USDC does 0x123... have?', 'Check my token balance', 'Token balance for wallet']
  },
  get_nft_info: {
    name: 'get_nft_info',
    description: 'Gets information about an NFT collection or specific NFT',
    parameters: ['contract_address', 'token_id (optional)'],
    examples: ['Get NFT collection info', 'What is this NFT?', 'NFT details for token #5']
  },
  calculate: {
    name: 'calculate',
    description: 'Performs mathematical calculations or conversions',
    parameters: ['expression', 'values'],
    examples: ['How much can I buy with X ETH?', 'Calculate 100 / 83.92', 'Convert ETH to tokens']
  }
};

/**
 * Use AI to intelligently determine which tools to call and in what order
 * @param {string} userMessage - The user's natural language request
 * @param {Array} conversationHistory - Recent conversation messages for context
 * @returns {Promise<Object>} Tool execution plan with tools, order, and parameters
 */
async function intelligentToolRouting(userMessage, conversationHistory = []) {
  // Quick regex-based off-topic detection
  const offTopicPatterns = [
    /\b(prime minister|president|politician|government|election|politics)\b/i,
    /\b(weather|temperature|forecast|rain|sunny)\b/i,
    /\b(movie|film|actor|actress|celebrity|entertainment)\b/i,
    /\b(recipe|cooking|food|restaurant|cuisine)\b(?!.*token|contract)/i,
    /\b(sport|football|basketball|soccer|cricket|tennis)\b/i,
    /\b(health|medical|doctor|disease|medicine)\b/i,
    /\bwho is\b.*\b(minister|president|ceo|founder)\b(?!.*(vitalik|satoshi|blockchain|crypto))/i
  ];
  
  // Check if message matches off-topic patterns
  const isOffTopic = offTopicPatterns.some(pattern => pattern.test(userMessage));
  
  if (isOffTopic) {
    return {
      analysis: 'User query is not related to blockchain operations',
      is_off_topic: true,
      requires_tools: false,
      execution_plan: { type: 'none', steps: [] },
      missing_info: [],
      complexity: 'simple'
    };
  }
  
  const toolsList = Object.values(AVAILABLE_TOOLS)
    .map(tool => `- ${tool.name}: ${tool.description}\n  Parameters: ${tool.parameters.join(', ')}\n  Examples: ${tool.examples.join('; ')}`)
    .join('\n\n');

  const conversationContext = conversationHistory.length > 0
    ? `\n\nRecent conversation context:\n${conversationHistory.slice(-5).map(m => `${m.role}: ${m.content}`).join('\n')}`
    : '';

  const prompt = `You are an intelligent tool routing system for a blockchain assistant. Your job is to analyze the user's request and determine:
1. If the request is related to blockchain, cryptocurrency, tokens, NFTs, wallets, or smart contracts
2. Which tools need to be called
3. What order they should be called in (sequential vs parallel)
4. What parameters need to be extracted from the user's message
5. Any dependencies between tool calls

IMPORTANT: If the user's request is NOT related to blockchain operations (e.g., general knowledge questions, current events, weather, entertainment, politics, etc.), you must flag it as off-topic.

Available Tools:
${toolsList}

User Request: "${userMessage}"${conversationContext}

Analyze the request and respond with a JSON object following this structure:

{
  "analysis": "Brief explanation of what the user wants to accomplish",
  "is_off_topic": true/false,
  "requires_tools": true/false,
  "execution_plan": {
    "type": "sequential" or "parallel",
    "steps": [
      {
        "tool": "tool_name",
        "reason": "why this tool is needed",
        "parameters": {
          "param_name": "extracted_value or null if needs to be provided by user"
        },
        "depends_on": ["tool_name"] or [] (for sequential execution, which tools must complete first)
      }
    ]
  },
  "missing_info": ["list of information that needs to be asked from the user"],
  "complexity": "simple" or "moderate" or "complex"
}

IMPORTANT RULES:
1. If the user asks multiple questions (e.g., "tell me X AND tell me Y"), create steps for ALL parts
2. Use "sequential" execution when one tool's output is needed by another (e.g., get balance THEN calculate how much to buy)
3. Use "parallel" execution when tools are independent (e.g., get price AND get balance simultaneously)
4. Extract as many parameters as possible from the user's message
5. For calculations involving tool results, add a "calculate" tool step
6. If information is ambiguous or missing, add it to "missing_info"
7. Common pattern: "How much X can I buy with balance Y" = get_balance → fetch_price → calculate (sequential)
8. Ethereum addresses must be 42 characters starting with "0x" - validate before including
9. Network: Arbitrum Sepolia (Chain ID: 421614) - all operations are on this testnet

Examples:
- "What is the price of Solana?" → Simple, single tool (fetch_price)
- "Check balance and get ETH price" → Parallel, two independent tools
- "How much Solana can I buy with my wallet balance?" → Sequential: get_balance → fetch_price → calculate

Respond ONLY with valid JSON, no other text.`;

  try {
    const messages = [
      {
        role: 'system',
        content: 'You are a JSON-only tool routing expert. Always respond with valid JSON.'
      },
      {
        role: 'user',
        content: prompt
      }
    ];

    const response = await chatWithAI(messages, 'llama-3.3-70b-versatile', {
      temperature: 0.2, // Low temperature for more consistent routing
      maxTokens: 2000
    });

    // Extract JSON from response - try multiple patterns
    let jsonMatch = response.match(/```json\s*([\s\S]*?)```/);
    if (!jsonMatch) {
      jsonMatch = response.match(/\{[\s\S]*\}/);
    }
    
    if (!jsonMatch) {
      throw new Error('AI response did not contain valid JSON');
    }

    const jsonStr = jsonMatch[1] || jsonMatch[0];
    const routingPlan = JSON.parse(jsonStr.trim());
    
    console.log('[Tool Router] AI Routing Plan:', JSON.stringify(routingPlan, null, 2));
    
    return routingPlan;
  } catch (error) {
    console.error('[Tool Router] Error:', error.message);
    
    // Fallback to simple routing
    return {
      analysis: 'Fallback routing due to AI error',
      is_off_topic: false,
      requires_tools: true,
      execution_plan: {
        type: 'parallel',
        steps: detectToolsWithRegex(userMessage)
      },
      missing_info: [],
      complexity: 'simple'
    };
  }
}

/**
 * Fallback: Simple regex-based tool detection (old method)
 * @param {string} message - User message
 * @returns {Array} List of tool steps
 */
function detectToolsWithRegex(message) {
  const tools = [];
  
  if (/\b(price|fetch.*price|get.*price|check.*price|what.*price|how.*much|cost)\b/i.test(message)) {
    tools.push({ 
      tool: 'fetch_price', 
      reason: 'User mentioned price',
      parameters: {},
      depends_on: [] 
    });
  }
  
  if (/\b(balance|wallet|check.*balance|get.*balance|how.*much.*have|account)\b/i.test(message)) {
    tools.push({ 
      tool: 'get_balance', 
      reason: 'User mentioned balance or wallet',
      parameters: {},
      depends_on: [] 
    });
  }
  
  if (/\b(transfer|send|pay|move)\b/i.test(message)) {
    tools.push({ 
      tool: 'transfer', 
      reason: 'User wants to transfer',
      parameters: {},
      depends_on: [] 
    });
  }
  
  if (/\b(deploy.*erc20|deploy.*token|create.*token|new.*token)\b/i.test(message)) {
    tools.push({ 
      tool: 'deploy_erc20', 
      reason: 'User wants to deploy ERC20',
      parameters: {},
      depends_on: [] 
    });
  }
  
  if (/\b(deploy.*erc721|deploy.*nft|create.*nft|new.*nft|nft.*collection)\b/i.test(message)) {
    tools.push({ 
      tool: 'deploy_erc721', 
      reason: 'User wants to deploy NFT',
      parameters: {},
      depends_on: [] 
    });
  }
  
  return tools;
}

/**
 * Convert routing plan to format expected by agent backend
 * @param {Object} routingPlan - The routing plan from intelligentToolRouting
 * @returns {Array} Tools array for agent backend
 */
function convertToAgentFormat(routingPlan) {
  if (!routingPlan.requires_tools || !routingPlan.execution_plan) {
    return [];
  }

  const { steps, type } = routingPlan.execution_plan;
  
  return steps.map((step, index) => {
    const nextTool = type === 'sequential' && index < steps.length - 1 
      ? steps[index + 1].tool 
      : null;

    return {
      tool: step.tool,
      next_tool: nextTool,
      parameters: step.parameters || {},
      reason: step.reason
    };
  });
}

module.exports = {
  intelligentToolRouting,
  convertToAgentFormat,
  AVAILABLE_TOOLS
};
