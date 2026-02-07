# BlockOps Tool Implementation Guide

This document provides detailed descriptions and implementation guidance for each proposed tool in BlockOps.

---

## 🔥 High-Impact Tools

### 1. Wrap/Unwrap ETH

**Description:**  
Converts native ETH to WETH (Wrapped Ether) and vice versa. Most DEXs and DeFi protocols require WETH instead of native ETH for trading pairs.

**Integration:**

```typescript
// Contract: WETH9 on Arbitrum
const WETH_ADDRESS = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";

// Wrap ETH → WETH
async function wrapETH(amount: bigint) {
  const weth = new ethers.Contract(WETH_ADDRESS, WETH_ABI, signer);
  return await weth.deposit({ value: amount });
}

// Unwrap WETH → ETH
async function unwrapETH(amount: bigint) {
  const weth = new ethers.Contract(WETH_ADDRESS, WETH_ABI, signer);
  return await weth.withdraw(amount);
}
```

**Required Inputs:** `amount`  
**Dependencies:** ethers.js, WETH ABI

---

### 2. Token Metadata Fetch

**Description:**  
Retrieves on-chain metadata for any ERC-20 token—name, symbol, decimals, total supply, and optionally logo from token lists.

**Integration:**

```typescript
async function getTokenMetadata(tokenAddress: string) {
  const token = new ethers.Contract(tokenAddress, ERC20_ABI, provider);

  const [name, symbol, decimals, totalSupply] = await Promise.all([
    token.name(),
    token.symbol(),
    token.decimals(),
    token.totalSupply(),
  ]);

  // Optional: Fetch logo from CoinGecko or token list
  const logo = await fetchLogoFromTokenList(tokenAddress);

  return { name, symbol, decimals, totalSupply, logo };
}
```

**Required Inputs:** `tokenAddress`  
**Dependencies:** ERC20 ABI, Token list API (optional)

---

### 3. Transaction Status

**Description:**  
Queries the blockchain for a transaction's current state—pending, confirmed, or failed—with confirmation count and decoded events.

**Integration:**

```typescript
async function getTransactionStatus(txHash: string) {
  const receipt = await provider.getTransactionReceipt(txHash);

  if (!receipt) {
    return { status: "pending", confirmations: 0 };
  }

  const currentBlock = await provider.getBlockNumber();
  const confirmations = currentBlock - receipt.blockNumber;

  return {
    status: receipt.status === 1 ? "confirmed" : "failed",
    confirmations,
    gasUsed: receipt.gasUsed.toString(),
    blockNumber: receipt.blockNumber,
    logs: receipt.logs, // Can decode with ABI
  };
}
```

**Required Inputs:** `txHash`  
**Dependencies:** ethers.js provider

---

### 4. Wallet History

**Description:**  
Fetches recent transaction history for a wallet using indexer APIs. Returns transfers, contract interactions, and token movements.

**Integration:**

```typescript
// Using Arbiscan API
async function getWalletHistory(address: string, page = 1) {
  const response = await fetch(
    `https://api.arbiscan.io/api?module=account&action=txlist&address=${address}&page=${page}&offset=20&sort=desc&apikey=${ARBISCAN_KEY}`,
  );

  const data = await response.json();
  return data.result.map((tx) => ({
    hash: tx.hash,
    from: tx.from,
    to: tx.to,
    value: tx.value,
    timestamp: tx.timeStamp,
    method: tx.functionName,
  }));
}
```

**Required Inputs:** `address`, `page` (optional)  
**Dependencies:** Arbiscan API key or Alchemy/The Graph

---

### 5. Multi-Token Balance

**Description:**  
Batch-fetches balances for multiple tokens in a single multicall, reducing RPC calls from N to 1.

**Integration:**

```typescript
import { Multicall } from "ethereum-multicall";

