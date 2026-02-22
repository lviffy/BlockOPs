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
  calculate: { method: 'LOCAL' }
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
    const variables = params.variables || {};

    let resolved = expression;
    Object.entries(variables).forEach(([name, value]) => {
      const pattern = new RegExp(`\\b${name}\\b`, 'g');
      resolved = resolved.replace(pattern, String(value));
    });

    const allowedChars = /^[0-9+\-*/().eE\s]+$/;
    if (!allowedChars.test(resolved)) {
      return {
        success: false,
        tool: 'calculate',
        error: 'Invalid characters in expression. Only numbers and basic operators are allowed.'
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
  
  // Get the most recent successful result
  const lastResult = previousResults[previousResults.length - 1];
  if (!lastResult?.success || !lastResult?.result) {
    return interpolated;
  }

  // Helper to format price data
  const formatPriceData = (result) => {
    if (result.prices && Array.isArray(result.prices) && result.prices.length > 0) {
      const price = result.prices[0];
      const currency = (price.currency || 'USD').toUpperCase();
      const value = typeof price.price === 'number' ? price.price.toFixed(2) : price.price;
      const coin = (price.coin || '').toUpperCase();
      const change = price.change_24h !== undefined && price.change_24h !== null
        ? ` (24h change: ${price.change_24h > 0 ? '+' : ''}${price.change_24h.toFixed(2)}%)`
        : '';
      return `${value} ${currency}${change}`;
    }
    return null;
  };

  // Replace placeholders in string parameters
  Object.keys(interpolated).forEach(key => {
    if (typeof interpolated[key] === 'string') {
      let value = interpolated[key];
      
      // Replace price-related placeholders
      if (lastResult.tool === 'fetch_price') {
        const priceData = formatPriceData(lastResult.result);
        if (priceData) {
          value = value.replace(/\[Price (?:will be inserted )?from fetch_price result\]/gi, priceData);
          value = value.replace(/\[Price from [\w_]+ result\]/gi, priceData);
          value = value.replace(/\[Current Price\]/gi, priceData);
          value = value.replace(/\{price\}/gi, priceData);
        }
      }
      
      // Replace balance-related placeholders
      if (lastResult.tool === 'get_balance' && lastResult.result.balance) {
        value = value.replace(/\[Balance from get_balance result\]/gi, lastResult.result.balance);
        value = value.replace(/\{balance\}/gi, lastResult.result.balance);
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
