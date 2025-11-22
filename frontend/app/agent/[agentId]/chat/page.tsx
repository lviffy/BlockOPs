"use client"

import * as React from "react"
import { useState, useRef, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { Send, Bot, User, Loader2, CheckCircle2, XCircle, ExternalLink, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
      <Card key={`${tool}-${result.success}`} className={cn("mb-4", !isSuccess && "border-destructive")}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              {isSuccess ? (
                <CheckCircle2 className="h-4 w-4 text-foreground" />
              ) : (
                <XCircle className="h-4 w-4 text-muted-foreground" />
              )}
              {formatToolName(tool)}
            </CardTitle>
            <Badge variant={isSuccess ? "default" : "destructive"}>
              {isSuccess ? "Success" : "Failed"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {res.message && (
            <p className="text-sm text-muted-foreground">{res.message}</p>
          )}

          {/* Airdrop Result */}
          {tool === "airdrop" && res.airdrop && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">From:</span>
                  <p className="font-mono text-xs">{res.airdrop.from}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Recipients:</span>
                  <p>{res.airdrop.recipientsCount}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Amount per recipient:</span>
                  <p>{res.airdrop.amountPerRecipient}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Total amount:</span>
                  <p>{res.airdrop.totalAmount}</p>
                </div>
              </div>
              {res.airdrop.recipients && res.airdrop.recipients.length > 0 && (
                <div>
                  <span className="text-muted-foreground text-sm">Recipients:</span>
                  <div className="mt-1 space-y-1">
                    {res.airdrop.recipients.map((addr: string, idx: number) => (
                      <p key={idx} className="font-mono text-xs bg-muted p-2 rounded">
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
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Deposit ID:</span>
                  <p className="font-semibold">{res.deposit.depositId}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Token:</span>
                  <p>{res.deposit.tokenSymbol} ({res.deposit.tokenName})</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Amount:</span>
                  <p>{res.deposit.depositAmount} {res.deposit.tokenSymbol}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">APY:</span>
                  <p>{res.deposit.apyPercent}%</p>
                </div>
              </div>
              {res.projections && res.projections.length > 0 && (
                <div>
                  <span className="text-muted-foreground text-sm mb-2 block">Projections:</span>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {res.projections.map((proj: any, idx: number) => (
                      <div key={idx} className="bg-muted p-2 rounded">
                        <div className="font-semibold">{proj.days} Days</div>
                        <div className="text-muted-foreground">Total: {proj.totalValue} {proj.tokenSymbol}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Transaction Info */}
          {res.transaction && (
            <div className="pt-2 border-t">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-muted-foreground text-xs">Transaction:</span>
                  <p className="font-mono text-xs">{res.transaction.hash}</p>
                </div>
                {res.transaction.explorerUrl && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6"
                    onClick={() => window.open(res.transaction.explorerUrl, "_blank")}
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    View
                  </Button>
                )}
              </div>
              {res.transaction.gasUsed && (
                <p className="text-xs text-muted-foreground mt-1">
                  Gas Used: {res.transaction.gasUsed}
                </p>
              )}
            </div>
          )}

          {/* Balances */}
          {res.balances && (
            <div className="pt-2 border-t">
              <span className="text-muted-foreground text-xs">Balances:</span>
              <div className="grid grid-cols-2 gap-2 text-xs mt-1">
                <div>
                  <span className="text-muted-foreground">Before:</span>
                  <p>{res.balances.walletBefore}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">After:</span>
                  <p>{res.balances.walletAfter}</p>
                </div>
              </div>
            </div>
          )}

          {/* Generic Result Data */}
          {!res.airdrop && !res.deposit && !res.transaction && (
            <div className="text-xs">
              <pre className="bg-muted p-2 rounded overflow-x-auto">
                {JSON.stringify(res, null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>
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
      {/* Header */}
      <div className="border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/my-agents")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">{agent.name}</h1>
          </div>
        </div>
        <UserProfile onLogout={() => {
          logout()
          router.push("/")
        }} />
      </div>

      {/* Messages area - scrollable */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-muted-foreground">
              <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg">Start a conversation with {agent.name}</p>
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "flex gap-4",
              message.role === "user" ? "justify-end" : "justify-start"
            )}
          >
            {message.role === "assistant" && (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground/10">
                <Bot className="h-4 w-4 text-foreground" />
              </div>
            )}
            <div
              className={cn(
                "max-w-[80%] rounded-lg px-4 py-3",
                message.role === "user"
                  ? "bg-foreground text-background"
                  : "bg-muted text-foreground"
              )}
            >
              <div className="whitespace-pre-wrap">{message.content}</div>
              {message.agentResponse && (
                <div className="mt-4 space-y-4 pt-4 border-t border-gray-300/50">
                  {/* Tool Calls */}
                  {message.agentResponse.tool_calls && message.agentResponse.tool_calls.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-2">Tool Calls:</h4>
                      <div className="space-y-2">
                        {message.agentResponse.tool_calls.map((toolCall, idx) => (
                          <Card key={idx} className="p-3">
                            <div className="flex items-center justify-between mb-2">
                              <Badge variant="outline">{formatToolName(toolCall.tool)}</Badge>
                            </div>
                            <div className="text-xs">
                              <pre className="bg-background p-2 rounded overflow-x-auto">
                                {JSON.stringify(toolCall.parameters, null, 2)}
                              </pre>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tool Results */}
                  {message.agentResponse.results && message.agentResponse.results.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-2">Execution Results:</h4>
                      {message.agentResponse.results.map((result, idx) =>
                        renderToolResult(result, result.tool)
                      )}
                    </div>
                  )}
                </div>
              )}
              <div className="text-xs opacity-70 mt-2">
                {message.timestamp.toLocaleTimeString()}
              </div>
            </div>
            {message.role === "user" && (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground">
                <User className="h-4 w-4 text-background" />
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-4 justify-start">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground/10">
              <Bot className="h-4 w-4 text-foreground" />
            </div>
            <div className="bg-muted text-muted-foreground max-w-[80%] rounded-lg px-4 py-2.5">
              <div className="flex gap-1">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="ml-2">Agent is thinking...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area - fixed at bottom */}
      <div className="border-t p-4 bg-background">
        <div className="flex gap-2 max-w-5xl mx-auto">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            className="min-h-[60px] max-h-[120px] resize-none rounded-2xl"
            disabled={isLoading || !agent || !agent.api_key}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isLoading || !agent || !agent.api_key}
            size="icon"
            className="h-[60px] w-[60px] shrink-0 rounded-full"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground text-center mt-2">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  )
}