async function getMultiTokenBalances(wallet: string, tokens: string[]) {
  const multicall = new Multicall({ ethersProvider: provider });

  const calls = tokens.map((token) => ({
    reference: token,
    contractAddress: token,
    abi: ERC20_ABI,
    calls: [{ methodName: "balanceOf", methodParameters: [wallet] }],
  }));

  const results = await multicall.call(calls);

  return tokens.map((token) => ({
    token,
    balance: results.results[token].callsReturnContext[0].returnValues[0],
  }));
}
```

**Required Inputs:** `wallet`, `tokens[]`  
**Dependencies:** ethereum-multicall, ERC20 ABI

---

## 🌉 Arbitrum-Specific Tools

### 6. Bridge Status

**Description:**  
Checks cross-chain bridge transaction status between L1↔L2. Tracks deposit availability and withdrawal challenge periods.

**Integration:**

```typescript
import { L1ToL2MessageStatus, L1TransactionReceipt } from "@arbitrum/sdk";

async function checkBridgeStatus(l1TxHash: string) {
  const l1Receipt = await l1Provider.getTransactionReceipt(l1TxHash);
  const l1TxReceipt = new L1TransactionReceipt(l1Receipt);

  const messages = await l1TxReceipt.getL1ToL2Messages(l2Provider);
  const message = messages[0];

  const status = await message.status();

  return {
    status: L1ToL2MessageStatus[status],
    retryableTicketId: message.retryableCreationId,
    isRedeemed: status === L1ToL2MessageStatus.REDEEMED,
  };
}
```

**Required Inputs:** `l1TxHash`  
**Dependencies:** @arbitrum/sdk, L1 + L2 providers

---

### 7. Retryable Ticket Status

**Description:**  
Monitors retryable tickets and handles redemption if auto-execution failed. Critical for recovering stuck bridge deposits.

**Integration:**

```typescript
import { L1ToL2MessageReader } from "@arbitrum/sdk";

async function checkRetryableTicket(ticketId: string) {
  const message = new L1ToL2MessageReader(l2Provider, ticketId);

  const status = await message.status();
  const timeout = await message.getTimeout();

  if (status === L1ToL2MessageStatus.FUNDS_DEPOSITED_ON_L2) {
    // Needs manual redemption
    const redeemTx = await message.redeem();
    return { status: "redeemed", txHash: redeemTx.hash };
  }

  return { status, expiresAt: timeout };
}
```

**Required Inputs:** `ticketId`  
**Dependencies:** @arbitrum/sdk

---

### 8. L2 Gas Estimator

**Description:**  
Estimates Arbitrum-specific gas costs including L2 execution + L1 calldata posting costs.

**Integration:**

```typescript
import { L2TransactionReceipt, L2ToL1MessageStatus } from "@arbitrum/sdk";

async function estimateL2Gas(tx: TransactionRequest) {
  // L2 execution gas
  const l2Gas = await l2Provider.estimateGas(tx);

  // L1 calldata cost (Arbitrum specific)
  const nodeInterface = new ethers.Contract(
    "0x00000000000000000000000000000000000000C8",
    NODE_INTERFACE_ABI,
    l2Provider,
  );

  const [gasEstimate] = await nodeInterface.gasEstimateL1Component(
    tx.to,
    false,
    tx.data,
  );

  return {
    l2Gas: l2Gas.toString(),
    l1DataCost: gasEstimate.toString(),
    totalGas: (l2Gas + gasEstimate).toString(),
  };
}
```

**Required Inputs:** `tx` (transaction object)  
**Dependencies:** @arbitrum/sdk, Node Interface ABI

---

## 📊 DeFi Tools

### 9. Swap (DEX Router)

**Description:**  
Executes token swaps through Uniswap V3 or Camelot with slippage protection and MEV-aware routing.

**Integration:**

```typescript
import { AlphaRouter, SwapType } from "@uniswap/smart-order-router";

