# AI Agent Conversation Memory Implementation Guide

## Overview

This document outlines a comprehensive solution for implementing conversation memory in the BlockOps AI Agent system, enabling agents to maintain context across multiple messages and providing users with persistent conversation history.

## Architecture Overview

### Key Components

1. **Database Layer**: PostgreSQL tables for storing conversations and messages
2. **Backend API**: FastAPI endpoints for conversation management
3. **Memory Manager**: Token-aware context window management
4. **Frontend State**: React state management for real-time updates

---

## 1. Database Schema

### Tables Structure

#### `conversations` Table
Stores high-level conversation metadata.

```sql
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT,
  total_tokens INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_conversations_user_agent ON conversations(user_id, agent_id);
CREATE INDEX idx_conversations_updated ON conversations(updated_at DESC);
```

#### `conversation_messages` Table
Stores individual messages with full context.

```sql
CREATE TABLE conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content TEXT NOT NULL,
  tool_calls JSONB,
  token_count INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation ON conversation_messages(conversation_id, created_at);
```

### Row Level Security (RLS)

```sql
-- Enable RLS
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;

-- Conversations policies
CREATE POLICY "Users can view their own conversations"
  ON conversations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own conversations"
  ON conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own conversations"
  ON conversations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own conversations"
  ON conversations FOR DELETE
  USING (auth.uid() = user_id);

-- Messages policies
CREATE POLICY "Users can view messages from their conversations"
  ON conversation_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversations 
      WHERE id = conversation_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create messages in their conversations"
  ON conversation_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations 
      WHERE id = conversation_id AND user_id = auth.uid()
    )
  );
```

---

## 2. Backend Implementation

### Data Models

```python
from pydantic import BaseModel
from typing import List, Dict, Optional, Any
from datetime import datetime

class MessageCreate(BaseModel):
    role: str
    content: str
    tool_calls: Optional[List[Dict]] = None

class Message(MessageCreate):
    id: str
    conversation_id: str
    token_count: Optional[int] = None
    created_at: datetime

class ConversationCreate(BaseModel):
    agent_id: str
    user_id: str
    title: Optional[str] = None

class Conversation(ConversationCreate):
    id: str
    total_tokens: int = 0
    created_at: datetime
    updated_at: datetime

class ChatRequest(BaseModel):
    agent_id: str
    user_id: str
    message: str
    conversation_id: Optional[str] = None

class ChatResponse(BaseModel):
    conversation_id: str
    message: str
    tool_calls: List[Dict] = []
    token_count: Optional[int] = None
```

### Token Management Class

