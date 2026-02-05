"use client"

import * as React from "react"
import { useState, useRef, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { Send, Bot, User, Loader2, CheckCircle2, XCircle, ExternalLink, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { toast } from "@/components/ui/use-toast"
import { UserProfile } from "@/components/user-profile"
import { useAuth } from "@/lib/auth"
import { getAgentById } from "@/lib/agents"
import { sendChatWithMemory } from "@/lib/backend"
import type { Agent } from "@/lib/supabase"
import type { AgentChatResponse } from "@/lib/types"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
  conversationId?: string
}

export default function AgentChatPage() {
  const router = useRouter()
  const params = useParams()
  const agentId = params.agentId as string
  const { logout, dbUser } = useAuth()
  
  const [agent, setAgent] = useState<Agent | null>(null)
  const [loadingAgent, setLoadingAgent] = useState(true)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [conversationId, setConversationId] = useState<string | undefined>(undefined)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Load agent on mount
  useEffect(() => {
    const loadAgent = async () => {
      if (!agentId) {
        router.push("/my-agents")
        return
      }

      try {
        const agentData = await getAgentById(agentId)
        if (!agentData) {
          toast({
            title: "Agent not found",
            description: "The agent you're looking for doesn't exist",
            variant: "destructive",
          })
          router.push("/my-agents")
          return
        }
        setAgent(agentData)
      } catch (error: any) {
        console.error("Error loading agent:", error)
        toast({
          title: "Error",
          description: "Failed to load agent",
          variant: "destructive",
        })
        router.push("/my-agents")
      } finally {
        setLoadingAgent(false)
      }
    }

    loadAgent()
  }, [agentId, router])

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Focus textarea when page loads
  useEffect(() => {
    if (!loadingAgent && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 100)
    }
  }, [loadingAgent])

  const handleSend = async () => {
    if (!input.trim() || isLoading || !agent || !dbUser?.id) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, userMessage])
    const userQuery = input.trim()
    setInput("")
    setIsLoading(true)

    try {
      // Use conversation memory API
      const data = await sendChatWithMemory({
        agentId: agent.id,
        userId: dbUser.id,
        message: userQuery,
        conversationId: conversationId,
        systemPrompt: `You are a helpful AI assistant for blockchain operations. The agent has these tools: ${agent.tools?.map(t => t.tool).join(', ')}`
      })

      // Save conversation ID for subsequent messages
      if (data.isNewConversation) {
        setConversationId(data.conversationId)
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.message,
        timestamp: new Date(),
        conversationId: data.conversationId
      }
      setMessages((prev) => [...prev, assistantMessage])
    } catch (error: any) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `Error: ${error.message || "Failed to get response from agent"}`,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
      toast({
        title: "Error",
        description: error.message || "Failed to chat with agent",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (loadingAgent) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-foreground" />
      </div>
    )
  }

  if (!agent) {
    return null
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Minimal Header */}
      <div className="sticky top-0 z-10 backdrop-blur-sm bg-background/80 border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 hover:bg-muted/50"
              onClick={() => router.push("/my-agents")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-base font-medium tracking-tight">{agent.name}</h1>
          </div>
          <UserProfile onLogout={() => {
            logout()
            router.push("/")
          }} />
        </div>
      </div>

      {/* Main Chat Container - centered with max width */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
          {messages.length === 0 && (
            <div className="flex items-center justify-center min-h-[60vh]">
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center">
                    <Bot className="h-8 w-8 text-muted-foreground/60" />
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-base font-medium text-foreground/80">Ready to help</p>
                  <p className="text-sm text-muted-foreground">Send a message to start the conversation</p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-6">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex gap-3 group",
                  message.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                {message.role === "assistant" && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-muted/50 group-hover:bg-muted transition-colors">
                    <Bot className="h-4 w-4 text-foreground/70" />
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[75%] rounded-2xl px-4 py-3 shadow-sm",
                    message.role === "user"
                      ? "bg-gray-700 text-white"
                      : "bg-muted/70 text-foreground border border-border/40"
                  )}
                >
                  <div 
                    className="text-sm leading-relaxed whitespace-pre-wrap"
                    dangerouslySetInnerHTML={{
                      __html: message.content
                        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
                        .replace(/\*([^*]+)\*/g, '<em>$1</em>')
                    }}
                  />
                  
                  <div className={cn(
                    "text-[11px] mt-2",
                    message.role === "user" ? "text-gray-300" : "text-muted-foreground"
                  )}>
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                {message.role === "user" && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gray-700 group-hover:bg-gray-600 transition-colors">
                    <User className="h-4 w-4 text-white" />
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3 justify-start">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-muted/50">
                  <Bot className="h-4 w-4 text-foreground/70" />
                </div>
                <div className="bg-muted/70 border border-border/40 rounded-2xl px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Thinking...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>

      {/* Minimal Input Area - fixed at bottom */}
      <div className="sticky bottom-0 border-t bg-background/95 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-end gap-2">
            <div className="flex-1 relative">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Message..."
                className="min-h-[52px] max-h-[120px] resize-none rounded-xl bg-muted/30 border-border/40 focus:bg-background focus:border-border pr-12 text-sm"
                disabled={isLoading || !dbUser?.id}
              />
            </div>
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isLoading || !dbUser?.id}
              size="icon"
              className="h-[52px] w-[52px] shrink-0 rounded-xl shadow-sm hover:shadow-md transition-all"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}