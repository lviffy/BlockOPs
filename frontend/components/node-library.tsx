"use client"

import type React from "react"
import {
  ArrowRightLeft,
  Wallet,
  Coins,
  Image as ImageIcon,
  TrendingUp,
  BarChart3,
} from "lucide-react"

const toolTypes = [
  {
    type: "transfer",
    label: "Transfer",
    description: "Transfer tokens or assets",
    icon: ArrowRightLeft,
  },
  {
    type: "get_balance",
    label: "Get Balance",
    description: "Get wallet balance",
    icon: Wallet,
  },
  {
    type: "deploy_erc20",
    label: "Deploy ERC-20",
    description: "Deploy ERC-20 token",
    icon: Coins,
  },
  {
    type: "deploy_erc721",
    label: "Deploy ERC-721",
    description: "Deploy ERC-721 NFT",
    icon: ImageIcon,
  },
  {
    type: "fetch_price",
    label: "Fetch Price",
    description: "Fetch token price",
    icon: TrendingUp,
  },
  {
    type: "wallet_analytics",
    label: "Wallet Analytics",
    description: "Analyze wallet data",
    icon: BarChart3,
  },
]

export default function NodeLibrary() {
  const onDragStart = (event: React.DragEvent<HTMLDivElement>, toolType: string) => {
    event.dataTransfer.setData("application/reactflow", toolType)
    event.dataTransfer.effectAllowed = "move"
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-neutral-200">
        <h2 className="text-sm font-medium text-neutral-900 tracking-tight">Tools</h2>
      </div>

      {/* Tools List */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-2 space-y-1">
          {toolTypes.map((tool) => {
            const Icon = tool.icon
            return (
              <div
                key={tool.type}
                draggable={true}
                onDragStart={(e) => onDragStart(e, tool.type)}
                className="group cursor-grab active:cursor-grabbing px-3 py-2.5 rounded border border-neutral-200 bg-white hover:border-neutral-400 hover:shadow-sm transition-all duration-150"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 text-neutral-600 group-hover:text-neutral-900 transition-colors">
                    <Icon className="h-4 w-4" strokeWidth={1.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-neutral-900 tracking-tight">
                      {tool.label}
                    </div>
                    <div className="text-xs text-neutral-500 mt-0.5">
                      {tool.description}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-neutral-200 bg-neutral-50">
        <p className="text-xs text-neutral-500 leading-relaxed">
          Drag and drop tools to build your Agent
        </p>
      </div>
    </div>
  )
}
