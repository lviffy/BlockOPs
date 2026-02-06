'use client'

import * as React from 'react'
import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Sparkles, ArrowRight } from 'lucide-react'
import { usePrivy } from '@privy-io/react-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

interface Message {
  id: string
  role: 'user' | 'assistant'
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
  initialPrompt?: string
  onPromptConsumed?: () => void
}

export function OrbitAIChat({ onApplyConfig, initialPrompt, onPromptConsumed }: OrbitAIChatProps) {
  const { user, authenticated } = usePrivy()
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content:
        "Hi! I'll help you configure your L3 chain. Describe what you want to build — I'll set up everything for you.\n\nTry something like:\n• \"A gaming chain called GameNet with 1s blocks\"\n• \"DeFi-focused chain with low gas fees\"\n• \"Enterprise L3 with 5 validators\"",
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const container = scrollContainerRef.current
    if (container) {
      container.scrollTop = container.scrollHeight
    }
  }, [messages])

  // Handle initial prompt from parent
  useEffect(() => {
    if (initialPrompt?.trim()) {
      setInput('')
      handleSendMessage(initialPrompt.trim())
      onPromptConsumed?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt])

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return

    if (!authenticated || !user?.id) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'assistant',
          content: 'Please connect your wallet first to use AI configuration.',
          timestamp: new Date(),
        },
      ])
      return
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/orbit/ai-parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userQuery: text, userId: user.id }),
      })

      if (!response.ok) throw new Error('Failed to generate configuration')

      const data = await response.json()

      if (data.success && data.config) {
        const config = data.config
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `Here's your configuration for "${config.chainConfig?.chainName || config.name}":\n\n• Chain ID: ${config.chainId}\n• Parent: ${config.parentChain}\n• Block time: ${config.chainConfig?.blockTime || 2}s\n• Token: ${config.chainConfig?.nativeToken?.symbol || 'ETH'}\n• Validators: ${config.validators?.length || 0}\n\nApply this to your form below.`,
          timestamp: new Date(),
          config,
        }
        setMessages((prev) => [...prev, aiMessage])
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content:
              data.message ||
              "I couldn't parse that. Could you be more specific? Try including a chain name, use case, or any requirements.",
            timestamp: new Date(),
          },
        ])
      }
    } catch (error: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `Error: ${error.message || 'Something went wrong'}. Please try again.`,
          timestamp: new Date(),
        },
      ])
    } finally {
      setIsLoading(false)
      inputRef.current?.focus()
    }
  }

  const handleSend = () => handleSendMessage(input)

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="rounded-lg border border-border">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3">
        <Sparkles className="size-4 text-muted-foreground" />
        <span className="text-sm font-medium">AI Configuration</span>
      </div>

      <Separator />

      {/* Messages */}
      <div ref={scrollContainerRef} className="max-h-80 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              'flex gap-2.5 items-start',
              message.role === 'user' ? 'flex-row-reverse' : '',
            )}
          >
            <div
              className={cn(
                'flex items-center justify-center shrink-0 size-6 rounded-full mt-0.5',
                message.role === 'user' ? 'bg-foreground' : 'bg-muted',
              )}
            >
              {message.role === 'user' ? (
                <User className="size-3 text-background" />
              ) : (
                <Bot className="size-3 text-foreground" />
              )}
            </div>
            <div
              className={cn(
                'rounded-lg px-3 py-2 max-w-[85%] text-sm leading-relaxed',
                message.role === 'user'
                  ? 'bg-foreground text-background'
                  : 'bg-muted/60',
              )}
            >
              <p className="whitespace-pre-wrap">{message.content}</p>
              {message.config && (
                <Button
                  onClick={() => onApplyConfig(message.config!)}
                  size="sm"
                  className="mt-2.5 gap-1.5 w-full"
                >
                  Apply Configuration
                  <ArrowRight className="size-3" />
                </Button>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-2.5 items-start">
            <div className="flex items-center justify-center shrink-0 size-6 rounded-full mt-0.5 bg-muted">
              <Bot className="size-3 text-foreground animate-pulse" />
            </div>
            <div className="bg-muted/60 rounded-lg px-3 py-2">
              <p className="text-sm text-muted-foreground">Generating configuration…</p>
            </div>
          </div>
        )}
      </div>

      <Separator />

      {/* Input */}
      <div className="flex items-center gap-2 p-2">
        <Input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe your chain requirements…"
          className="border-0 shadow-none focus-visible:border-transparent h-9 text-sm"
          disabled={isLoading}
        />
        <Button
          size="icon"
          variant="ghost"
          className="shrink-0 size-8"
          disabled={!input.trim() || isLoading}
          onClick={handleSend}
        >
          <Send className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}
