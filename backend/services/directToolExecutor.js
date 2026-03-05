const axios = require('axios');
const { PORT } = require('../config/constants');

const BASE_URL = process.env.BACKEND_URL || `http://localhost:${PORT}`;

const TOOL_ENDPOINTS = {
  fetch_price: { method: 'POST', path: '/price/token' },
  get_balance: { method: 'GET', path: '/transfer/balance/{address}' },
  transfer: { method: 'POST', path: '/transfer' },
  deploy_erc20: { method: 'POST', path: '/token/deploy' },
  deploy_erc721: { method: 'POST', path: '/nft/deploy-collection' },
  mint_nft: { method: 'POST', path: '/nft/mint' },
  get_token_info: { method: 'GET', path: '/token/info/{tokenId}' },
  get_token_balance: { method: 'GET', path: '/token/balance/{tokenId}/{ownerAddress}' },
  get_nft_info: { method: 'GET', path: '/nft/info/{collectionAddress}/{tokenId}' },
  send_email: { method: 'POST', path: '/email/send' },
  calculate: { method: 'LOCAL' },
  batch_transfer: { method: 'POST', path: '/batch/transfer' },
  batch_mint:     { method: 'POST', path: '/batch/mint' }
};

function mapToolParams(tool, params = {}, fallbackMessage) {
  const missing = [];
  let mapped = { ...params };

  switch (tool) {
    case 'fetch_price': {
      const query = params.query || params.token_name || params.symbol || fallbackMessage;
      const vsCurrency = params.vsCurrency || params.vs_currency || params.currency;
      mapped = { query };
      if (vsCurrency) mapped.vsCurrency = vsCurrency;
      if (!query) missing.push('query');
      break;
    }
    case 'get_balance': {
      const address = params.address || params.wallet_address;
      mapped = { address };
      if (!address) missing.push('address');
      break;
    }
    case 'transfer': {
      const privateKey = params.privateKey || params.private_key;
      const toAddress = params.toAddress || params.to_address;
      const amount = params.amount;
      const tokenId = params.tokenId || params.token_id || params.tokenId;
      mapped = { privateKey, toAddress, amount };
      if (tokenId !== undefined) mapped.tokenId = tokenId;
      if (!privateKey) missing.push('privateKey');
      if (!toAddress) missing.push('toAddress');
      if (!amount) missing.push('amount');
      break;
    }
    case 'deploy_erc20': {
      const privateKey = params.privateKey || params.private_key;
      const name = params.name;
      const symbol = params.symbol;
      const initialSupply = params.initialSupply || params.initial_supply;
      const decimals = params.decimals;
      mapped = { privateKey, name, symbol, initialSupply };
      if (decimals !== undefined) mapped.decimals = decimals;
      if (!privateKey) missing.push('privateKey');
      if (!name) missing.push('name');
      if (!symbol) missing.push('symbol');
      if (!initialSupply) missing.push('initialSupply');
      break;
    }
    case 'deploy_erc721': {
      const privateKey = params.privateKey || params.private_key;
      const name = params.name;
      const symbol = params.symbol;
      const baseURI = params.baseURI || params.base_uri;
      mapped = { privateKey, name, symbol, baseURI };
      if (!privateKey) missing.push('privateKey');
      if (!name) missing.push('name');
      if (!symbol) missing.push('symbol');
      if (!baseURI) missing.push('baseURI');
      break;
    }
    case 'mint_nft': {
      const privateKey = params.privateKey || params.private_key;
      const collectionAddress = params.collectionAddress || params.contract_address;
      const toAddress = params.toAddress || params.to_address;
      mapped = { privateKey, collectionAddress, toAddress };
      if (!privateKey) missing.push('privateKey');
      if (!collectionAddress) missing.push('collectionAddress');
      if (!toAddress) missing.push('toAddress');
      break;
    }
    case 'get_token_info': {
      const tokenId = params.tokenId || params.token_address;
      mapped = { tokenId };
      if (!tokenId) missing.push('tokenId');
      break;
    }
    case 'get_token_balance': {
      const tokenId = params.tokenId || params.token_address;
      const ownerAddress = params.ownerAddress || params.wallet_address;
      mapped = { tokenId, ownerAddress };
      if (!tokenId) missing.push('tokenId');
      if (!ownerAddress) missing.push('ownerAddress');
      break;
    }
    case 'get_nft_info': {
      const collectionAddress = params.collectionAddress || params.contract_address;
      const tokenId = params.tokenId || params.token_id;
      mapped = { collectionAddress, tokenId };
      if (!collectionAddress) missing.push('collectionAddress');
      if (!tokenId) missing.push('tokenId');
      break;
    }
    case 'send_email': {
      const to = params.to;
      const subject = params.subject;
      const text = params.text;
      const html = params.html;
      const cc = params.cc;
      const bcc = params.bcc;
      const replyTo = params.replyTo;
      mapped = { to, subject, text, html, cc, bcc, replyTo };
      if (!to) missing.push('to');
      if (!subject) missing.push('subject');
      if (!text && !html) missing.push('text');
      break;
    }
    case 'calculate': {
      const expression = params.expression;
      const variables = params.variables || params.values;
      const description = params.description;
      mapped = { expression, variables, description };
      if (!expression) missing.push('expression');
      break;
    }
    case 'batch_transfer': {
      const privateKey = params.privateKey || params.private_key;
      const recipients = params.recipients;
      mapped = { privateKey, recipients };
      if (!privateKey) missing.push('privateKey');
      if (!recipients || !Array.isArray(recipients) || recipients.length === 0) missing.push('recipients');
      break;
    }
    case 'batch_mint': {
      const privateKey = params.privateKey || params.private_key;
      const collectionAddress = params.collectionAddress || params.collection_address || params.contract_address;
      const recipients = params.recipients;
      mapped = { privateKey, collectionAddress, recipients };
      if (!privateKey) missing.push('privateKey');
      if (!collectionAddress) missing.push('collectionAddress');
      if (!recipients || !Array.isArray(recipients) || recipients.length === 0) missing.push('recipients');
      break;
    }
    default:
      break;
  }

  return { mapped, missing };
}

