"use client"

import { memo } from "react"
import { Handle, Position, type NodeProps } from "reactflow"
import { Bot } from "lucide-react"
import type { NodeData } from "@/lib/types"

export const AgentNode = memo(({ data, isConnectable }: NodeProps<NodeData>) => {
  return (
    <div 
      className="shadow-md rounded-md p-1 w-[120px] h-[120px]"
      style={{
        background: 'linear-gradient(to bottom right, oklch(0.3 0 0), oklch(0.5 0 0), oklch(0.7 0 0))',
      }}
    >
      <div className="w-full h-full bg-background rounded-md flex flex-col items-center justify-center gap-2">
        <Bot className="h-8 w-8 text-foreground" />
        <div className="text-sm font-bold text-foreground">Agent</div>
        <Handle type="source" position={Position.Bottom} isConnectable={isConnectable} className="w-3 h-3" />
      </div>
    </div>
  )
})

AgentNode.displayName = "AgentNode"

