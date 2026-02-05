/**
 * Backend Service
 * 
 * This module provides utilities for interacting with the backend services:
 * 1. AI Agent Backend (n8n_agent_backend) - Port 8000 - FastAPI
 * 2. Blockchain Backend (backend) - Port 3000 - Express
 */

import type { 
  AgentChatRequest, 
  AgentChatResponse, 
  BackendHealthResponse 
} from './types'

// Backend URLs from environment
const AI_AGENT_BACKEND_URL = process.env.NEXT_PUBLIC_AI_AGENT_BACKEND_URL || 'http://localhost:8000'
const BLOCKCHAIN_BACKEND_URL = process.env.NEXT_PUBLIC_BLOCKCHAIN_BACKEND_URL || 'http://localhost:3000'

/**
 * Send a chat message to the AI agent
 * Sends request directly to AI Agent Backend (port 8000)
 * The request format matches TEST_REQUESTS.md from n8n_agent_backend
 */
export async function sendAgentChatMessage(
  tools: Array<{ tool: string; next_tool: string | null }>,
  userMessage: string,
  privateKey?: string
): Promise<AgentChatResponse> {
  const response = await fetch(`${AI_AGENT_BACKEND_URL}/agent/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      tools: tools,
      user_message: userMessage,
      private_key: privateKey,
    }),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(errorData.error || errorData.detail || `Request failed with status ${response.status}`)
  }

  return response.json()
}



/**
 * Check health of AI Agent Backend
 */
export async function checkAgentBackendHealth(): Promise<BackendHealthResponse> {
  const response = await fetch(`${AI_AGENT_BACKEND_URL}/health`)
  
  if (!response.ok) {
    throw new Error('AI Agent Backend is not responding')
  }

  return response.json()
}

/**
 * Check health of Blockchain Backend
 */
export async function checkBlockchainBackendHealth(): Promise<BackendHealthResponse> {
  const response = await fetch(`${BLOCKCHAIN_BACKEND_URL}/health`)
  
  if (!response.ok) {
    throw new Error('Blockchain Backend is not responding')
  }

  return response.json()
}

/**
 * List all available tools from AI Agent Backend
 */
export async function listAvailableTools(): Promise<{
  tools: string[]
  details: Record<string, any>
}> {
  const response = await fetch(`${AI_AGENT_BACKEND_URL}/tools`)
  
  if (!response.ok) {
    throw new Error('Failed to fetch available tools')
  }

  return response.json()
}

/**
 * Get backend URLs (for debugging)
 */
export function getBackendUrls() {
  return {
    aiAgentBackend: AI_AGENT_BACKEND_URL,
    blockchainBackend: BLOCKCHAIN_BACKEND_URL,
  }
}

// Export backend URLs as constants
export { AI_AGENT_BACKEND_URL, BLOCKCHAIN_BACKEND_URL }