function replacePathParams(path, params) {
  let result = path;
  const replacements = {
    '{address}': 'address',
    '{tokenId}': 'tokenId',
    '{ownerAddress}': 'ownerAddress',
    '{collectionAddress}': 'collectionAddress'
  };

  Object.entries(replacements).forEach(([placeholder, key]) => {
    if (result.includes(placeholder) && params[key]) {
      result = result.replace(placeholder, encodeURIComponent(params[key]));
    }
  });

  return result;
}

function safeCalculate(params) {
  try {
    const expression = params.expression || '';
    let variables = params.variables || {};

    // Ensure variables is an object (AI may send string)
    if (typeof variables === 'string') {
      try { variables = JSON.parse(variables); } catch { variables = {}; }
    }
    if (typeof variables !== 'object' || variables === null) variables = {};

    // Normalize whitespace in expression
    let resolved = expression.replace(/\s+/g, ' ').trim();
    
    // Build alias map so common variable name variants all resolve
    const aliasMap = {};
    for (const [varName, val] of Object.entries(variables)) {
      const vn = varName.toLowerCase();
      if (vn.includes('price')) {
        if (vn.includes('eth') || vn.includes('ethereum')) {
          for (const alias of ['eth_price', 'ethereum_price', 'eth_price_usd', 'price_eth']) aliasMap[alias] = val;
        } else if (vn.includes('btc') || vn.includes('bitcoin')) {
          for (const alias of ['btc_price', 'bitcoin_price', 'btc_price_usd', 'price_btc']) aliasMap[alias] = val;
        } else if (vn.includes('sol') || vn.includes('solana')) {
          for (const alias of ['sol_price', 'solana_price', 'sol_price_usd', 'price_sol']) aliasMap[alias] = val;
        } else if (vn.includes('arb') || vn.includes('arbitrum')) {
          for (const alias of ['arb_price', 'arbitrum_price', 'arb_price_usd', 'token_price', 'token_price_usd', 'price_arb']) aliasMap[alias] = val;
        } else if (vn.includes('token')) {
          for (const alias of ['token_price', 'token_price_usd', 'arb_price', 'sol_price', 'btc_price', 'target_price']) {
            if (!(alias in variables)) aliasMap[alias] = val;
          }
        }
      }
      if (vn.includes('balance')) {
        for (const alias of ['eth_balance', 'balance', 'wallet_balance', 'my_balance']) aliasMap[alias] = val;
      }
    }
    
    // Merge: explicit variables override aliases
    const mergedVars = { ...aliasMap, ...variables };

    // --- FALLBACK: extract balance from description when not in variables ---
    // The AI often mentions the balance in the description/context but forgets to include it in variables.
    if (!('eth_balance' in mergedVars) && !('balance' in mergedVars)) {
      const contextText = params.description || '';
      const balancePatterns = [
        /(\d+\.?\d*)\s*ETH/i,            // "0.1 ETH"
        /balance[:\s]+([\d.]+)/i,          // "balance: 0.1"
        /([\d.]+)\s*ether/i,               // "0.1 ether"
        /with\s+([\d.]+)\s*(?:ETH|eth)/i, // "with 0.1 ETH"
      ];
      for (const pattern of balancePatterns) {
        const m = contextText.match(pattern);
        if (m) {
          const extracted = parseFloat(m[1]);
          if (!isNaN(extracted)) {
            mergedVars.eth_balance = extracted;
            mergedVars.balance = extracted;
            mergedVars.wallet_balance = extracted;
            mergedVars.my_balance = extracted;
            console.log(`[Calculate] Auto-extracted balance ${extracted} ETH from description`);
            break;
          }
        }
      }
    }
    
    // Sort variable names by length (longest first) to avoid partial matches
    const sortedVars = Object.entries(mergedVars).sort((a, b) => b[0].length - a[0].length);
    
    sortedVars.forEach(([name, value]) => {
      // Convert value to number, stripping commas
      const numValue = parseFloat(String(value).replace(/,/g, ''));
      if (isNaN(numValue)) {
        throw new Error(`Variable '${name}' has non-numeric value: ${value}`);
      }
      const pattern = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
      resolved = resolved.replace(pattern, String(numValue));
    });

    // Normalize whitespace again after substitution  
    resolved = resolved.replace(/\s+/g, ' ').trim();

    const allowedChars = /^[0-9+\-*/().eE\s]+$/;
    if (!allowedChars.test(resolved)) {
      const badChars = resolved.split('').filter(c => !/[0-9+\-*/().eE\s]/.test(c));
      return {
        success: false,
        tool: 'calculate',
        error: `Invalid characters in expression: [${badChars.join(', ')}]. Resolved: '${resolved}'. Only numbers and basic operators are allowed.`
      };
    }

    const result = Function(`"use strict"; return (${resolved});`)();
    return {
      success: true,
      tool: 'calculate',
      result: {
        original_expression: expression,
        variables: variables,
        resolved_expression: resolved,
        result: result,
        description: params.description || 'Calculation'
      }
    };
  } catch (error) {
    return {
      success: false,
      tool: 'calculate',
      error: `Calculation error: ${error.message}`
    };
  }
}

