"use client"

import * as React from "react"
import { useState, useRef, useEffect } from "react"
import { Send, Bot, User, Sparkles, X } from "lucide-react"
import { usePrivy } from "@privy-io/react-auth"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
  config?: OrbitConfig
}

interface OrbitConfig {
  name: string
  chainId: string
  parentChain: string
  owner: string
  validators: string[]
  chainConfig?: {
    chainName?: string
    nativeToken?: {
      name?: string
      symbol?: string
      decimals?: number
    }
    sequencerUrl?: string
    blockTime?: number
    gasLimit?: number
  }
}

interface OrbitAIChatProps {
  onApplyConfig: (config: OrbitConfig) => void
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function OrbitAIChat({ onApplyConfig, open, onOpenChange }: OrbitAIChatProps) {
  const { user, authenticated } = usePrivy()
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content: "Hello! I can help you configure your Arbitrum Orbit L3 chain. Tell me what you'd like to build, and I'll automatically fill in the configuration details for you.\n\nFor example, you could say:\n• 'I want to create a gaming L3 called GameChain with fast 1-second blocks'\n• 'Build me a DeFi-focused chain with low gas fees'\n• 'Create an enterprise L3 with 5 validators'",
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Focus textarea when opened
  useEffect(() => {
    if (open && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 100)
    }
  }, [open])

  const parseAIResponse = (aiText: string): OrbitConfig | null => {
    try {
      // Try to find JSON in the response
      const jsonMatch = aiText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      }
      return null
    } catch (error) {
      console.error('Failed to parse AI response:', error)
      return null
    }
  }

  const handleSend = async () => {
    if (!input.trim() || isLoading) return
    
    // Check authentication
    if (!authenticated || !user?.id) {
      const aiMessage: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: "Please connect your wallet to use AI configuration.",
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, aiMessage])
      return
    }

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
      // Call Gemini API to parse user requirements
      const response = await fetch('/api/orbit/ai-parse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userQuery,
          userId: user.id,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to generate configuration')
      }

      const data = await response.json()
      
      if (data.success && data.config) {
        const config = data.config
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: data.message || `I've created a configuration for "${config.name}"!\n\nHere's what I've set up:\n• Chain ID: ${config.chainId}\n• Parent Chain: ${config.parentChain}\n• Validators: ${config.validators?.length || 0}\n• Native Token: ${config.chainConfig?.nativeToken?.name || 'ETH'} (${config.chainConfig?.nativeToken?.symbol || 'ETH'})\n• Block Time: ${config.chainConfig?.blockTime || 2} seconds\n\nClick "Apply Configuration" below to use these settings in your form!`,
          timestamp: new Date(),
          config: config,
        }
        setMessages((prev) => [...prev, aiMessage])
      } else {
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: data.message || "I couldn't generate a configuration from your request. Could you provide more details? For example:\n• What would you like to name your L3?\n• What's the main use case (gaming, DeFi, NFTs)?\n• Any specific requirements (block time, validators)?",
          timestamp: new Date(),
        }
        setMessages((prev) => [...prev, aiMessage])
      }
    } catch (error: any) {
      console.error('Error calling AI API:', error)
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `Sorry, I encountered an error: ${error.message || 'Failed to generate configuration'}. Please try again.`,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, aiMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleApplyConfig = (config: OrbitConfig) => {
    onApplyConfig(config)
    onOpenChange(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
      <div className="fixed inset-4 sm:inset-auto sm:right-4 sm:bottom-4 sm:top-4 sm:w-[500px] z-50">
        <Card className="h-full flex flex-col shadow-2xl border-2">
          <CardHeader className="border-b bg-muted/30 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-foreground rounded-lg">
                  <Sparkles className="w-4 h-4 text-background" />
                </div>
                <CardTitle className="text-lg">AI Configuration Assistant</CardTitle>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onOpenChange(false)}
                className="h-8 w-8"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>

          <CardContent className="flex-1 overflow-hidden flex flex-col p-0">
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex gap-3 items-start",
                    message.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  {message.role === "assistant" && (
                    <div className="p-2 bg-muted rounded-full shrink-0">
                      <Bot className="w-4 h-4 text-foreground" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "rounded-lg px-4 py-2 max-w-[85%] whitespace-pre-wrap",
                      message.role === "user"
                        ? "bg-foreground text-background"
                        : "bg-muted text-foreground"
                    )}
                  >
                    <p className="text-sm leading-relaxed">{message.content}</p>
                    {message.config && (
                      <Button
                        onClick={() => handleApplyConfig(message.config!)}
                        className="mt-3 w-full"
                        size="sm"
                      >
                        Apply Configuration
                      </Button>
                    )}
                  </div>
                  {message.role === "user" && (
                    <div className="p-2 bg-foreground rounded-full shrink-0">
                      <User className="w-4 h-4 text-background" />
                    </div>
                  )}
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-3 items-start">
                  <div className="p-2 bg-muted rounded-full shrink-0">
                    <Bot className="w-4 h-4 text-foreground animate-pulse" />
                  </div>
                  <div className="bg-muted rounded-lg px-4 py-2">
                    <p className="text-sm text-muted-foreground">Generating configuration...</p>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 border-t bg-muted/30 shrink-0">
              <div className="flex gap-2">
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Describe your L3 requirements..."
                  className="min-h-[60px] max-h-[120px] resize-none"
                  disabled={isLoading}
                />
                <Button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  size="icon"
                  className="h-[60px] w-[60px] shrink-0"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Press Enter to send, Shift+Enter for new line
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