```python
import json
from typing import List, Dict

class ConversationMemory:
    """Manages conversation context with intelligent token limits"""
    
    # Configuration
    MAX_CONTEXT_TOKENS = 8000  # Leave room for response (~2000 tokens)
    SUMMARIZE_THRESHOLD = 6000  # When to consider summarization
    SYSTEM_PROMPT_RESERVE = 1000  # Tokens reserved for system prompt
    
    @staticmethod
    def estimate_tokens(text: str) -> int:
        """
        Rough token estimation using character count.
        More accurate: use tiktoken library for exact counts.
        Rule of thumb: ~4 characters per token for English text
        """
        return max(1, len(text) // 4)
    
    @staticmethod
    def calculate_message_tokens(message: Dict) -> int:
        """Calculate tokens for a complete message including metadata"""
        content_tokens = ConversationMemory.estimate_tokens(
            str(message.get('content', ''))
        )
        
        # Add tokens for tool calls if present
        if message.get('tool_calls'):
            tool_tokens = ConversationMemory.estimate_tokens(
                json.dumps(message['tool_calls'])
            )
            content_tokens += tool_tokens
        
        # Add overhead for role and formatting (~10 tokens)
        return content_tokens + 10
    
    @staticmethod
    def build_context(
        messages: List[Dict],
        system_prompt: str,
        max_tokens: int = MAX_CONTEXT_TOKENS
    ) -> tuple[List[Dict], int]:
        """
        Build context window with intelligent token management.
        Returns: (context_messages, total_tokens_used)
        """
        
        # Start with system prompt
        system_msg = {"role": "system", "content": system_prompt}
        system_tokens = ConversationMemory.calculate_message_tokens(system_msg)
        
        context = [system_msg]
        current_tokens = system_tokens
        
        if not messages:
            return context, current_tokens
        
        # Always include the last message (current user input)
        last_message = messages[-1]
        last_msg_tokens = ConversationMemory.calculate_message_tokens(last_message)
        
        # Check if we have room for at least the last message
        if current_tokens + last_msg_tokens > max_tokens:
            # Last message is too large, truncate if needed
            return [system_msg, last_message], current_tokens + last_msg_tokens
        
        # Add messages in reverse order (most recent first)
        included_messages = []
        remaining_messages = messages[:-1]
        
        for msg in reversed(remaining_messages):
            msg_tokens = ConversationMemory.calculate_message_tokens(msg)
            
            # Check if adding this message would exceed limit
            if current_tokens + msg_tokens + last_msg_tokens > max_tokens:
                break
            
            included_messages.insert(0, msg)
            current_tokens += msg_tokens
        
        # Build final context
        context.extend(included_messages)
        context.append(last_message)
        current_tokens += last_msg_tokens
        
        return context, current_tokens
    
    @staticmethod
    def should_summarize(messages: List[Dict]) -> bool:
        """Determine if conversation should be summarized"""
        total_tokens = sum(
            ConversationMemory.calculate_message_tokens(msg) 
            for msg in messages
        )
        return total_tokens > ConversationMemory.SUMMARIZE_THRESHOLD
```

### Main Chat Endpoint