async function executeToolStep(step, fallbackMessage) {
  const { tool, parameters } = step;
  const mapping = mapToolParams(tool, parameters, fallbackMessage);

  if (mapping.missing.length > 0) {
    return {
      tool_call: { tool, parameters: mapping.mapped },
      result: {
        success: false,
        tool,
        error: `Missing required parameters: ${mapping.missing.join(', ')}`
      }
    };
  }

  const config = TOOL_ENDPOINTS[tool];
  if (!config) {
    return {
      tool_call: { tool, parameters: mapping.mapped },
      result: { success: false, tool, error: 'Tool not supported for direct execution' }
    };
  }

  if (config.method === 'LOCAL' && tool === 'calculate') {
    return {
      tool_call: { tool, parameters: mapping.mapped },
      result: safeCalculate(mapping.mapped)
    };
  }

  const url = `${BASE_URL}${replacePathParams(config.path, mapping.mapped)}`;
  const requestParams = { ...mapping.mapped };

  Object.keys(requestParams).forEach(key => {
    if (config.path.includes(`{${key}}`)) {
      delete requestParams[key];
    }
  });

  try {
    let response;
    if (config.method === 'POST') {
      response = await axios.post(url, requestParams, { timeout: 30000 });
    } else if (config.method === 'GET') {
      response = await axios.get(url, { timeout: 30000 });
    } else {
      throw new Error(`Unsupported method: ${config.method}`);
    }

    return {
      tool_call: { tool, parameters: mapping.mapped },
      result: { success: true, tool, result: response.data }
    };
  } catch (error) {
    return {
      tool_call: { tool, parameters: mapping.mapped },
      result: { success: false, tool, error: error.message }
    };
  }
}

