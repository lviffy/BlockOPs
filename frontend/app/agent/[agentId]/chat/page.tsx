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
import type { Agent } from "@/lib/supabase"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
  agentResponse?: AgentChatResponse
}

interface AgentChatResponse {
  agent_response: string
  tool_calls: Array<{
    tool: string
    parameters: Record<string, any>
  }>
  results: Array<{
    success: boolean
    tool: string
    result: any
  }>
}

export default function AgentChatPage() {
  const router = useRouter()
  const params = useParams()
  const agentId = params.agentId as string
  const { logout } = useAuth()
  
  const [agent, setAgent] = useState<Agent | null>(null)
  const [loadingAgent, setLoadingAgent] = useState(true)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
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
    if (!input.trim() || isLoading || !agent || !agent.api_key) return

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
      if (!agent.api_key) {
        throw new Error("Agent API key not found")
      }

      const response = await fetch("/api/agent/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          api_key: agent.api_key,
          user_message: userQuery,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
        throw new Error(errorData.error || `Request failed with status ${response.status}`)
      }

      const data: AgentChatResponse = await response.json()

      // Remove privateKey/private_key fields from the response
      const cleanedData = removePrivateKeys(data) as AgentChatResponse

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: cleanedData.agent_response || "Response received",
        timestamp: new Date(),
        agentResponse: cleanedData,
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

  // Recursively remove privateKey/private_key fields from objects
  const removePrivateKeys = (obj: any): any => {
    if (obj === null || obj === undefined) {
      return obj
    }

    if (Array.isArray(obj)) {
      return obj.map(removePrivateKeys)
    }

    if (typeof obj === "object") {
      const cleaned: any = {}
      for (const [key, value] of Object.entries(obj)) {
        // Skip privateKey and private_key fields
        if (key === "privateKey" || key === "private_key") {
          continue
        }
        cleaned[key] = removePrivateKeys(value)
      }
      return cleaned
    }

    return obj
  }

  const formatToolName = (tool: string): string => {
    return tool
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ")
  }

  const renderToolResult = (result: any, tool: string) => {
    if (!result?.result) return null

    const res = result.result
    const isSuccess = result.success && res.success

    return (
      <div key={`${tool}-${result.success}`} className={cn(
        "rounded-lg border bg-background/60 overflow-hidden",
        !isSuccess && "border-destructive/50"
      )}>
        <div className="px-3 py-2 border-b bg-muted/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isSuccess ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
            ) : (
              <XCircle className="h-3.5 w-3.5 text-destructive" />
            )}
            <span className="text-xs font-medium">{formatToolName(tool)}</span>
          </div>
          <Badge variant={isSuccess ? "default" : "destructive"} className="text-[10px] h-5">
            {isSuccess ? "Success" : "Failed"}
          </Badge>
        </div>
        <div className="p-3 space-y-3 text-xs">
          {res.message && (
            <p className="text-muted-foreground">{res.message}</p>
          )}

          {/* Airdrop Result */}
          {tool === "airdrop" && res.airdrop && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-0.5">
                  <span className="text-muted-foreground text-[11px]">From</span>
                  <p className="font-mono text-[11px] break-all">{res.airdrop.from}</p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-muted-foreground text-[11px]">Recipients</span>
                  <p>{res.airdrop.recipientsCount}</p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-muted-foreground text-[11px]">Amount per recipient</span>
                  <p>{res.airdrop.amountPerRecipient}</p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-muted-foreground text-[11px]">Total amount</span>
                  <p>{res.airdrop.totalAmount}</p>
                </div>
              </div>
              {res.airdrop.recipients && res.airdrop.recipients.length > 0 && (
                <div>
                  <span className="text-muted-foreground text-[11px]">Recipients:</span>
                  <div className="mt-1 space-y-1">
                    {res.airdrop.recipients.map((addr: string, idx: number) => (
                      <p key={idx} className="font-mono text-[11px] bg-muted/50 p-1.5 rounded break-all">
                        {addr}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Deposit Yield Result */}
          {tool === "deposit_yield" && res.deposit && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-0.5">
                  <span className="text-muted-foreground text-[11px]">Deposit ID</span>
                  <p className="font-semibold">{res.deposit.depositId}</p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-muted-foreground text-[11px]">Token</span>
                  <p>{res.deposit.tokenSymbol} ({res.deposit.tokenName})</p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-muted-foreground text-[11px]">Amount</span>
                  <p>{res.deposit.depositAmount} {res.deposit.tokenSymbol}</p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-muted-foreground text-[11px]">APY</span>
                  <p>{res.deposit.apyPercent}%</p>
                </div>
              </div>
              {res.projections && res.projections.length > 0 && (
                <div>
                  <span className="text-muted-foreground text-[11px] block mb-1">Projections</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {res.projections.map((proj: any, idx: number) => (
                      <div key={idx} className="bg-muted/50 p-2 rounded">
                        <div className="font-semibold text-[11px]">{proj.days} Days</div>
                        <div className="text-muted-foreground text-[10px]">Total: {proj.totalValue} {proj.tokenSymbol}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Transaction Info */}
          {res.transaction && (
            <div className="pt-2 border-t border-border/40">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5 flex-1 min-w-0">
                  <span className="text-muted-foreground text-[11px]">Transaction</span>
                  <p className="font-mono text-[11px] truncate">{res.transaction.hash}</p>
                </div>
                {res.transaction.explorerUrl && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-[11px] ml-2"
                    onClick={() => window.open(res.transaction.explorerUrl, "_blank")}
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    View
                  </Button>
                )}
              </div>
              {res.transaction.gasUsed && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  Gas Used: {res.transaction.gasUsed}
                </p>
              )}
            </div>
          )}

          {/* Balances */}
          {res.balances && (
            <div className="pt-2 border-t border-border/40">
              <span className="text-muted-foreground text-[11px]">Balances</span>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <div className="space-y-0.5">
                  <span className="text-muted-foreground text-[10px]">Before</span>
                  <p>{res.balances.walletBefore}</p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-muted-foreground text-[10px]">After</span>
                  <p>{res.balances.walletAfter}</p>
                </div>
              </div>
            </div>
          )}

          {/* Generic Result Data */}
          {!res.airdrop && !res.deposit && !res.transaction && (
            <div>
              <pre className="bg-muted/50 p-2 rounded border border-border/40 overflow-x-auto text-[11px]">
                {JSON.stringify(res, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    )
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
                  <div className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</div>
                  
                  {message.agentResponse && (
                    <div className="mt-4 space-y-3 pt-3 border-t border-border/30">
                      {/* Tool Calls */}
                      {message.agentResponse.tool_calls && message.agentResponse.tool_calls.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions Taken</h4>
                          <div className="space-y-2">
                            {message.agentResponse.tool_calls.map((toolCall, idx) => (
                              <div key={idx} className="bg-background/60 rounded-lg p-3 space-y-2">
                                <Badge variant="secondary" className="text-xs">
                                  {formatToolName(toolCall.tool)}
                                </Badge>
                                <pre className="text-[11px] bg-background/80 p-2 rounded border border-border/40 overflow-x-auto">
                                  {JSON.stringify(toolCall.parameters, null, 2)}
                                </pre>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Tool Results */}
                      {message.agentResponse.results && message.agentResponse.results.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Results</h4>
                          {message.agentResponse.results.map((result, idx) =>
                            renderToolResult(result, result.tool)
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  
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
                disabled={isLoading || !agent || !agent.api_key}
              />
            </div>
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isLoading || !agent || !agent.api_key}
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
          <p className="text-[11px] text-muted-foreground/60 text-center mt-2">
            Press Enter to send • Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  )
}