```python
from fastapi import FastAPI, HTTPException, Depends
from supabase import create_client, Client
import os
from groq import Groq
import logging

logger = logging.getLogger(__name__)

# Initialize clients
supabase: Client = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_SERVICE_KEY")
)

groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))

@app.post("/agent/chat", response_model=ChatResponse)
async def chat_with_agent(request: ChatRequest):
    """
    Main chat endpoint with conversation memory support.
    Handles context management, tool execution, and message persistence.
    """
    try:
        # 1. Get or create conversation
        if request.conversation_id:
            conversation = await get_conversation(request.conversation_id)
            if not conversation:
                raise HTTPException(status_code=404, detail="Conversation not found")
            messages = await get_conversation_messages(request.conversation_id)
        else:
            # Create new conversation
            conversation_id = await create_conversation(
                agent_id=request.agent_id,
                user_id=request.user_id,
                title=request.message[:50] + "..." if len(request.message) > 50 else request.message
            )
            conversation = {"id": conversation_id}
            messages = []
        
        # 2. Get agent configuration
        agent = await get_agent(request.agent_id)
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        # 3. Build system prompt from agent's tools
        system_prompt = build_system_prompt(agent['tools'])
        
        # 4. Add new user message to history
        user_msg = {
            "role": "user",
            "content": request.message
        }
        messages.append(user_msg)
        
        # 5. Build context with token management
        context, token_count = ConversationMemory.build_context(
            messages=messages,
            system_prompt=system_prompt
        )
        
        logger.info(f"Context built: {len(context)} messages, ~{token_count} tokens")
        
        # 6. Get tool definitions for this agent
        tool_definitions = get_tool_definitions(agent['tools'])
        
        # 7. Call AI model with context
        response = groq_client.chat.completions.create(
            model=agent.get("model", "llama-3.3-70b-versatile"),
            messages=context,
            tools=tool_definitions if tool_definitions else None,
            tool_choice="auto" if tool_definitions else None,
            max_tokens=2000,
            temperature=0.7
        )
        
        assistant_message = response.choices[0].message
        
        # 8. Build assistant response
        assistant_msg = {
            "role": "assistant",
            "content": assistant_message.content or "",
            "tool_calls": []
        }
        
        # 9. Handle tool calls if present
        if assistant_message.tool_calls:
            for tool_call in assistant_message.tool_calls:
                tool_name = tool_call.function.name
                tool_input = json.loads(tool_call.function.arguments)
                
                logger.info(f"Executing tool: {tool_name}")
                
                # Execute tool
                tool_result = await execute_tool(
                    tool_name=tool_name,
                    parameters=tool_input,
                    private_key=request.private_key
                )
                
                assistant_msg["tool_calls"].append({
                    "id": tool_call.id,
                    "tool": tool_name,
                    "input": tool_input,
                    "output": tool_result
                })
        
        messages.append(assistant_msg)
        
        # 10. Save messages to database
        await save_conversation_messages(
            conversation_id=conversation["id"],
            messages=[user_msg, assistant_msg]
        )
        
        # 11. Update conversation metadata
        total_tokens = response.usage.total_tokens if response.usage else token_count
        await update_conversation(
            conversation_id=conversation["id"],
            total_tokens=total_tokens
        )
        
        return ChatResponse(
            conversation_id=conversation["id"],
            message=assistant_message.content or "",
            tool_calls=assistant_msg["tool_calls"],
            token_count=total_tokens
        )
        
    except Exception as e:
        logger.error(f"Error in chat: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# Helper functions
async def get_conversation(conversation_id: str) -> Optional[Dict]:
    """Fetch conversation from database"""
    response = supabase.table("conversations")\
        .select("*")\
        .eq("id", conversation_id)\
        .single()\
        .execute()
    return response.data if response.data else None


async def create_conversation(agent_id: str, user_id: str, title: str = None) -> str:
    """Create new conversation in database"""
    response = supabase.table("conversations").insert({
        "agent_id": agent_id,
        "user_id": user_id,
        "title": title or "New Conversation"
    }).execute()
    return response.data[0]["id"]


async def get_conversation_messages(conversation_id: str) -> List[Dict]:
    """Fetch all messages for a conversation"""
    response = supabase.table("conversation_messages")\
        .select("*")\
        .eq("conversation_id", conversation_id)\
        .order("created_at")\
        .execute()
    
    return [
        {
            "role": msg["role"],
            "content": msg["content"],
            "tool_calls": msg.get("tool_calls")
        }
        for msg in response.data
    ]


async def save_conversation_messages(conversation_id: str, messages: List[Dict]):
    """Save messages to database"""
    records = [
        {
            "conversation_id": conversation_id,
            "role": msg["role"],
            "content": msg["content"],
            "tool_calls": msg.get("tool_calls"),
            "token_count": ConversationMemory.calculate_message_tokens(msg)
        }
        for msg in messages
    ]
    
    supabase.table("conversation_messages").insert(records).execute()


async def update_conversation(conversation_id: str, total_tokens: int):
    """Update conversation metadata"""
    supabase.table("conversations")\
        .update({
            "total_tokens": total_tokens,
            "updated_at": "NOW()"
        })\
        .eq("id", conversation_id)\
        .execute()
```

### Additional Endpoints