function interpolateParameters(params, previousResults) {
  if (!params || !previousResults || previousResults.length === 0) {
    return params;
  }

  const interpolated = { ...params };
  
  // Collect all successful results
  const resultsByTool = {};
  for (const result of previousResults) {
    if (result?.success && result?.result) {
      resultsByTool[result.tool] = result.result;
    }
  }

  // Helper to extract numeric price from fetch_price result
  const extractPrice = (result) => {
    if (result.prices && Array.isArray(result.prices) && result.prices.length > 0) {
      return result.prices[0].price;
    }
    return null;
  };

  // Helper to extract balance
  const extractBalance = (result) => {
    if (result.balance) return parseFloat(result.balance);
    if (result.balanceInEth) return parseFloat(result.balanceInEth);
    return null;
  };

  // Helper to format price data for display
  const formatPriceData = (result) => {
    if (result.prices && Array.isArray(result.prices) && result.prices.length > 0) {
      const price = result.prices[0];
      const currency = (price.currency || 'USD').toUpperCase();
      const value = typeof price.price === 'number' ? price.price.toFixed(2) : price.price;
      const change = price.change_24h !== undefined && price.change_24h !== null
        ? ` (24h change: ${price.change_24h > 0 ? '+' : ''}${price.change_24h.toFixed(2)}%)`
        : '';
      return `${value} ${currency}${change}`;
    }
    return null;
  };

  // Auto-populate calculate tool variables from previous results
  // Always merge — even if params.variables exists, fill in gaps from tool results
  if (params.expression) {
    const autoVariables = {};
    
    // Extract prices from all fetch_price results
    const priceResults = previousResults.filter(r => r?.success && r?.tool === 'fetch_price');
    for (const pr of priceResults) {
      const price = extractPrice(pr.result);
      if (price !== null) {
        const coin = pr.result.prices?.[0]?.coin?.toLowerCase() || '';
        if (coin.includes('ethereum') || coin.includes('eth')) {
          autoVariables.eth_price = price;
          autoVariables.eth_price_usd = price;
        } else {
          autoVariables.token_price = price;
          autoVariables.token_price_usd = price;
          autoVariables[`${coin}_price`] = price;
        }
      }
    }
    
    // Extract balance from get_balance results
    const balanceResults = previousResults.filter(r => r?.success && r?.tool === 'get_balance');
    for (const br of balanceResults) {
      const balance = extractBalance(br.result);
      if (balance !== null) {
        autoVariables.eth_balance = balance;
        autoVariables.balance = balance;
      }
    }
    
    if (Object.keys(autoVariables).length > 0) {
      // Merge: explicit params.variables override auto-populated ones
      interpolated.variables = { ...autoVariables, ...(params.variables || {}) };
    }
  }

  // Replace placeholders in string parameters
  Object.keys(interpolated).forEach(key => {
    if (typeof interpolated[key] === 'string') {
      let value = interpolated[key];
      
      // Replace price-related placeholders
      for (const result of previousResults) {
        if (!result?.success) continue;
        
        if (result.tool === 'fetch_price') {
          const priceData = formatPriceData(result.result);
          if (priceData) {
            value = value.replace(/\[Price (?:will be inserted )?from fetch_price result\]/gi, priceData);
            value = value.replace(/\[Price from [\w_]+ result\]/gi, priceData);
            value = value.replace(/\[Current Price\]/gi, priceData);
            value = value.replace(/\{price\}/gi, priceData);
          }
        }
        
        if (result.tool === 'get_balance' && result.result?.balance) {
          value = value.replace(/\[Balance from get_balance result\]/gi, result.result.balance);
          value = value.replace(/\{balance\}/gi, result.result.balance);
        }
      }
      
      interpolated[key] = value;
    }
  });

  return interpolated;
}

