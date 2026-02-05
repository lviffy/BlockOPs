# Smart Tool Calling System - Implementation Guide

## Overview

The system has been upgraded from simple regex-based pattern matching to an **AI-powered intelligent tool routing** system that can:

1. **Understand complex multi-step requests** (e.g., "tell me the price of Solana AND how much I can buy with my wallet balance")
2. **Determine tool execution order** (sequential vs parallel)
3. **Extract parameters** from natural language
4. **Identify missing information** and ask users for clarification
5. **Provide reasoning** for tool selections

## Architecture

### Components

```
User Message
     ↓
[Tool Router Service] ← Uses AI to analyze request
     ↓
[Routing Plan]
     ├── Analysis
     ├── Execution Type (sequential/parallel)
     ├── Tool Steps with Parameters
     └── Missing Info
     ↓
[Conversation Controller] ← Executes plan
     ↓
[Agent Backend] ← Calls tools in correct order
     ↓
[User Response]
```

### File Structure

- **`backend/services/toolRouter.js`** - New intelligent routing service
- **`backend/controllers/conversationController.js`** - Updated to use intelligent routing
- **`backend/services/aiService.js`** - Existing AI chat service
- **`n8n_agent_backend/main.py`** - Agent backend for tool execution

## How It Works

### 1. AI-Powered Analysis

When a user sends a message, the system:

```javascript
const routingPlan = await intelligentToolRouting(message, conversationHistory);
```

The AI analyzes:
- **Intent**: What does the user want to accomplish?
- **Tools Needed**: Which blockchain tools are required?
- **Dependencies**: Do tools need to run in sequence?
- **Parameters**: What values can be extracted from the message?
- **Missing Info**: What else is needed from the user?

### 2. Routing Plan Structure

```json
{
  "analysis": "User wants to know Solana price and calculate purchase amount with wallet balance",
  "requires_tools": true,
  "execution_plan": {
    "type": "sequential",
    "steps": [
      {
        "tool": "get_balance",
        "reason": "Need wallet balance to calculate purchase amount",
        "parameters": {
          "wallet_address": "0xdA4587b5dc52267a53e48dCDb3595d4e40E32B97"
        },
        "depends_on": []
      },
      {
        "tool": "fetch_price",
        "reason": "Need current Solana price for calculation",
        "parameters": {
          "query": "solana"
        },
        "depends_on": ["get_balance"]
      },
      {
        "tool": "calculate",
        "reason": "Calculate how much Solana can be bought",
        "parameters": {
          "expression": "balance / price"
        },
        "depends_on": ["get_balance", "fetch_price"]
      }
    ]
  },
  "missing_info": [],
  "complexity": "complex"
}
```

### 3. Tool Execution

The system converts the routing plan to agent format:

```javascript
const tools = convertToAgentFormat(routingPlan);
// Result:
[
  { tool: 'get_balance', next_tool: 'fetch_price', parameters: {...} },
  { tool: 'fetch_price', next_tool: 'calculate', parameters: {...} },
  { tool: 'calculate', next_tool: null, parameters: {...} }
]
```

## Comparison: Old vs New

### Old System (Regex-Based)

❌ **Problems:**
- Couldn't handle complex multi-part questions
- No understanding of execution order
- Missed implicit tool requirements
- No parameter extraction
- Couldn't ask for missing information

```javascript
// Old code - simple pattern matching
if (/\b(price|fetch.*price)\b/i.test(message)) {
  tools.push({ tool: 'fetch_price', next_tool: null });
}
if (/\b(balance|wallet)\b/i.test(message)) {
  tools.push({ tool: 'get_balance', next_tool: null });
}
// Both tools run in parallel, no coordination!
```

**Example Request:**
> "Tell me how much Solana I can buy with the balance of wallet 0x..."

**Old System Response:**
- ✗ Runs `fetch_price` and `get_balance` in parallel
- ✗ Doesn't perform the calculation
- ✗ Gives incomplete answer

### New System (AI-Powered)

✅ **Improvements:**
- Understands multi-step workflows
- Determines correct execution order
- Extracts parameters from natural language
- Identifies missing information
- Provides reasoning for decisions

```javascript
// New code - AI-powered routing
const routingPlan = await intelligentToolRouting(message, history);
// AI understands:
// 1. Need wallet balance
// 2. Need Solana price  
// 3. Need to calculate (balance / price)
// 4. These must run sequentially
```

**Example Request:**
> "Tell me how much Solana I can buy with the balance of wallet 0x..."

**New System Response:**
- ✓ Runs `get_balance` first
- ✓ Then runs `fetch_price`
- ✓ Finally calculates purchase amount
- ✓ Provides complete, accurate answer

## Use Cases

### 1. Simple Query (Single Tool)

**Request:** "What is the price of Bitcoin?"

**Routing Plan:**
```json
{
  "requires_tools": true,
  "execution_plan": {
    "type": "parallel",
    "steps": [
      {
        "tool": "fetch_price",
        "parameters": { "query": "bitcoin" }
      }
    ]
  }
}
```

### 2. Multi-Part Independent Query

**Request:** "Check my wallet balance and get the ETH price"

**Routing Plan:**
```json
{
  "execution_plan": {
    "type": "parallel",
    "steps": [
      { "tool": "get_balance", "depends_on": [] },
      { "tool": "fetch_price", "depends_on": [] }
    ]
  }
}
```

