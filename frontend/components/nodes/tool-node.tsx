"use client"

import { memo } from "react"
import { Handle, Position, type NodeProps } from "reactflow"
import {
  ArrowRightLeft,
  RefreshCw,
  Wallet,
  Coins,
  Image as ImageIcon,
  Users,
  Gift,
  TrendingUp,
  PiggyBank,
  Repeat,
  FileText,
  Clock,
  History,
  CheckCircle,
  XCircle,
  Mail,
} from "lucide-react"
import type { NodeData } from "@/lib/types"

const toolIcons: Record<string, React.ReactNode> = {
  transfer: <ArrowRightLeft className="h-4 w-4" />,
  swap: <RefreshCw className="h-4 w-4" />,
  get_balance: <Wallet className="h-4 w-4" />,
  deploy_erc20: <Coins className="h-4 w-4" />,
  deploy_erc721: <ImageIcon className="h-4 w-4" />,
  create_dao: <Users className="h-4 w-4" />,
  airdrop: <Gift className="h-4 w-4" />,
  fetch_price: <TrendingUp className="h-4 w-4" />,
  deposit_yield: <PiggyBank className="h-4 w-4" />,
  wrap_eth: <Repeat className="h-4 w-4" />,
  token_metadata: <FileText className="h-4 w-4" />,
  tx_status: <Clock className="h-4 w-4" />,
  wallet_history: <History className="h-4 w-4" />,
  approve_token: <CheckCircle className="h-4 w-4" />,
  revoke_approval: <XCircle className="h-4 w-4" />,
  send_email: <Mail className="h-4 w-4" />,
}

const toolColors: Record<string, { border: string; bg: string; text: string }> = {
  transfer: { border: "border-foreground/40", bg: "bg-foreground/5", text: "text-foreground" },
  swap: { border: "border-foreground/50", bg: "bg-foreground/10", text: "text-foreground" },
  get_balance: { border: "border-foreground/60", bg: "bg-foreground/15", text: "text-foreground" },
  deploy_erc20: { border: "border-foreground/40", bg: "bg-foreground/5", text: "text-foreground" },
  deploy_erc721: { border: "border-foreground/50", bg: "bg-foreground/10", text: "text-foreground" },
  create_dao: { border: "border-foreground/60", bg: "bg-foreground/15", text: "text-foreground" },
  airdrop: { border: "border-foreground/40", bg: "bg-foreground/5", text: "text-foreground" },
  fetch_price: { border: "border-foreground/50", bg: "bg-foreground/10", text: "text-foreground" },
  deposit_yield: { border: "border-foreground/60", bg: "bg-foreground/15", text: "text-foreground" },
  wrap_eth: { border: "border-foreground/40", bg: "bg-foreground/5", text: "text-foreground" },
  token_metadata: { border: "border-foreground/50", bg: "bg-foreground/10", text: "text-foreground" },
  tx_status: { border: "border-foreground/60", bg: "bg-foreground/15", text: "text-foreground" },
  wallet_history: { border: "border-foreground/40", bg: "bg-foreground/5", text: "text-foreground" },
  approve_token: { border: "border-foreground/50", bg: "bg-foreground/10", text: "text-foreground" },
  revoke_approval: { border: "border-foreground/60", bg: "bg-foreground/15", text: "text-foreground" },
  send_email: { border: "border-foreground/40", bg: "bg-foreground/5", text: "text-foreground" },
}

export const ToolNode = memo(({ data, type, isConnectable }: NodeProps<NodeData>) => {
  const colors = toolColors[type || ""] || { border: "border-foreground/30", bg: "bg-foreground/5", text: "text-foreground" }
  const icon = toolIcons[type || ""] || null

  return (
    <div className={`px-4 py-2 shadow-md rounded-md bg-background border-2 ${colors.border} min-w-[150px]`}>
      <div className="flex items-center">
        <div className={`rounded-full w-8 h-8 flex items-center justify-center ${colors.bg} ${colors.text}`}>
          {icon}
        </div>
        <div className="ml-2">
          <div className="text-sm font-bold">{data.label || type}</div>
          <div className="text-xs text-muted-foreground">{data.description || "Tool"}</div>
        </div>
      </div>

      <Handle type="target" position={Position.Top} isConnectable={isConnectable} className="w-3 h-3" />
      <Handle type="source" position={Position.Bottom} isConnectable={isConnectable} className="w-3 h-3" />
    </div>
  )
})

ToolNode.displayName = "ToolNode"