async function executeSwap(
  tokenIn: string,
  tokenOut: string,
  amountIn: bigint,
  slippageTolerance: number, // e.g., 0.5 for 0.5%
) {
  const router = new AlphaRouter({ chainId: 42161, provider });

  const route = await router.route(
    CurrencyAmount.fromRawAmount(tokenIn, amountIn.toString()),
    tokenOut,
    TradeType.EXACT_INPUT,
    {
      type: SwapType.SWAP_ROUTER_02,
      recipient: walletAddress,
      slippageTolerance: new Percent(slippageTolerance * 100, 10000),
      deadline: Math.floor(Date.now() / 1000) + 1800,
    },
  );

  const tx = await signer.sendTransaction({
    to: route.methodParameters.to,
    data: route.methodParameters.calldata,
    value: route.methodParameters.value,
  });

  return tx;
}
```

**Required Inputs:** `tokenIn`, `tokenOut`, `amountIn`, `slippageTolerance`  
**Dependencies:** @uniswap/smart-order-router or Camelot SDK

---

### 10. Get Quote

**Description:**  
Fetches swap quotes without executing—shows expected output, price impact, and route.

**Integration:**

```typescript
async function getSwapQuote(
  tokenIn: string,
  tokenOut: string,
  amountIn: bigint,
) {
  const router = new AlphaRouter({ chainId: 42161, provider });

  const route = await router.route(
    CurrencyAmount.fromRawAmount(tokenIn, amountIn.toString()),
    tokenOut,
    TradeType.EXACT_INPUT,
  );

  return {
    amountOut: route.quote.toFixed(),
    priceImpact: route.trade.priceImpact.toFixed(2) + "%",
    route: route.route.map((r) => r.tokenPath.map((t) => t.symbol)),
    estimatedGas: route.estimatedGasUsed.toString(),
  };
}
```

**Required Inputs:** `tokenIn`, `tokenOut`, `amountIn`  
**Dependencies:** DEX SDK or 1inch API

---

### 11. Allowance Check

**Description:**  
Reads current ERC-20 allowance granted to a spender contract.

**Integration:**

```typescript
async function checkAllowance(token: string, owner: string, spender: string) {
  const tokenContract = new ethers.Contract(token, ERC20_ABI, provider);
  const allowance = await tokenContract.allowance(owner, spender);

  const decimals = await tokenContract.decimals();

  return {
    raw: allowance.toString(),
    formatted: ethers.formatUnits(allowance, decimals),
    isUnlimited: allowance >= ethers.MaxUint256 / 2n,
  };
}
```

**Required Inputs:** `token`, `owner`, `spender`  
**Dependencies:** ERC20 ABI

---

### 12. Approve Token

**Description:**  
Grants spending approval to a contract. Supports exact amounts or unlimited approval.

**Integration:**

```typescript
async function approveToken(
  token: string,
  spender: string,
  amount: bigint | "unlimited",
) {
  const tokenContract = new ethers.Contract(token, ERC20_ABI, signer);

  const approveAmount = amount === "unlimited" ? ethers.MaxUint256 : amount;

  const tx = await tokenContract.approve(spender, approveAmount);
  return tx;
}
```

**Required Inputs:** `token`, `spender`, `amount`  
**Dependencies:** ERC20 ABI, signer

---

### 13. Revoke Approval

**Description:**  
Sets allowance to zero, removing a contract's ability to spend tokens.

**Integration:**

```typescript
async function revokeApproval(token: string, spender: string) {
  const tokenContract = new ethers.Contract(token, ERC20_ABI, signer);
  const tx = await tokenContract.approve(spender, 0);
  return tx;
}