### 3. Sequential Workflow

**Request:** "Deploy a new token called MyToken with 1M supply, then transfer 1000 tokens to 0x123..."

**Routing Plan:**
```json
{
  "execution_plan": {
    "type": "sequential",
    "steps": [
      {
        "tool": "deploy_erc20",
        "parameters": {
          "name": "MyToken",
          "symbol": "MTK",
          "initialSupply": "1000000"
        },
        "depends_on": []
      },
      {
        "tool": "transfer",
        "parameters": {
          "amount": "1000",
          "toAddress": "0x123..."
        },
        "depends_on": ["deploy_erc20"]
      }
    ]
  }
}
```

### 4. Missing Information

**Request:** "Transfer some tokens to Alice"

**Routing Plan:**
```json
{
  "requires_tools": true,
  "missing_info": [
    "How many tokens do you want to transfer?",
    "What is Alice's wallet address?",
    "Which token would you like to transfer (or ETH)?"
  ]
}
```

**System Response:**
> "I need some additional information to help you:
> 1. How many tokens do you want to transfer?
> 2. What is Alice's wallet address?
> 3. Which token would you like to transfer (or ETH)?"

## Benefits

### For Users
- ✅ More natural conversation
- ✅ Complex requests handled correctly
- ✅ Clear feedback when information is missing
- ✅ Better accuracy in responses

### For Developers
- ✅ Easier to add new tools
- ✅ Less manual routing code
- ✅ Better debugging with routing plans
- ✅ AI handles edge cases

### For the System
- ✅ More maintainable
- ✅ Scalable to many tools
- ✅ Self-improving with better AI models
- ✅ Provides usage analytics

## Configuration

### Environment Variables

```bash
# AI Service (required for routing)
GROQ_API_KEY=your_groq_api_key
GEMINI_API_KEY=your_gemini_api_key  # fallback

# Agent Backend URL
AGENT_BACKEND_URL=http://localhost:8000
```

### Customization

#### Add New Tools

Edit `/backend/services/toolRouter.js`:

```javascript
const AVAILABLE_TOOLS = {
  // ... existing tools
  
  my_new_tool: {
    name: 'my_new_tool',
    description: 'What your tool does',
    parameters: ['param1', 'param2'],
    examples: ['Example query 1', 'Example query 2']
  }
};
```

#### Adjust AI Behavior

Modify the prompt in `intelligentToolRouting()`:

```javascript
const prompt = `You are an intelligent tool routing system...
IMPORTANT RULES:
1. Your custom rule here
2. Another custom rule
...`;
```

#### Change AI Temperature

Lower = more consistent, Higher = more creative

```javascript
const response = await chatWithAI(messages, 'llama-3.1-70b-versatile', {
  temperature: 0.2, // Default: 0.2 (very consistent)
  maxTokens: 2000
});
```

## Debugging

### View Routing Plans

Enable detailed logging:

```javascript
console.log('[Tool Router] Routing Plan:', JSON.stringify(routingPlan, null, 2));
```

### Test Routing

```bash
# Start backend
cd backend
npm start

# Test a message
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user",
    "agentId": "test-agent",
    "message": "Tell me the price of Bitcoin and how much I can buy with 1 ETH"
  }'
```

### Monitor Tool Calls

Check the response for routing details:

```json
{
  "message": "...",
  "toolResults": {
    "tool_calls": [...],
    "results": [...],
    "routing_plan": {
      "analysis": "...",
      "execution_plan": {...}
    }
  }
}
```

## Performance

### Latency
- **Old system**: ~100ms (regex matching)
- **New system**: ~500-800ms (includes AI analysis)
- **Trade-off**: Slightly slower but much more accurate

### Caching (Future Enhancement)
Cache common routing patterns:
```javascript
const cache = new Map();
const cacheKey = hashMessage(userMessage);
if (cache.has(cacheKey)) {
  return cache.get(cacheKey);
}
```

## Future Improvements

1. **Learning from Feedback**
   - Track successful vs failed routing decisions
   - Fine-tune routing model over time

2. **Tool Suggestions**
   - "Did you mean to use X tool instead?"
   - Suggest related tools user might need

3. **Complex Calculations**
   - Add dedicated calculation/conversion tool
   - Support mathematical expressions

4. **Multi-Agent Coordination**
   - Route different parts to specialized agents
   - Parallel agent execution

5. **Context Awareness**
   - Remember user preferences
   - Learn from conversation history
   - Personalized routing

## Testing

### Unit Tests (Future)

```javascript
describe('Tool Router', () => {
  test('handles simple price query', async () => {
    const plan = await intelligentToolRouting('What is BTC price?');
    expect(plan.requires_tools).toBe(true);
    expect(plan.execution_plan.steps[0].tool).toBe('fetch_price');
  });

  test('detects sequential workflow', async () => {
    const plan = await intelligentToolRouting(
      'Deploy token then transfer to 0x123'
    );
    expect(plan.execution_plan.type).toBe('sequential');
  });
});
```

## Conclusion

The intelligent tool routing system transforms the conversation experience from rigid pattern matching to flexible, AI-powered understanding. It handles complex multi-step requests, extracts parameters, identifies missing information, and executes tools in the correct order.

**Key Takeaway**: The system now **understands** user intent rather than just **matching** keywords.
