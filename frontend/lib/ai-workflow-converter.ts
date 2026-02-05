import type { Node, Edge } from 'reactflow'
import { createNode, generateNodeId } from './workflow-utils'

// Map AI tool types to our in-app tool types
const toolTypeMap: Record<string, string> = {
  transfer: 'transfer',
  swap: 'swap',
  stt_balance_fetch: 'get_balance',
  deploy_erc20: 'deploy_erc20',
  deploy_erc721: 'deploy_erc721',
  create_dao: 'create_dao',
  airdrop: 'airdrop',
  fetch_token_price: 'fetch_price',
  deposit_with_yield_prediction: 'deposit_yield',
}

interface AITool {
  id: string
  type: string
  name: string
  next_tools: string[]
}

interface AIResponse {
  agent_id: string
  tools: AITool[]
  has_sequential_execution: boolean
  description: string
  raw_response?: string
}

/**
 * Convert AI response format to ReactFlow nodes and edges
 */
export function aiResponseToWorkflow(aiResponse: AIResponse): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = []
  const edges: Edge[] = []
  
  // Create a map of AI tool IDs to our node IDs
  const toolIdToNodeId = new Map<string, string>()
  
  // Create nodes with proper positioning
  aiResponse.tools.forEach((tool, index) => {
    // Map AI tool type to our tool type
    const ourToolType = toolTypeMap[tool.type] || tool.type
    
    // Check if this tool type exists in our system
    const validToolTypes = [
      'transfer',
      'swap',
      'get_balance',
      'deploy_erc20',
      'deploy_erc721',
      'create_dao',
      'airdrop',
      'fetch_price',
      'deposit_yield',
    ]
    
    if (!validToolTypes.includes(ourToolType)) {
      console.warn(`Unknown tool type from AI: ${tool.type} (mapped to: ${ourToolType})`)
      return
    }
    
    const nodeId = generateNodeId(ourToolType)
    toolIdToNodeId.set(tool.id, nodeId)
    
    // Position nodes in a grid layout
    const row = Math.floor(index / 3)
    const col = index % 3
    const position = {
      x: col * 250 + 100,
      y: row * 150 + 100,
    }
    
    const node = createNode({
      type: ourToolType,
      position,
      id: nodeId,
    })
    
    // Update label with AI-provided name if available
    if (tool.name) {
      node.data.label = tool.name
    }
    
    nodes.push(node)
  })
  
  // Create edges based on next_tools relationships
  aiResponse.tools.forEach((tool) => {
    const sourceNodeId = toolIdToNodeId.get(tool.id)
    if (!sourceNodeId) return
    
    tool.next_tools.forEach((nextToolId) => {
      const targetNodeId = toolIdToNodeId.get(nextToolId)
      if (targetNodeId) {
        edges.push({
          id: `edge-${sourceNodeId}-${targetNodeId}`,
          source: sourceNodeId,
          target: targetNodeId,
          type: 'custom',
        })
      }
    })
  })
  
  return { nodes, edges }
}

/**
 * Check if a response is a valid AI workflow response
 */
export function isValidAIWorkflowResponse(data: any): data is AIResponse {
  return (
    data &&
    typeof data === 'object' &&
    Array.isArray(data.tools) &&
    data.tools.length > 0 &&
    data.tools.every(
      (tool: any) =>
        tool &&
        typeof tool.id === 'string' &&
        typeof tool.type === 'string' &&
        Array.isArray(tool.next_tools)
    )
  )
}