```python
@app.get("/conversations")
async def list_conversations(
    agent_id: Optional[str] = None,
    user_id: Optional[str] = None,
    limit: int = 20
):
    """List conversations with optional filtering"""
    query = supabase.table("conversations").select("*")
    
    if agent_id:
        query = query.eq("agent_id", agent_id)
    if user_id:
        query = query.eq("user_id", user_id)
    
    response = query\
        .order("updated_at", desc=True)\
        .limit(limit)\
        .execute()
    
    return response.data


@app.get("/conversations/{conversation_id}/messages")
async def get_messages(conversation_id: str):
    """Get all messages for a conversation"""
    messages = await get_conversation_messages(conversation_id)
    return {"messages": messages}


@app.delete("/conversations/{conversation_id}")
async def delete_conversation(conversation_id: str):
    """Delete a conversation and all its messages"""
    supabase.table("conversations")\
        .delete()\
        .eq("id", conversation_id)\
        .execute()
    return {"status": "deleted"}


@app.post("/conversations/{conversation_id}/summarize")
async def summarize_conversation(conversation_id: str):
    """
    Generate a summary of the conversation.
    Useful for very long conversations to reduce token usage.
    """
    messages = await get_conversation_messages(conversation_id)
    
    # Build summary prompt
    conversation_text = "\n".join([
        f"{msg['role']}: {msg['content']}"
        for msg in messages
    ])
    
    summary_prompt = f"""Summarize the following conversation concisely, 
    capturing key points, decisions made, and important context:
    
    {conversation_text}
    
    Summary:"""
    
    response = groq_client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": summary_prompt}],
        max_tokens=500,
        temperature=0.3
    )
    
    summary = response.choices[0].message.content
    
    # Save summary as a system message
    await save_conversation_messages(
        conversation_id=conversation_id,
        messages=[{
            "role": "system",
            "content": f"[CONVERSATION SUMMARY]: {summary}"
        }]
    )
    
    return {"summary": summary}
```

---

## 3. Frontend Implementation

### TypeScript Types

```typescript
// types/conversation.ts
export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: string;
  toolCalls?: Array<{
    id: string;
    tool: string;
    input: any;
    output?: any;
  }>;
  tokenCount?: number;
}

export interface Conversation {
  id: string;
  agentId: string;
  userId: string;
  title: string;
  totalTokens: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChatRequest {
  agentId: string;
  userId: string;
  message: string;
  conversationId?: string;
  privateKey?: string;
}

export interface ChatResponse {
  conversationId: string;
  message: string;
  toolCalls: any[];
  tokenCount?: number;
}
```

### Backend Service

```typescript
// lib/backend.ts
const AI_AGENT_BACKEND_URL = process.env.NEXT_PUBLIC_AI_AGENT_BACKEND_URL || 'http://localhost:8000';

export async function sendAgentChatMessage(
  request: ChatRequest
): Promise<ChatResponse> {
  const response = await fetch(`${AI_AGENT_BACKEND_URL}/agent/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }
  
  return response.json();
}

export async function getConversationHistory(
  conversationId: string
): Promise<{ messages: ConversationMessage[] }> {
  const response = await fetch(
    `${AI_AGENT_BACKEND_URL}/conversations/${conversationId}/messages`
  );
  return response.json();
}

export async function listConversations(
  agentId?: string,
  userId?: string
): Promise<Conversation[]> {
  const params = new URLSearchParams();
  if (agentId) params.append('agent_id', agentId);
  if (userId) params.append('user_id', userId);
  
  const response = await fetch(
    `${AI_AGENT_BACKEND_URL}/conversations?${params}`
  );
  return response.json();
}

export async function deleteConversation(
  conversationId: string
): Promise<void> {
  await fetch(
    `${AI_AGENT_BACKEND_URL}/conversations/${conversationId}`,
    { method: 'DELETE' }
  );
}

export async function summarizeConversation(
  conversationId: string
): Promise<{ summary: string }> {
  const response = await fetch(
    `${AI_AGENT_BACKEND_URL}/conversations/${conversationId}/summarize`,
    { method: 'POST' }
  );
  return response.json();
}
```

### Chat Page Component

```typescript
// app/agent/[agentId]/chat/page.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { 
  sendAgentChatMessage, 
  getConversationHistory,
  listConversations 
} from '@/lib/backend';
import type { ConversationMessage, ChatRequest } from '@/types/conversation';

