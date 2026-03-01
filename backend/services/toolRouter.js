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
    description: 'Gets the ETH balance of a wallet address. If the user asks for "my balance", the connected wallet address will be used automatically.',
    parameters: ['wallet_address (optional if user is asking for their own balance)'],
    examples: ['What is the balance of 0x123...?', 'Check my wallet balance', 'How much ETH do I have?']
  },
  transfer: {
    name: 'transfer',
    description: 'Transfers ETH or ERC20 tokens from user\'s connected wallet to another wallet. The user\'s wallet address is used automatically.',
    parameters: ['to_address', 'amount', 'token_address (optional)'],
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
  },
  send_email: {
    name: 'send_email',
    description: 'Sends an email to one or more recipients. Supports plain text, HTML, CC, BCC, reply-to, and attachments.',
    parameters: ['to', 'subject', 'text (optional)', 'html (optional)', 'cc (optional)', 'bcc (optional)', 'replyTo (optional)'],
    examples: ['Send an email to alice@example.com', 'Email Bob the transaction receipt', 'Notify team about the deployment']
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

  // Build rich conversation context with extracted entities
  let conversationContext = '';
  if (conversationHistory.length > 0) {
    const recentMessages = conversationHistory.slice(-10);
    
    // Extract key entities from conversation history 
    const extractedEntities = [];
    for (const msg of recentMessages) {
      const content = msg.content || '';
      // Extract wallet addresses
      const addresses = content.match(/0x[a-fA-F0-9]{40}/g);
      if (addresses) extractedEntities.push(`Wallet addresses mentioned: ${addresses.join(', ')}`);
      // Extract ETH balances
      const balanceMatch = content.match(/(\d+\.?\d*)\s*ETH/i);
      if (balanceMatch) extractedEntities.push(`ETH balance found: ${balanceMatch[1]} ETH`);
      // Extract prices
      const priceMatches = content.match(/([A-Z]{2,10}):\s*([\d,.]+)\s*USD/gi);
      if (priceMatches) extractedEntities.push(`Prices found: ${priceMatches.join(', ')}`);
      // Extract tool results
      if (content.includes('Balance for')) extractedEntities.push(`Previous result: ${content}`);
      if (content.includes('Current prices:')) extractedEntities.push(`Previous result: ${content}`);
    }
    
    const entitySummary = extractedEntities.length > 0
      ? `\n\nKEY DATA FROM CONVERSATION (reuse this, do NOT ask user again):\n${[...new Set(extractedEntities)].join('\n')}`
      : '';
    
    conversationContext = `\n\nRecent conversation (last ${recentMessages.length} messages):\n${recentMessages.map(m => `${m.role}: ${m.content}`).join('\n')}${entitySummary}`;
  }

  const prompt = `You are an intelligent tool routing system for a blockchain assistant. Your PRIMARY job is to create COMPLETE execution plans that resolve the user's request in a single pass, WITHOUT asking the user for information that your tools can fetch.

## Your Responsibilities:
1. Determine if the request is blockchain/crypto-related
2. Create a COMPLETE multi-step tool execution plan
3. Extract context from conversation history (addresses, balances, previous results)
4. Auto-resolve dependencies by chaining tools — NEVER ask the user for data a tool can provide
5. Only put truly user-dependent info in missing_info (private keys, destination addresses NOT in context)

## CRITICAL RULE — RESOLVE, DON'T ASK:
If the user's question requires data that a tool can fetch, ADD THAT TOOL TO THE PLAN.
- Need a price? → Add fetch_price step. Do NOT put "current ETH price" in missing_info.
- Need a balance? → Add get_balance step. Do NOT put "wallet balance" in missing_info.
- Need token info? → Add get_token_info step.
- "missing_info" is ONLY for things NO tool can resolve: private keys, unknown wallet addresses, ambiguous token names.

## CRITICAL RULE — USE CONVERSATION CONTEXT:
The conversation history contains previously fetched data. EXTRACT and REUSE it:
- If a wallet address was mentioned earlier, use it (don't ask again)
- If a balance was fetched, reference it in calculations
- If the user says "this balance" or "my balance", look for the address/balance in recent messages
- Pronouns like "it", "this", "that" refer to the most recent relevant entity

IMPORTANT: Off-topic detection — If the user's request is NOT related to blockchain operations or email notifications (e.g., general knowledge, weather, entertainment, politics), flag it as off-topic.

Available Tools:
${toolsList}

User Request: "${userMessage}"${conversationContext}

Analyze the request and respond with a JSON object following this structure:

{
  "analysis": "Brief explanation of what the user wants to accomplish",
  "is_off_topic": true/false,
  "requires_tools": true/false,
  "extracted_context": {
    "wallet_address": "address from conversation or null",
    "eth_balance": "balance from conversation or null",
    "referenced_tokens": ["tokens mentioned or implied"]
  },
  "execution_plan": {
    "type": "sequential" or "parallel",
    "steps": [
      {
        "tool": "tool_name",
        "reason": "why this tool is needed",
        "parameters": {
          "param_name": "extracted_value or null if needs to be provided by user"
        },
        "depends_on": ["tool_name"] or []
      }
    ]
  },
  "missing_info": ["ONLY info that NO tool can resolve AND is not in conversation context"],
  "complexity": "simple" or "moderate" or "complex"
}

## MANDATORY MULTI-STEP PATTERNS (follow these EXACTLY):

### "How many [TOKEN] can I buy with [X] ETH / my balance / this balance":
Steps (sequential):
1. get_balance (if balance not already known from context) with wallet address from context
2. fetch_price for "ethereum" (ALWAYS needed to convert ETH → USD)
3. fetch_price for the target token
4. calculate: (eth_balance * eth_price) / token_price
missing_info: [] (EMPTY — all data comes from tools)

### "What is my balance worth in USD":
1. get_balance (if not known)
2. fetch_price for "ethereum"
3. calculate: eth_balance * eth_price

### "Convert X [TOKEN_A] to [TOKEN_B]" / comparison:
1. fetch_price for token_a
2. fetch_price for token_b
3. calculate: (amount * price_a) / price_b

### "Send $X worth of ETH to [address]":
1. fetch_price for "ethereum"
2. calculate: usd_amount / eth_price
3. transfer with calculated amount

### Price query: Direct fetch_price call
### Balance query: Direct get_balance call

## KEY RULES:
1. Multi-part requests → create steps for ALL parts
2. Use "sequential" when one tool's output feeds another
3. Use "parallel" when tools are independent
4. Extract parameters from BOTH the current message AND conversation history
5. For ANY calculation involving prices/balances → add fetch_price + calculate steps
6. Ethereum addresses are 42 chars starting with "0x"
7. Network: Arbitrum Sepolia (Chain ID: 421614)
8. When the user says "calculate" or "now calculate" after previous data was fetched, create a calculate step using the data from conversation context
9. If the user says generic words like "this balance" or "my balance", look for the wallet address and balance in recent conversation messages
10. NEVER put prices, balances, or token info in missing_info — those are fetchable by tools

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

    const response = await chatWithAI(messages, 'moonshotai/kimi-k2-instruct-0905', {
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

    // POST-PROCESS: Enforce get_balance when a calculate step references balance variables
    // This prevents the AI from skipping get_balance and leaving eth_balance unresolved.
    const steps = routingPlan.execution_plan?.steps || [];
    const calcStep = steps.find(s => s.tool === 'calculate');
    if (calcStep) {
      const calcBlob = JSON.stringify(calcStep.parameters || '').toLowerCase();
      const needsBalance = /eth_balance|wallet_balance|my_balance\b/.test(calcBlob);
      const hasGetBalance = steps.some(s => s.tool === 'get_balance');
      if (needsBalance && !hasGetBalance) {
        // Try to extract wallet address from conversation history
        const historyStr = (conversationHistory || []).map(m => m.content || '').join(' ');
        const addrMatch = historyStr.match(/0x[a-fA-F0-9]{40}/);
        const walletAddress = addrMatch ? addrMatch[0] : null;
        const balanceStep = {
          tool: 'get_balance',
          reason: 'Wallet balance is required for this calculation',
          parameters: { address: walletAddress },
          depends_on: []
        };
        steps.unshift(balanceStep);
        routingPlan.execution_plan.steps = steps;
        routingPlan.execution_plan.type = 'sequential';
        console.log('[Tool Router] Auto-injected get_balance step — eth_balance needed for calculate');
      }
    }

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

  if (/\b(email|send.*email|mail|notify|notification)\b/i.test(message)) {
    tools.push({ 
      tool: 'send_email', 
      reason: 'User wants to send an email',
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