// Batch revoke using multicall
async function batchRevokeApprovals(
  revocations: { token: string; spender: string }[],
) {
  const multicall = new ethers.Contract(
    MULTICALL_ADDRESS,
    MULTICALL_ABI,
    signer,
  );

  const calls = revocations.map((r) => ({
    target: r.token,
    callData: ERC20_INTERFACE.encodeFunctionData("approve", [r.spender, 0]),
  }));

  return await multicall.aggregate(calls);
}
```

**Required Inputs:** `token`, `spender`  
**Dependencies:** ERC20 ABI, Multicall (for batch)

---

## 🎨 NFT Tools

### 14. Fetch NFT Metadata

**Description:**  
Retrieves NFT metadata including image, traits, and collection info.

**Integration:**

```typescript
async function getNFTMetadata(contractAddress: string, tokenId: string) {
  const nft = new ethers.Contract(contractAddress, ERC721_ABI, provider);

  const tokenURI = await nft.tokenURI(tokenId);
  const owner = await nft.ownerOf(tokenId);

  // Resolve IPFS URI
  const metadataURL = tokenURI.startsWith("ipfs://")
    ? `https://ipfs.io/ipfs/${tokenURI.slice(7)}`
    : tokenURI;

  const response = await fetch(metadataURL);
  const metadata = await response.json();

  return {
    name: metadata.name,
    description: metadata.description,
    image: metadata.image,
    attributes: metadata.attributes,
    owner,
  };
}
```

**Required Inputs:** `contractAddress`, `tokenId`  
**Dependencies:** ERC721 ABI, IPFS gateway

---

### 15. Transfer NFT

**Description:**  
Safely transfers ERC-721 or ERC-1155 NFTs using `safeTransferFrom`.

**Integration:**

```typescript
async function transferNFT(
  contractAddress: string,
  tokenId: string,
  to: string,
  standard: "ERC721" | "ERC1155" = "ERC721",
  amount: number = 1,
) {
  const nft = new ethers.Contract(
    contractAddress,
    standard === "ERC721" ? ERC721_ABI : ERC1155_ABI,
    signer,
  );

  const from = await signer.getAddress();

  if (standard === "ERC721") {
    return await nft["safeTransferFrom(address,address,uint256)"](
      from,
      to,
      tokenId,
    );
  } else {
    return await nft.safeTransferFrom(from, to, tokenId, amount, "0x");
  }
}
```

**Required Inputs:** `contractAddress`, `tokenId`, `to`, `standard`, `amount` (for ERC1155)  
**Dependencies:** ERC721/ERC1155 ABI, signer

---

### 16. Check NFT Ownership

**Description:**  
Verifies if an address owns a specific NFT.

**Integration:**

```typescript
async function checkNFTOwnership(
  contractAddress: string,
  tokenId: string,
  address: string,
  standard: "ERC721" | "ERC1155" = "ERC721",
) {
  const nft = new ethers.Contract(
    contractAddress,
    standard === "ERC721" ? ERC721_ABI : ERC1155_ABI,
    provider,
  );

  if (standard === "ERC721") {
    const owner = await nft.ownerOf(tokenId);
    return { owns: owner.toLowerCase() === address.toLowerCase(), balance: 1 };
  } else {
    const balance = await nft.balanceOf(address, tokenId);
    return { owns: balance > 0, balance: balance.toString() };
  }
}
```

**Required Inputs:** `contractAddress`, `tokenId`, `address`  
**Dependencies:** ERC721/ERC1155 ABI

---

## 🔔 Utility Tools

### 17. ENS/Arbid Resolve

**Description:**  
Bidirectional name resolution—converts names to addresses and addresses to names.

**Integration:**

```typescript
async function resolveName(nameOrAddress: string) {
  // Check if input is an address
  if (ethers.isAddress(nameOrAddress)) {
    // Reverse lookup
    const name = await provider.lookupAddress(nameOrAddress);
    return { address: nameOrAddress, name: name || null };
  }

  // Forward lookup
  const address = await provider.resolveName(nameOrAddress);
  return { address, name: nameOrAddress };
}
```

**Required Inputs:** `nameOrAddress`  
**Dependencies:** ENS-compatible provider

---

### 18. Sign Message

**Description:**  
Signs an arbitrary message for authentication or off-chain verification.

**Integration:**

```typescript
async function signMessage(message: string) {
  const signature = await signer.signMessage(message);
  const address = await signer.getAddress();

  return {
    message,
    signature,
    signer: address,
  };
}

