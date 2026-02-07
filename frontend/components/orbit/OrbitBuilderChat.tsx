'use client';

import * as React from 'react';
import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Bot, User, Sparkles, Rocket, Check, Circle, RefreshCw, Wallet } from 'lucide-react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// API base URL for the AI backend
const AI_BACKEND_URL = process.env.NEXT_PUBLIC_ORBIT_AI_URL || 'http://localhost:8002';

// Simple markdown parser for bold text
function parseMarkdown(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  quickActions?: { label: string; value: string }[];
}

interface ConfigProgress {
  completed: string[];
  remaining: string[];
  percentage: number;
}

interface OrbitBuilderChatProps {
  onDeploymentStart?: (deploymentId: string) => void;
  className?: string;
}

export function OrbitBuilderChat({ onDeploymentStart, className }: OrbitBuilderChatProps) {
  const { user, authenticated, login } = usePrivy();
  const { wallets } = useWallets();
  
  const [sessionId, setSessionId] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [phase, setPhase] = useState<string>('greeting');
  const [currentStep, setCurrentStep] = useState<string>('use_case');
  const [configProgress, setConfigProgress] = useState<ConfigProgress | null>(null);
  const [config, setConfig] = useState<any>(null);
  const [collectedParams, setCollectedParams] = useState<Record<string, any>>({});
  const [error, setError] = useState<string | null>(null);
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const walletAddress = wallets && wallets.length > 0 ? wallets[0].address : null;
  
  // Generate session ID on mount
  useEffect(() => {
    const storedId = sessionStorage.getItem('orbit-ai-session');
    if (storedId) {
      setSessionId(storedId);
      // Restore session
      fetchSession(storedId);
    } else {
      const newId = crypto.randomUUID();
      setSessionId(newId);
      sessionStorage.setItem('orbit-ai-session', newId);
      // Start new session with greeting
      initSession(newId);
    }
  }, []);
  
  // Auto-scroll to bottom
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages]);
  
  const initSession = async (sid: string) => {
    // The first message will initialize the session
    try {
      const response = await fetch(`${AI_BACKEND_URL}/api/orbit-ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sid,
          message: 'hello',
          wallet_address: walletAddress,
          user_id: user?.id,
        }),
      });
      
      if (!response.ok) throw new Error('Failed to initialize session');
      
      const data = await response.json();
      handleChatResponse(data);
    } catch (err) {
      console.error('Init session error:', err);
      // Fallback greeting
      setMessages([{
        id: '1',
        role: 'assistant',
        content: "Hey! I'll help you build your own L3 chain. Let's start simple - what are you building?\n\nFor example:\n- A gaming platform\n- A DeFi protocol\n- An enterprise app\n- Something else",
        timestamp: new Date(),
      }]);
    }
  };
  
  const fetchSession = async (sid: string) => {
    try {
      const response = await fetch(`${AI_BACKEND_URL}/api/orbit-ai/session/${sid}`);
      if (response.ok) {
        const data = await response.json();
        setPhase(data.phase);
        setCurrentStep(data.current_step);
        setConfigProgress(data.config_progress);
        setConfig(data.config);
        // Populate config form with collected params
        if (data.collected_params) {
          setCollectedParams(data.collected_params);
        }
        setMessages(data.messages.map((m: any) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          timestamp: new Date(m.timestamp),
        })));
      } else {
        // Session expired, start new
        const newId = crypto.randomUUID();
        setSessionId(newId);
        sessionStorage.setItem('orbit-ai-session', newId);
        initSession(newId);
      }
    } catch (err) {
      console.error('Fetch session error:', err);
      initSession(sid);
    }
  };
  
  const handleChatResponse = (data: any) => {
    setPhase(data.phase);
    setCurrentStep(data.current_step);
    setConfigProgress(data.config_progress);
    if (data.config) setConfig(data.config);
    
    // Update collected params for live form
    if (data.collected_params) {
      setCollectedParams(data.collected_params);
    }
    
    // Add AI message
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'assistant',
      content: data.message,
      timestamp: new Date(),
      quickActions: data.quick_actions,
    }]);
  };
  
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;
    
    setError(null);
    
    // Add user message immediately
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    
    try {
      const response = await fetch(`${AI_BACKEND_URL}/api/orbit-ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          message: text,
          wallet_address: walletAddress,
          user_id: user?.id,
        }),
      });
      
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || 'Failed to get response');
      }
      
      const data = await response.json();
      handleChatResponse(data);
      
    } catch (err: any) {
      console.error('Send message error:', err);
      setError(err.message);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Sorry, something went wrong: ${err.message}. Please try again.`,
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }, [sessionId, walletAddress, user?.id, isLoading]);
  
  const handleQuickAction = (value: string) => {
    sendMessage(value);
  };
  
  const handleDeploy = async () => {
    if (!config) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${AI_BACKEND_URL}/api/orbit-ai/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
        }),
      });
      
      const data = await response.json().catch(() => ({}));
      
      if (!response.ok) {
        const errorMsg = data.detail || data.message || 'Deployment failed';
        throw new Error(errorMsg);
      }
      
      onDeploymentStart?.(data.deployment_id);
      
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: `Deployment started: ${data.message}\n\nDeployment ID: ${data.deployment_id}`,
        timestamp: new Date(),
      }]);
      setPhase('deploying');
      
    } catch (err: any) {
      const errorMessage = err.message || 'Unknown error occurred';
      setError(errorMessage);
      
      // Show deployment failure in chat
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: `Deployment Failed\n\n${errorMessage}\n\nPlease check your configuration and try again. You can type "deploy" to retry.`,
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleReset = async () => {
    try {
      await fetch(`${AI_BACKEND_URL}/api/orbit-ai/session/${sessionId}/reset`, {
        method: 'POST',
      });
      setMessages([]);
      setConfig(null);
      setCollectedParams({});
      setPhase('greeting');
      setCurrentStep('use_case');
      setConfigProgress(null);
      setError(null);
      initSession(sessionId);
    } catch (err) {
      console.error('Reset error:', err);
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };
  
  // Step labels for progress display
  const stepLabels: Record<string, string> = {
    use_case: 'Use Case',
    chain_name: 'Chain Name',
    parent_chain: 'Parent Chain',
    data_availability: 'Data Availability',
    validators: 'Validators',
    owner_address: 'Owner',
    native_token: 'Native Token',
    block_time: 'Block Time',
    gas_limit: 'Gas Limit',
    challenge_period: 'Challenge Period',
    complete: 'Review',
  };
  
  return (
    <div className={cn("rounded-lg border border-border flex flex-col", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">AI Config Builder</span>
          {phase && (
            <Badge variant="outline" className="text-xs capitalize">
              {phase}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {walletAddress && (
            <Badge variant="secondary" className="text-xs font-mono">
              <Wallet className="size-3 mr-1" />
              {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
            </Badge>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={handleReset}
            title="Start over"
          >
            <RefreshCw className="size-3.5" />
          </Button>
        </div>
      </div>
      
      <Separator />
      
      {/* Progress Bar */}
      {configProgress && configProgress.percentage > 0 && (
        <div className="px-4 py-2 bg-muted/30">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
            <span>Configuration Progress</span>
            <span>{configProgress.percentage}%</span>
          </div>
          <div className="flex gap-1">
            {Object.keys(stepLabels).map((step) => {
              if (step === 'complete') return null;
              const isCompleted = configProgress.completed.includes(step);
              const isCurrent = step === currentStep;
              return (
                <div
                  key={step}
                  className={cn(
                    "h-1.5 flex-1 rounded-full transition-colors",
                    isCompleted ? "bg-green-500" :
                    isCurrent ? "bg-blue-500" :
                    "bg-muted"
                  )}
                  title={stepLabels[step]}
                />
              );
            })}
          </div>
        </div>
      )}
      
      {/* Messages */}
      <div ref={scrollContainerRef} className="flex-1 max-h-[400px] overflow-y-auto px-4 py-4 space-y-4">
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
              <p className="whitespace-pre-wrap">
                {message.role === 'assistant' 
                  ? parseMarkdown(message.content)
                  : message.content
                }
              </p>
              
              {/* Quick action buttons */}
              {message.quickActions && message.quickActions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {message.quickActions.map((action, idx) => (
                    <Button
                      key={idx}
                      variant="outline"
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => handleQuickAction(action.value)}
                    >
                      {action.label}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        
        {/* Loading indicator */}
        {isLoading && (
          <div className="flex gap-2.5 items-start">
            <div className="flex items-center justify-center shrink-0 size-6 rounded-full mt-0.5 bg-muted">
              <Bot className="size-3 text-foreground animate-pulse" />
            </div>
            <div className="bg-muted/60 rounded-lg px-3 py-2">
              <p className="text-sm text-muted-foreground">Thinking…</p>
            </div>
          </div>
        )}
        
        {/* Config preview card */}
        {phase === 'review' && config && (
          <div className="border border-border rounded-lg p-4 bg-card">
            <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
              <Check className="size-4 text-green-500" />
              Configuration Ready
            </h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="text-muted-foreground">Chain Name</div>
              <div className="font-mono">{config.chainConfig?.chainName || config.name}</div>
              <div className="text-muted-foreground">Chain ID</div>
              <div className="font-mono">{config.chainId}</div>
              <div className="text-muted-foreground">Parent Chain</div>
              <div>{config.parentChain}</div>
              <div className="text-muted-foreground">DA Mode</div>
              <div className="capitalize">{config.dataAvailability || 'anytrust'}</div>
              <div className="text-muted-foreground">Validators</div>
              <div>{config.validators?.length || 0}</div>
              <div className="text-muted-foreground">Block Time</div>
              <div>{config.chainConfig?.blockTime || 2}s</div>
            </div>
            <Button 
              className="w-full mt-4 gap-2" 
              onClick={handleDeploy}
              disabled={isLoading}
            >
              <Rocket className="size-4" />
              Deploy Chain
            </Button>
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
          placeholder={
            phase === 'review' 
              ? "Type 'deploy' or ask to edit a setting..." 
              : "Describe your requirements..."
          }
          className="border-0 shadow-none focus-visible:border-transparent h-9 text-sm"
          disabled={isLoading}
        />
        <Button
          size="icon"
          variant="ghost"
          className="shrink-0 size-8"
          disabled={!input.trim() || isLoading}
          onClick={() => sendMessage(input)}
        >
          <Send className="size-3.5" />
        </Button>
      </div>
      
      {/* Error display */}
      {error && (
        <div className="px-4 pb-2">
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}
      
      {/* Config Form - styled as input boxes */}
      <div className="border-t border-border bg-muted/30 p-4">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-medium">Chain Configuration</h4>
          <span className="text-xs text-muted-foreground">
            {Object.keys(collectedParams).filter(k => !k.startsWith('_')).length}/10 fields
          </span>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          {/* Use Case */}
          <div>
            <label className="block text-[11px] text-muted-foreground mb-1">Use Case</label>
            <div className="px-3 py-2 rounded-md border border-border bg-background text-sm">
              {collectedParams.use_case ? (
                <span className="capitalize">{collectedParams.use_case}</span>
              ) : (
                <span className="text-muted-foreground italic">Waiting...</span>
              )}
            </div>
          </div>
          
          {/* Chain Name */}
          <div>
            <label className="block text-[11px] text-muted-foreground mb-1">Chain Name</label>
            <div className="px-3 py-2 rounded-md border border-border bg-background text-sm font-mono">
              {collectedParams.chain_name || <span className="text-muted-foreground italic font-sans">Waiting...</span>}
            </div>
          </div>
          
          {/* Parent Chain */}
          <div>
            <label className="block text-[11px] text-muted-foreground mb-1">Parent Chain</label>
            <div className="px-3 py-2 rounded-md border border-border bg-background text-sm">
              {collectedParams.parent_chain || <span className="text-muted-foreground italic">Waiting...</span>}
            </div>
          </div>
          
          {/* Data Availability */}
          <div>
            <label className="block text-[11px] text-muted-foreground mb-1">Data Availability</label>
            <div className="px-3 py-2 rounded-md border border-border bg-background text-sm capitalize">
              {collectedParams.data_availability || <span className="text-muted-foreground italic normal-case">Waiting...</span>}
            </div>
          </div>
          
          {/* Validators */}
          <div>
            <label className="block text-[11px] text-muted-foreground mb-1">Validators</label>
            <div className="px-3 py-2 rounded-md border border-border bg-background text-sm">
              {collectedParams.validators || <span className="text-muted-foreground italic">Waiting...</span>}
            </div>
          </div>
          
          {/* Owner Address */}
          <div>
            <label className="block text-[11px] text-muted-foreground mb-1">Owner Address</label>
            <div className="px-3 py-2 rounded-md border border-border bg-background text-sm font-mono truncate"
                 title={collectedParams.owner_address || undefined}>
              {collectedParams.owner_address ? (
                `${collectedParams.owner_address.slice(0,10)}...${collectedParams.owner_address.slice(-6)}`
              ) : (
                <span className="text-muted-foreground italic font-sans">Waiting...</span>
              )}
            </div>
          </div>
          
          {/* Gas Token */}
          <div>
            <label className="block text-[11px] text-muted-foreground mb-1">Gas Token</label>
            <div className="px-3 py-2 rounded-md border border-border bg-background text-sm">
              {collectedParams.native_token ? (
                typeof collectedParams.native_token === 'object' 
                  ? collectedParams.native_token.symbol 
                  : collectedParams.native_token
              ) : (
                <span className="text-muted-foreground italic">Waiting...</span>
              )}
            </div>
          </div>
          
          {/* Block Time */}
          <div>
            <label className="block text-[11px] text-muted-foreground mb-1">Block Time</label>
            <div className="px-3 py-2 rounded-md border border-border bg-background text-sm">
              {collectedParams.block_time ? `${collectedParams.block_time}s` : <span className="text-muted-foreground italic">Waiting...</span>}
            </div>
          </div>
          
          {/* Gas Limit */}
          <div>
            <label className="block text-[11px] text-muted-foreground mb-1">Gas Limit</label>
            <div className="px-3 py-2 rounded-md border border-border bg-background text-sm">
              {collectedParams.gas_limit ? `${(collectedParams.gas_limit / 1_000_000).toFixed(0)}M` : <span className="text-muted-foreground italic">Waiting...</span>}
            </div>
          </div>
          
          {/* Challenge Period */}
          <div>
            <label className="block text-[11px] text-muted-foreground mb-1">Challenge Period</label>
            <div className="px-3 py-2 rounded-md border border-border bg-background text-sm">
              {collectedParams.challenge_period ? `${collectedParams.challenge_period} days` : <span className="text-muted-foreground italic">Waiting...</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
