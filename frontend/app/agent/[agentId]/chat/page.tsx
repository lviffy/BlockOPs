"use client"

import * as React from "react"
import { useState, useRef, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { Send, Loader2, ChevronDown, ChevronUp, Wrench, ArrowLeft, ArrowRight, CircleDot } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { toast } from "@/components/ui/use-toast"
import { UserProfile } from "@/components/user-profile"
import { useAuth } from "@/lib/auth"
import { getAgentById } from "@/lib/agents"
import { sendChatWithMemory } from "@/lib/backend"
import type { Agent } from "@/lib/supabase"
import type { AgentChatResponse } from "@/lib/types"

interface ToolCallInfo {
  tool: string
  parameters: Record<string, any>
}

interface ToolResultInfo {
  success: boolean
  tool: string
  result: any
  error?: string
}

interface ToolResults {
  tool_calls: ToolCallInfo[]
  results: ToolResultInfo[]
  routing_plan?: any
}

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
  conversationId?: string
  toolResults?: ToolResults
}

function ToolDetailsView({ toolResults }: { toolResults: ToolResults }) {
  const [isOpen, setIsOpen] = useState(false)

  if (!toolResults?.tool_calls?.length) return null

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mt-3">
      <CollapsibleTrigger asChild>
        <button className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
          <Wrench className="h-3 w-3" />
          <span>{toolResults.tool_calls.length} tool call{toolResults.tool_calls.length > 1 ? "s" : ""}</span>
          {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-2">
        {toolResults.tool_calls.map((toolCall, index) => {
          const result = toolResults.results[index]
          return (
            <div key={index} className="rounded-md border border-border bg-background/50 overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border bg-muted/30">
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-mono">
                  {toolCall.tool}
                </Badge>
                <ArrowRight className="h-2.5 w-2.5 text-muted-foreground" />
                <span className="text-[10px] font-medium text-muted-foreground">
                  {result?.success ? "ok" : "err"}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
                <div className="p-2">
                  <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Request</span>
                  <pre className="mt-1 text-[10px] font-mono text-foreground/80 whitespace-pre-wrap break-all leading-relaxed">
                    {JSON.stringify(toolCall.parameters || {}, null, 2)}
                  </pre>
                </div>
                <div className="p-2 overflow-hidden">
                  <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Response</span>
                  <div className="mt-1 max-h-[160px] overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border">
                    <pre className="text-[10px] font-mono text-foreground/80 whitespace-pre-wrap break-all leading-relaxed">
                      {result?.error
                        ? JSON.stringify({ error: result.error }, null, 2)
                        : JSON.stringify(result?.result || {}, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </CollapsibleContent>
    </Collapsible>
  )
}

function formatContent(content: string): string {
  // Clean up AI thinking / reasoning that leaks into the response
  let cleaned = content
    // Remove lines like "The user wants to..." or "I need to use the send_email tool..."
    .replace(/^(The user wants to[\s\S]*?(?:\n\n|$))/m, '')
    .replace(/^(I need to use the \w+ tool[\s\S]*?(?:\n\n|$))/m, '')
    .replace(/^(I'?ll compose[\s\S]*?(?:\n\n|$))/m, '')
    // Remove standalone raw JSON blocks that aren't in code fences
    .replace(/^\{\n\s+"to":[\s\S]*?^\}$/gm, '')
    // Remove duplicate JSON echo like {"to": "...", "subject": "...", "body": "..."}
    .replace(/^\{"to":\s*"[^"]+",\s*"subject":\s*"[^"]+",\s*"(?:body|text)":\s*"[^"]*"\}$/gm, '')
    // Trim leading/trailing whitespace and collapse excessive newlines
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return cleaned
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="underline underline-offset-2 hover:text-foreground/80 transition-colors">$1</a>')
    .replace(/(https?:\/\/[^\s<]+)/g, (match) => {
      if (match.includes('href="')) return match
      return `<a href="${match}" target="_blank" rel="noopener noreferrer" class="underline underline-offset-2 hover:text-foreground/80 transition-colors">${match}</a>`
    })
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/```(?:json)?\n([\s\S]*?)\n```/g, (_, code) => {
      return `<pre class="mt-2 rounded border border-border bg-muted/40 p-2.5 font-mono text-[11px] overflow-x-auto leading-relaxed">${code}</pre>`
    })
    .replace(/`([^`]+)`/g, '<code class="bg-muted px-1 py-0.5 rounded text-[11px] font-mono">$1</code>')
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

  useEffect(() => {
    const loadAgent = async () => {
      if (!agentId) { router.push("/my-agents"); return }
      try {
        const agentData = await getAgentById(agentId)
        if (!agentData) {
          toast({ title: "Agent not found", description: "The agent you're looking for doesn't exist", variant: "destructive" })
          router.push("/my-agents")
          return
        }
        setAgent(agentData)
      } catch (error: any) {
        console.error("Error loading agent:", error)
        toast({ title: "Error", description: "Failed to load agent", variant: "destructive" })
        router.push("/my-agents")
      } finally {
        setLoadingAgent(false)
      }
    }
    loadAgent()
  }, [agentId, router])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

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
      const data = await sendChatWithMemory({
        agentId: agent.id,
        userId: dbUser.id,
        message: userQuery,
        conversationId: conversationId,
        systemPrompt: `You are a helpful AI assistant for blockchain operations. The agent has these tools: ${agent.tools?.map((t) => t.tool).join(", ")}`,
      })

      if (data.isNewConversation) {
        setConversationId(data.conversationId)
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.message,
        timestamp: new Date(),
        conversationId: data.conversationId,
        toolResults: data.toolResults,
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
      toast({ title: "Error", description: error.message || "Failed to chat with agent", variant: "destructive" })
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
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!agent) return null

  return (
    <TooltipProvider>
      <div className="flex h-screen flex-col bg-background">
        {/* Header */}
        <header className="shrink-0 border-b border-border">
          <div className="mx-auto flex h-12 max-w-2xl items-center justify-between px-4">
            <div className="flex items-center gap-2.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => router.push("/my-agents")}
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom"><p>Back</p></TooltipContent>
              </Tooltip>
              <Separator orientation="vertical" className="h-4" />
              <span className="text-sm font-medium text-foreground">{agent.name}</span>
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5 py-0 font-normal">
                {agent.tools?.length || 0} {(agent.tools?.length || 0) === 1 ? "tool" : "tools"}
              </Badge>
            </div>
            <UserProfile
              onLogout={() => {
                logout()
                router.push("/")
              }}
            />
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-2xl px-4 py-6">
            {messages.length === 0 && (
              <div className="flex min-h-[65vh] items-center justify-center">
                <div className="text-center space-y-2">
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-dashed border-border">
                    <CircleDot className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-xs text-muted-foreground">Send a message to begin.</p>
                </div>
              </div>
            )}

            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex",
                    message.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[80%] rounded-2xl px-4 py-2.5",
                      message.role === "user"
                        ? "bg-foreground text-background rounded-br-md"
                        : "bg-muted/60 text-foreground border border-border rounded-bl-md"
                    )}
                  >
                    <div
                      className="text-sm leading-relaxed whitespace-pre-wrap [&_a]:underline [&_a]:underline-offset-2"
                      dangerouslySetInnerHTML={{ __html: formatContent(message.content) }}
                    />

                    {message.role === "assistant" && message.toolResults && (
                      <ToolDetailsView toolResults={message.toolResults} />
                    )}

                    <div
                      className={cn(
                        "text-[10px] mt-1.5",
                        message.role === "user" ? "text-background/50" : "text-muted-foreground/60"
                      )}
                    >
                      {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-muted/60 border border-border rounded-2xl rounded-bl-md px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Thinking…</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>
        </div>

        {/* Input */}
        <footer className="shrink-0 border-t border-border bg-background">
          <div className="mx-auto flex max-w-2xl items-end gap-2 px-4 py-3">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message…"
              className="min-h-[40px] max-h-[120px] flex-1 resize-none rounded-lg border-border bg-muted/30 px-3 py-2.5 text-sm placeholder:text-muted-foreground/50 focus-visible:bg-background focus-visible:ring-1 focus-visible:ring-ring"
              disabled={isLoading || !dbUser?.id}
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading || !dbUser?.id}
                  size="icon"
                  className="h-10 w-10 shrink-0 rounded-lg bg-foreground text-background hover:bg-foreground/90"
                >
                  {isLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top"><p>Send</p></TooltipContent>
            </Tooltip>
          </div>
        </footer>
      </div>
    </TooltipProvider>
  )
}