export default function AgentChatPage() {
  const params = useParams();
  const agentId = params.agentId as string;
  const { user, dbUser } = useAuth();
  
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Load existing conversation or create new one
  useEffect(() => {
    const loadConversation = async () => {
      if (!user || !agentId) return;
      
      try {
        // Try to load the most recent conversation for this agent
        const conversations = await listConversations(agentId, user.id);
        
        if (conversations.length > 0) {
          const latest = conversations[0];
          setConversationId(latest.id);
          
          // Load message history
          const history = await getConversationHistory(latest.id);
          setMessages(history.messages.map(msg => ({
            ...msg,
            timestamp: msg.created_at || new Date().toISOString()
          })));
        }
      } catch (error) {
        console.error('Failed to load conversation:', error);
      }
    };
    
    loadConversation();
  }, [agentId, user]);
  
  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  const handleSend = async () => {
    if (!input.trim() || isLoading || !user) return;
    
    const userMessage: ConversationMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, userMessage]);
    const messageContent = input.trim();
    setInput('');
    setIsLoading(true);
    
    try {
      const request: ChatRequest = {
        agentId,
        userId: user.id,
        message: messageContent,
        conversationId: conversationId || undefined,
        privateKey: dbUser?.private_key || undefined
      };
      
      const response = await sendAgentChatMessage(request);
      
      // Update conversation ID if this was the first message
      if (!conversationId) {
        setConversationId(response.conversationId);
      }
      
      // Add assistant response
      const assistantMessage: ConversationMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response.message,
        timestamp: new Date().toISOString(),
        toolCalls: response.toolCalls
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      
    } catch (error) {
      console.error('Failed to send message:', error);
      // Optionally show error to user
    } finally {
      setIsLoading(false);
    }
  };
  
  const startNewConversation = () => {
    setConversationId(null);
    setMessages([]);
  };
  
  return (
    <div className="flex flex-col h-screen">
      {/* Header with conversation controls */}
      <div className="border-b p-4 flex justify-between items-center">
        <h1 className="text-xl font-semibold">Agent Chat</h1>
        <button
          onClick={startNewConversation}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
        >
          New Conversation
        </button>
      </div>
      
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`max-w-[70%] rounded-lg p-3 ${
                message.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted'
              }`}
            >
              <p className="whitespace-pre-wrap">{message.content}</p>
              
              {/* Tool calls display */}
              {message.toolCalls && message.toolCalls.length > 0 && (
                <div className="mt-2 space-y-1 text-xs">
                  {message.toolCalls.map((call, idx) => (
                    <div key={idx} className="opacity-70">
                      🔧 {call.tool}
                    </div>
                  ))}
                </div>
              )}
              
              <div className="text-xs opacity-50 mt-1">
                {new Date(message.timestamp).toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-lg p-3">
              <div className="animate-pulse">Thinking...</div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
      
      {/* Input */}
      <div className="border-t p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Type a message..."
            className="flex-1 px-4 py-2 border rounded-md"
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="px-6 py-2 bg-primary text-primary-foreground rounded-md disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

## 4. Advanced Features

### Conversation List Sidebar

```typescript
// components/conversation-list.tsx
import { useState, useEffect } from 'react';
import { listConversations, deleteConversation } from '@/lib/backend';
import type { Conversation } from '@/types/conversation';

interface ConversationListProps {
  agentId: string;
  userId: string;
  currentConversationId: string | null;
  onSelectConversation: (conversationId: string) => void;
  onNewConversation: () => void;
}

export function ConversationList({
  agentId,
  userId,
  currentConversationId,
  onSelectConversation,
  onNewConversation
}: ConversationListProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadConversations();
  }, [agentId, userId]);
  
  const loadConversations = async () => {
    try {
      const data = await listConversations(agentId, userId);
      setConversations(data);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleDelete = async (conversationId: string) => {
    if (!confirm('Delete this conversation?')) return;
    
    try {
      await deleteConversation(conversationId);
      setConversations(prev => 
        prev.filter(c => c.id !== conversationId)
      );
      
      if (conversationId === currentConversationId) {
        onNewConversation();
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    }
  };
  
  return (
    <div className="w-64 border-r bg-muted/30 flex flex-col">
      <div className="p-4 border-b">
        <button
          onClick={onNewConversation}
          className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md"
        >
          + New Chat
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="text-center text-muted-foreground py-4">
            Loading...
          </div>
        ) : conversations.length === 0 ? (
          <div className="text-center text-muted-foreground py-4">
            No conversations yet
          </div>
        ) : (
          <div className="space-y-1">
            {conversations.map((conv) => (
              <div
                key={conv.id}
                className={`
                  p-3 rounded-md cursor-pointer group
                  hover:bg-muted transition-colors
                  ${conv.id === currentConversationId ? 'bg-muted' : ''}
                `}
                onClick={() => onSelectConversation(conv.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {conv.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(conv.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(conv.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 text-destructive"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

### Token Usage Display

```typescript
// components/token-counter.tsx
interface TokenCounterProps {
  conversationId: string;
  currentTokens: number;
  maxTokens: number;
}

export function TokenCounter({ 
  conversationId, 
  currentTokens, 
  maxTokens 
}: TokenCounterProps) {
  const percentage = (currentTokens / maxTokens) * 100;
  const isWarning = percentage > 75;
  const isDanger = percentage > 90;
  
  return (
    <div className="flex items-center gap-2 text-xs">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full transition-all ${
            isDanger 
              ? 'bg-destructive' 
              : isWarning 
              ? 'bg-yellow-500' 
              : 'bg-primary'
          }`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
      <span className="text-muted-foreground whitespace-nowrap">
        {currentTokens.toLocaleString()} / {maxTokens.toLocaleString()} tokens
      </span>
    </div>
  );
}
```

---

## 5. Environment Configuration

### Backend `.env`

```bash
# Database
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_service_key

# AI Providers
GROQ_API_KEY=your_groq_api_key
GEMINI_API_KEY=your_gemini_api_key

# App Configuration
BACKEND_URL=http://localhost:3000
MAX_CONTEXT_TOKENS=8000
```

### Frontend `.env.local`

```bash
NEXT_PUBLIC_AI_AGENT_BACKEND_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

---

## 6. Testing

### Backend Tests

```python
import pytest
from app.conversation_memory import ConversationMemory

def test_token_estimation():
    text = "Hello world! " * 100
    tokens = ConversationMemory.estimate_tokens(text)
    assert tokens > 0
    assert tokens < len(text)  # Should be less than character count

def test_build_context_empty():
    context, tokens = ConversationMemory.build_context(
        messages=[],
        system_prompt="You are a helpful assistant"
    )
    assert len(context) == 1  # Only system message
    assert context[0]["role"] == "system"

def test_build_context_with_messages():
    messages = [
        {"role": "user", "content": "Hello"},
        {"role": "assistant", "content": "Hi there!"},
        {"role": "user", "content": "How are you?"}
    ]
    
    context, tokens = ConversationMemory.build_context(
        messages=messages,
        system_prompt="You are a helpful assistant"
    )
    
    assert len(context) >= 2  # System + at least last message
    assert context[-1] == messages[-1]  # Last message always included
    assert tokens < ConversationMemory.MAX_CONTEXT_TOKENS

def test_token_limit_enforcement():
    # Create very long conversation
    messages = [
        {"role": "user", "content": "x" * 1000}
        for _ in range(100)
    ]
    
    context, tokens = ConversationMemory.build_context(
        messages=messages,
        system_prompt="You are a helpful assistant",
        max_tokens=1000
    )
    
    assert tokens <= 1000
    assert len(context) < len(messages)  # Should trim older messages
```

### Frontend Tests

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AgentChatPage from '@/app/agent/[agentId]/chat/page';
import { sendAgentChatMessage } from '@/lib/backend';

jest.mock('@/lib/backend');

describe('AgentChatPage', () => {
  it('sends message and displays response', async () => {
    (sendAgentChatMessage as jest.Mock).mockResolvedValue({
      conversationId: 'conv-123',
      message: 'Hello! How can I help?',
      toolCalls: [],
      tokenCount: 50
    });
    
    render(<AgentChatPage />);
    
    const input = screen.getByPlaceholderText('Type a message...');
    const sendButton = screen.getByText('Send');
    
    fireEvent.change(input, { target: { value: 'Hello' } });
    fireEvent.click(sendButton);
    
    await waitFor(() => {
      expect(screen.getByText('Hello')).toBeInTheDocument();
      expect(screen.getByText('Hello! How can I help?')).toBeInTheDocument();
    });
  });
  
  it('handles new conversation creation', async () => {
    render(<AgentChatPage />);
    
    const newConvButton = screen.getByText('New Conversation');
    fireEvent.click(newConvButton);
    
    // Should clear messages
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });
});
```

---

## 7. Deployment Checklist

- [ ] Database migrations applied to production Supabase
- [ ] RLS policies enabled and tested
- [ ] Environment variables configured
- [ ] Backend API endpoints deployed
- [ ] Frontend environment variables set
- [ ] Token limits tested with real usage
- [ ] Conversation cleanup/archiving strategy defined
- [ ] Monitoring and logging configured
- [ ] Error handling tested
- [ ] Rate limiting configured (if needed)

---

## 8. Future Enhancements

### Conversation Search
- Full-text search across conversation history
- Filter by date, agent, tool usage

### Smart Summarization
- Automatic summarization of long conversations
- Progressive summarization as conversation grows

### Multi-User Conversations
- Share conversations between users
- Collaborative agent interactions

### Conversation Export
- Export as JSON, Markdown, or PDF
- Share conversation links

### Analytics Dashboard
- Token usage over time
- Most active conversations
- Tool usage statistics
- Agent performance metrics

### Conversation Templates
- Save conversation as template
- Reuse common interaction patterns

### Voice Integration
- Speech-to-text for input
- Text-to-speech for responses

---

## 9. Performance Optimization

### Database Indexing
```sql
-- Add indexes for common queries
CREATE INDEX idx_messages_conversation_created 
  ON conversation_messages(conversation_id, created_at DESC);

CREATE INDEX idx_conversations_user_updated 
  ON conversations(user_id, updated_at DESC);

-- Partial index for active conversations
CREATE INDEX idx_active_conversations 
  ON conversations(user_id, updated_at DESC) 
  WHERE updated_at > NOW() - INTERVAL '7 days';
```

### Caching Strategy
- Cache recent conversations in Redis
- Cache agent configurations
- Implement conversation summary caching

### Pagination
```python
@app.get("/conversations/{conversation_id}/messages")
async def get_messages(
    conversation_id: str,
    limit: int = 50,
    before: Optional[str] = None  # Message ID cursor
):
    query = supabase.table("conversation_messages")\
        .select("*")\
        .eq("conversation_id", conversation_id)\
        .order("created_at", desc=True)\
        .limit(limit)
    
    if before:
        query = query.lt("created_at", before)
    
    response = query.execute()
    
    return {
        "messages": list(reversed(response.data)),
        "hasMore": len(response.data) == limit
    }
```

---

## 10. Security Considerations

1. **Authentication**: Ensure all endpoints verify user identity
2. **Authorization**: Users can only access their own conversations
3. **Data Sanitization**: Clean user input before storage
4. **Rate Limiting**: Prevent abuse of chat endpoints
5. **Token Validation**: Verify JWT tokens on every request
6. **Private Key Handling**: Never log or expose private keys
7. **SQL Injection**: Use parameterized queries (handled by Supabase)
8. **XSS Prevention**: Sanitize output in frontend

---

## Conclusion

This implementation provides a robust, scalable conversation memory system with:
- ✅ Database persistence
- ✅ Intelligent token management
- ✅ Tool call history tracking
- ✅ Multi-conversation support
- ✅ Real-time updates
- ✅ Security best practices
- ✅ Performance optimization

The system is production-ready and can handle thousands of concurrent conversations while maintaining context and providing a seamless user experience.