async function executeToolsDirectly(routingPlan, fallbackMessage) {
  if (!routingPlan?.execution_plan?.steps?.length) {
    return { tool_calls: [], results: [] };
  }

  const { steps, type } = routingPlan.execution_plan;

  if (type === 'parallel') {
    const results = await Promise.all(steps.map(step => executeToolStep(step, fallbackMessage)));
    return {
      tool_calls: results.map(item => item.tool_call),
      results: results.map(item => item.result)
    };
  }

  const toolCalls = [];
  const toolResults = [];
  for (const step of steps) {
    // Interpolate parameters based on previous results
    const interpolatedStep = {
      ...step,
      parameters: interpolateParameters(step.parameters, toolResults)
    };
    
    const { tool_call, result } = await executeToolStep(interpolatedStep, fallbackMessage);
    toolCalls.push(tool_call);
    toolResults.push(result);
    if (!result.success) {
      break;
    }
  }

  return { tool_calls: toolCalls, results: toolResults };
}

function formatToolResponse(toolResults) {
  if (!toolResults?.tool_calls?.length) {
    return 'No tool calls were executed.';
  }

  const messages = toolResults.results.map((result, index) => {
    const tool = toolResults.tool_calls[index]?.tool;
    if (!result?.success) {
      return `${tool}: ${result?.error || 'Failed to execute tool.'}`;
    }

    const payload = result.result || {};

    switch (tool) {
      case 'fetch_price': {
        const prices = payload.prices || [];
        if (!prices.length) {
          return 'Price data not available.';
        }
        const formatted = prices.map(price => {
          const currency = (price.currency || '').toUpperCase();
          const value = typeof price.price === 'number' ? price.price.toFixed(4) : price.price;
          const change = price.change_24h !== undefined && price.change_24h !== null
            ? ` (24h ${price.change_24h.toFixed(2)}%)`
            : '';
          return `${price.coin.toUpperCase()}: ${value} ${currency}${change}`;
        }).join(', ');
        return `Current prices: ${formatted}.`;
      }
      case 'get_balance': {
        return `Balance for ${payload.address}: ${payload.balance} ETH.`;
      }
      case 'transfer': {
        return `Transfer completed. Tx: ${payload.transactionHash || 'unknown'}.`;
      }
      case 'deploy_erc20': {
        return `Token deployed. Token ID: ${payload.tokenId || 'unknown'}. Tx: ${payload.transactionHash || 'unknown'}.`;
      }
      case 'deploy_erc721': {
        return `NFT collection deployed. Address: ${payload.collectionAddress || 'unknown'}. Tx: ${payload.transactionHash || 'unknown'}.`;
      }
      case 'mint_nft': {
        return `NFT minted. Token ID: ${payload.tokenId || 'unknown'}. Tx: ${payload.transactionHash || 'unknown'}.`;
      }
      case 'get_token_info': {
        return `Token info: ${payload.name || 'unknown'} (${payload.symbol || 'unknown'}), supply ${payload.totalSupply || 'unknown'}.`;
      }
      case 'get_token_balance': {
        return `Token balance for ${payload.ownerAddress || 'unknown'}: ${payload.balance || 'unknown'}.`;
      }
      case 'get_nft_info': {
        return `NFT ${payload.tokenId || 'unknown'} owner: ${payload.owner || 'unknown'}.`;
      }
      case 'send_email': {
        return `Email sent successfully.`;
      }
      case 'calculate': {
        return `Calculation result: ${payload.result}.`;
      }
      case 'batch_transfer': {
        return `Batch ETH transfer complete. ${payload.recipientCount} recipients, ${payload.totalAmount} ETH total. Tx: ${payload.transactionHash || 'multiple'}.`;
      }
      case 'batch_mint': {
        return `Batch mint complete. ${payload.succeeded}/${payload.recipientCount} NFTs minted successfully${payload.failed > 0 ? `, ${payload.failed} failed` : ''}.`;
      }
      default:
        return `Executed ${tool}.`;
    }
  });

  return messages.join('\n');
}

module.exports = {
  executeToolsDirectly,
  formatToolResponse
};
