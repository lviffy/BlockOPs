import type { Node, XYPosition } from "reactflow"
import type { NodeData } from "./types"

let toolIdCounter = 0

export const generateNodeId = (type: string): string => {
  toolIdCounter++
  return `${type}-${toolIdCounter}`
}

export const createNode = ({
  type,
  position,
  id,
}: {
  type: string
  position: XYPosition
  id: string
}): Node<NodeData> => {
  return {
    id,
    type,
    position,
    data: {
      label: getDefaultLabel(type),
      description: getDefaultDescription(type),
      config: {},
    },
  }
}

const getDefaultLabel = (type: string): string => {
  const labels: Record<string, string> = {
    transfer: "Transfer",
    swap: "Swap",
    get_balance: "Get Balance",
    deploy_erc20: "Deploy ERC-20",
    deploy_erc721: "Deploy ERC-721",
    create_dao: "Create DAO",
    airdrop: "Airdrop",
    fetch_price: "Fetch Price",
    deposit_yield: "Deposit Yield",
    wrap_eth: "Wrap ETH",
    token_metadata: "Token Metadata",
    tx_status: "Transaction Status",
    wallet_history: "Wallet History",
    approve_token: "Approve Token",
    revoke_approval: "Revoke Approval",
  }
  return labels[type] || "Tool"
}

const getDefaultDescription = (type: string): string => {
  const descriptions: Record<string, string> = {
    transfer: "Transfer tokens or assets",
    swap: "Swap tokens",
    get_balance: "Get wallet balance",
    deploy_erc20: "Deploy ERC-20 token",
    deploy_erc721: "Deploy ERC-721 NFT",
    create_dao: "Create a new DAO",
    airdrop: "Airdrop tokens to addresses",
    fetch_price: "Fetch token price",
    deposit_yield: "Deposit to yield farming",
    wrap_eth: "Convert ETH ↔ WETH",
    token_metadata: "Get token info",
    tx_status: "Check tx confirmations",
    wallet_history: "Fetch recent transactions",
    approve_token: "Grant spending approval",
    revoke_approval: "Remove token allowance",
  }
  return descriptions[type] || "Workflow tool"
}
