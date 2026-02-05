/**
 * Contract Backend Service
 * 
 * This module provides utilities for interacting with the blockchain backend's
 * Natural Language Executor endpoints for smart contract interaction.
 */

import { BLOCKCHAIN_BACKEND_URL } from './backend'

/**
 * Contract Function Interface
 */
export interface ContractFunction {
  index: number
  name: string
  signature: string
  stateMutability: string
  inputs: Array<{
    name: string
    type: string
    internalType?: string
  }>
  outputs: Array<{
    name: string
    type: string
    internalType?: string
  }>
}

/**
 * Contract Discovery Response
 */
export interface ContractDiscoveryResponse {
  success: boolean
  data: {
    contractAddress: string
    totalFunctions: number
    readFunctions: string[]
    writeFunctions: string[]
    allFunctions: ContractFunction[]
  }
  message?: string
}

/**
 * Execution Plan
 */
export interface ExecutionPlan {
  contractAddress: string
  functionName: string
  signature: string
  parameters: Array<{
    name: string
    type: string
    rawValue: string
    formattedValue: string
  }>
  reasoning: string
  isReadOnly: boolean
}

/**
 * Command Execution Response
 */
export interface CommandExecutionResponse {
  success: boolean
  data: {
    message?: string
    executionPlan: ExecutionPlan
    confirmation?: string
    result?: string
    type?: string
    transaction?: {
      hash: string
      blockNumber: number
      gasUsed: string
      status: string
      explorerUrl: string
    }
  }
  message?: string
  error?: string
}

/**
 * Discover contract functions from a contract address
 * Calls GET /nl-executor/discover/:contractAddress
 */
export async function discoverContract(
  contractAddress: string
): Promise<ContractDiscoveryResponse> {
  const response = await fetch(
    `${BLOCKCHAIN_BACKEND_URL}/nl-executor/discover/${contractAddress}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ 
      error: 'Failed to discover contract' 
    }))
    // Use details field if available (contains more specific error message)
    const errorMessage = errorData.details || errorData.error || errorData.message || `Request failed with status ${response.status}`
    throw new Error(errorMessage)
  }

  return response.json()
}

/**
 * Execute a natural language command on a contract
 * Calls POST /nl-executor/execute
 */
export async function executeNaturalLanguageCommand(
  contractAddress: string,
  command: string,
  privateKey: string,
  confirmExecution: boolean = false,
  decimals: number = 18
): Promise<CommandExecutionResponse> {
  const response = await fetch(
    `${BLOCKCHAIN_BACKEND_URL}/nl-executor/execute`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contractAddress,
        command,
        privateKey,
        confirmExecution,
        decimals,
      }),
    }
  )

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ 
      error: 'Failed to execute command' 
    }))
    // Use details field if available (contains more specific error message)
    const errorMessage = errorData.details || errorData.error || errorData.message || `Request failed with status ${response.status}`
    throw new Error(errorMessage)
  }

  return response.json()
}

/**
 * Quick execute a natural language command (auto-confirm)
 * Calls POST /nl-executor/quick-execute
 * Use with caution - automatically executes without confirmation
 */
export async function quickExecuteCommand(
  contractAddress: string,
  command: string,
  privateKey: string,
  decimals: number = 18
): Promise<CommandExecutionResponse> {
  const response = await fetch(
    `${BLOCKCHAIN_BACKEND_URL}/nl-executor/quick-execute`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contractAddress,
        command,
        privateKey,
        decimals,
      }),
    }
  )

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ 
      error: 'Failed to execute command' 
    }))
    // Use details field if available (contains more specific error message)
    const errorMessage = errorData.details || errorData.error || errorData.message || `Request failed with status ${response.status}`
    throw new Error(errorMessage)
  }

  return response.json()
}

/**
 * Helper to format function parameters for display
 */
export function formatFunctionSignature(func: ContractFunction): string {
  const inputs = func.inputs
    .map(input => `${input.name || 'param'}: ${input.type}`)
    .join(', ')
  
  const outputs = func.outputs && func.outputs.length > 0
    ? ' -> ' + func.outputs.map(output => output.type).join(', ')
    : ''
  
  return `${func.name}(${inputs})${outputs}`
}

/**
 * Helper to categorize functions by type
 */
export function categorizeFunctions(functions: ContractFunction[]): {
  read: ContractFunction[]
  write: ContractFunction[]
} {
  const read = functions.filter(f => 
    f.stateMutability === 'view' || f.stateMutability === 'pure'
  )
  const write = functions.filter(f => 
    f.stateMutability !== 'view' && f.stateMutability !== 'pure'
  )
  
  return { read, write }
}
