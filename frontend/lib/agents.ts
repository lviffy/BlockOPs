import { supabase, type Agent } from './supabase'

export async function createAgent(
  userId: string,
  name: string,
  description: string | null,
  tools: Array<{ tool: string; next_tool: string | null }>
): Promise<Agent> {
  // Generate random API key
  const apiKey = generateApiKey()

  const { data, error } = await supabase
    .from('agents')
    .insert({
      user_id: userId,
      name,
      description,
      api_key: apiKey,
      tools,
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create agent: ${error.message}`)
  }

  return data
}

export async function getAgentsByUserId(userId: string): Promise<Agent[]> {
  const { data, error } = await supabase
    .from('agents')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch agents: ${error.message}`)
  }

  return data || []
}

export async function getAgentById(agentId: string): Promise<Agent | null> {
  const { data, error } = await supabase
    .from('agents')
    .select('*')
    .eq('id', agentId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null // Not found
    }
    throw new Error(`Failed to fetch agent: ${error.message}`)
  }

  return data
}

export async function getAgentByApiKey(apiKey: string): Promise<Agent | null> {
  const { data, error } = await supabase
    .from('agents')
    .select('*')
    .eq('api_key', apiKey)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null // Not found
    }
    throw new Error(`Failed to fetch agent: ${error.message}`)
  }

  return data
}

export async function updateAgent(
  agentId: string,
  updates: {
    name?: string
    description?: string | null
    tools?: Array<{ tool: string; next_tool: string | null }>
  }
): Promise<Agent> {
  const { data, error } = await supabase
    .from('agents')
    .update(updates)
    .eq('id', agentId)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to update agent: ${error.message}`)
  }

  return data
}

export async function deleteAgent(agentId: string): Promise<void> {
  const { error } = await supabase.from('agents').delete().eq('id', agentId)

  if (error) {
    throw new Error(`Failed to delete agent: ${error.message}`)
  }
}

export async function cloneAgent(agentId: string, userId: string): Promise<Agent> {
  const newKey = generateApiKey()

  const { data: source, error: fetchErr } = await supabase
    .from('agents')
    .select('*')
    .eq('id', agentId)
    .single()

  if (fetchErr || !source) {
    throw new Error('Agent not found')
  }

  const { data, error } = await supabase
    .from('agents')
    .insert({
      user_id: userId,
      name: `${source.name} (Copy)`,
      description: source.description,
      api_key: newKey,
      tools: source.tools,
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to clone agent: ${error.message}`)
  }

  return data
}

export async function regenerateApiKey(agentId: string): Promise<string> {
  const newKey = generateApiKey()
  const { error } = await supabase
    .from('agents')
    .update({ api_key: newKey, updated_at: new Date().toISOString() })
    .eq('id', agentId)

  if (error) {
    throw new Error(`Failed to regenerate API key: ${error.message}`)
  }

  return newKey
}

function generateApiKey(): string {
  // Generate a random 32-character API key
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