// Verify signature (for backend)
function verifySignature(message: string, signature: string) {
  return ethers.verifyMessage(message, signature);
}
```

**Required Inputs:** `message`  
**Dependencies:** Wallet signer

---

### 19. Contract Read

**Description:**  
Generic read-only call to any verified smart contract.

**Integration:**

```typescript
async function contractRead(
  contractAddress: string,
  functionName: string,
  params: any[] = [],
) {
  // Fetch ABI from Arbiscan if not cached
  const abi = await fetchABI(contractAddress);

  const contract = new ethers.Contract(contractAddress, abi, provider);

  const result = await contract[functionName](...params);

  return { result };
}

async function fetchABI(address: string) {
  const response = await fetch(
    `https://api.arbiscan.io/api?module=contract&action=getabi&address=${address}&apikey=${ARBISCAN_KEY}`,
  );
  const data = await response.json();
  return JSON.parse(data.result);
}
```

**Required Inputs:** `contractAddress`, `functionName`, `params`  
**Dependencies:** Arbiscan API for ABI fetching

---

### 20. Contract Write

**Description:**  
Executes state-changing transactions on any verified contract.

**Integration:**

```typescript
async function contractWrite(
  contractAddress: string,
  functionName: string,
  params: any[] = [],
  value: bigint = 0n,
) {
  const abi = await fetchABI(contractAddress);
  const contract = new ethers.Contract(contractAddress, abi, signer);

  const tx = await contract[functionName](...params, { value });
  const receipt = await tx.wait();

  return {
    txHash: tx.hash,
    status: receipt.status === 1 ? "success" : "failed",
    gasUsed: receipt.gasUsed.toString(),
  };
}
```

**Required Inputs:** `contractAddress`, `functionName`, `params`, `value` (optional)  
**Dependencies:** Arbiscan API, signer

---

## 🏗️ Architecture: How to Add a New Tool

### 1. Define Tool Schema

```typescript
// tools/schemas/wrapEth.ts
export const wrapEthSchema = {
  name: "wrap_eth",
  description: "Convert ETH to WETH for DEX compatibility",
  parameters: {
    type: "object",
    properties: {
      amount: {
        type: "string",
        description: "Amount of ETH to wrap (in ETH, not wei)",
      },
    },
    required: ["amount"],
  },
};
```

### 2. Implement Handler

```typescript
// tools/handlers/wrapEth.ts
export async function handleWrapEth(
  params: { amount: string },
  context: ToolContext,
) {
  const weth = new ethers.Contract(WETH_ADDRESS, WETH_ABI, context.signer);
  const amountWei = ethers.parseEther(params.amount);

  const tx = await weth.deposit({ value: amountWei });
  const receipt = await tx.wait();

  return {
    success: true,
    txHash: tx.hash,
    amountWrapped: params.amount,
  };
}
```

### 3. Register Tool

```typescript
// tools/registry.ts
import { wrapEthSchema } from "./schemas/wrapEth";
import { handleWrapEth } from "./handlers/wrapEth";

export const toolRegistry = {
  wrap_eth: { schema: wrapEthSchema, handler: handleWrapEth },
  // ... other tools
};
```

### 4. Add to Agent Pipeline

```typescript
// agent/tools.ts
export function getAvailableTools() {
  return Object.values(toolRegistry).map((t) => t.schema);
}

export async function executeTool(
  name: string,
  params: any,
  context: ToolContext,
) {
  const tool = toolRegistry[name];
  if (!tool) throw new Error(`Unknown tool: ${name}`);
  return await tool.handler(params, context);
}
```

---

## 📦 Dependency Summary

| Package                       | Tools Using It                          |
| ----------------------------- | --------------------------------------- |
| `ethers`                      | All tools                               |
| `@arbitrum/sdk`               | Bridge Status, Retryable Ticket, L2 Gas |
| `@uniswap/smart-order-router` | Swap, Get Quote                         |
| `ethereum-multicall`          | Multi-Token Balance, Batch Revoke       |

---

## 🔐 Security Considerations

1. **Never expose private keys**—use session signers or wallet connectors
2. **Validate spender addresses** against known scam contracts before approvals
3. **Simulate transactions** with Tenderly before executing high-value operations
4. **Rate limit** API calls to avoid getting blocked
5. **Handle reverts gracefully** and decode revert reasons for user feedback
