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
  const [defaultParams, setDefaultParams] = useState<string[]>([]);
  const [changedFields, setChangedFields] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  
  const prevParamsRef = useRef<Record<string, any>>({});
  const prevCompletedRef = useRef<string[]>([]);
  const latestUserMsgRef = useRef<string>('');
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Use-case presets for auto-filling recommended defaults
  const useCasePresets: Record<string, Record<string, any>> = {
    gaming: { data_availability: 'anytrust', block_time: 1, gas_limit: 50000000, validators: 3, challenge_period: 7, native_token: { name: 'Ether', symbol: 'ETH', decimals: 18 }, parent_chain: 'arbitrum-sepolia' },
    defi: { data_availability: 'rollup', block_time: 2, gas_limit: 30000000, validators: 5, challenge_period: 7, native_token: { name: 'Ether', symbol: 'ETH', decimals: 18 }, parent_chain: 'arbitrum-sepolia' },
    enterprise: { data_availability: 'anytrust', block_time: 3, gas_limit: 30000000, validators: 5, challenge_period: 14, native_token: { name: 'Ether', symbol: 'ETH', decimals: 18 }, parent_chain: 'arbitrum-sepolia' },
    nft: { data_availability: 'anytrust', block_time: 2, gas_limit: 40000000, validators: 3, challenge_period: 7, native_token: { name: 'Ether', symbol: 'ETH', decimals: 18 }, parent_chain: 'arbitrum-sepolia' },
    general: { data_availability: 'anytrust', block_time: 2, gas_limit: 30000000, validators: 3, challenge_period: 7, native_token: { name: 'Ether', symbol: 'ETH', decimals: 18 }, parent_chain: 'arbitrum-sepolia' },
  };
  
  // Track which fields changed for highlight animation
  useEffect(() => {
    const prev = prevParamsRef.current;
    const newChanged = new Set<string>();
    
    const paramKeys = ['use_case', 'chain_name', 'parent_chain', 'data_availability', 
                       'validators', 'owner_address', 'native_token', 'block_time', 
                       'gas_limit', 'challenge_period'];
    
    for (const key of paramKeys) {
      const prevVal = JSON.stringify(prev[key]);
      const newVal = JSON.stringify(collectedParams[key]);
      if (prevVal !== newVal && collectedParams[key] !== undefined) {
        newChanged.add(key);
      }
    }
    
    if (newChanged.size > 0) {
      setChangedFields(newChanged);
      // Clear highlights after animation
      const timer = setTimeout(() => setChangedFields(new Set()), 1500);
      prevParamsRef.current = { ...collectedParams };
      return () => clearTimeout(timer);
    }
    
    prevParamsRef.current = { ...collectedParams };
  }, [collectedParams]);
  
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
          const cleanParams: Record<string, any> = {};
          for (const [key, value] of Object.entries(data.collected_params)) {
            if (!key.startsWith('_')) {
              cleanParams[key] = value;
            }
          }
          if (Object.keys(cleanParams).length > 0) {
            setCollectedParams(cleanParams);
          }
          if (data.collected_params._defaults) {
            setDefaultParams(data.collected_params._defaults);
          }
        }
        setMessages(data.messages.map((m: any) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          timestamp: new Date(m.timestamp),
        })));
      } else {
        // Session expired or not found — start fresh
        sessionStorage.removeItem('orbit-ai-session');
        const newId = crypto.randomUUID();
        setSessionId(newId);
        sessionStorage.setItem('orbit-ai-session', newId);
        initSession(newId);
      }
    } catch (err) {
      console.error('Fetch session error:', err);
      sessionStorage.removeItem('orbit-ai-session');
      const newId = crypto.randomUUID();
      setSessionId(newId);
      sessionStorage.setItem('orbit-ai-session', newId);
      initSession(newId);
    }
  };
  
  const handleChatResponse = (data: any) => {
    setPhase(data.phase);
    setCurrentStep(data.current_step);
    setConfigProgress(data.config_progress);
    if (data.config) setConfig(data.config);
    
    // Always sync collected_params from backend (source of truth)
    if (data.collected_params) {
      // Extract clean params (without internal _ keys) and merge
      const backendParams = { ...data.collected_params };
      const backendDefaults: string[] = backendParams._defaults || [];
      
      // Remove internal keys from params before setting state
      const cleanParams: Record<string, any> = {};
      for (const [key, value] of Object.entries(backendParams)) {
        if (!key.startsWith('_')) {
          cleanParams[key] = value;
        }
      }
      
      // Only update if there are actual config values
      if (Object.keys(cleanParams).length > 0) {
        setCollectedParams(prev => {
          // Backend is source of truth - its values always override frontend state
          const updated = { ...prev };
          
          // Apply all backend values, overwriting any existing values
          for (const [key, value] of Object.entries(cleanParams)) {
            // Always update with backend value (source of truth)
            updated[key] = value;
          }
          
          // If use_case was just detected and we don't have defaults yet,
          // fill in frontend preset defaults for any missing fields
          if (updated.use_case && !prev.use_case) {
            const presetKey = String(updated.use_case || 'general').toLowerCase();
            const preset = useCasePresets[presetKey] || useCasePresets.general;
            for (const [key, val] of Object.entries(preset)) {
              // Only set preset defaults for fields NOT provided by backend
              if (!(key in cleanParams) && (updated[key] === undefined || updated[key] === null)) {
                updated[key] = val;
              }
            }
          }
          
          return updated;
        });
        
        // Sync default field tracking from backend (outside the updater)
        if (backendDefaults.length > 0) {
          setDefaultParams(backendDefaults);
        }
      }
      
      if (data.config_progress?.completed) {
        prevCompletedRef.current = [...data.config_progress.completed];
      }
    } else {
      // Backend didn't provide collected_params — infer from completed steps diff
      const newCompleted = data.config_progress?.completed || [];
      const oldCompleted = prevCompletedRef.current;
      const newlyCompleted = newCompleted.filter((s: string) => !oldCompleted.includes(s));
      prevCompletedRef.current = [...newCompleted];
      
      if (newlyCompleted.length > 0 && latestUserMsgRef.current) {
        const userMsg = latestUserMsgRef.current;
        
        setCollectedParams(prev => {
          const updated = { ...prev };
          
          for (const step of newlyCompleted) {
            // Only infer value if not already set by backend
            // Skip chain_name inference - it often gets wrong values from use_case messages
            if (step === 'chain_name') continue;
            if (step in updated && updated[step] !== undefined && updated[step] !== null) continue;
            const val = inferValueForStep(step, userMsg);
            if (val !== null) {
              updated[step] = val;
            }
          }
          
          // If use_case was just detected, pre-fill defaults
          if (updated.use_case && !prev.use_case) {
            const presetKey = String(updated.use_case || 'general').toLowerCase();
            const preset = useCasePresets[presetKey] || useCasePresets.general;
            const dKeys: string[] = [];
            for (const [key, val] of Object.entries(preset)) {
              if (updated[key] === undefined || updated[key] === null) {
                updated[key] = val;
                dKeys.push(key);
              }
            }
            // Set defaults outside the updater via a timeout to avoid side effects
            setTimeout(() => setDefaultParams(dKeys), 0);
          } else {
            setTimeout(() => setDefaultParams(dp => dp.filter(k => !newlyCompleted.includes(k))), 0);
          }
          
          return updated;
        });
      }
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
  
  /** Handle direct edits to config fields from the form */
  const handleParamChange = (key: string, value: any) => {
    setCollectedParams(prev => ({ ...prev, [key]: value }));
    // Remove from defaults since user explicitly set it
    setDefaultParams(prev => prev.filter(k => k !== key));
    // Highlight the changed field
    setChangedFields(new Set([key]));
    setTimeout(() => setChangedFields(new Set()), 1500);
  };
  
  /** Infer the config value from user text based on which step it corresponds to */
  const inferValueForStep = (step: string, text: string): any => {
    const t = text.toLowerCase().trim();
    switch (step) {
      case 'use_case': {
        if (t.includes('gaming') || t.includes('game')) return 'gaming';
        if (t.includes('defi') || t.includes('finance') || t.includes('trading')) return 'defi';
        if (t.includes('enterprise') || t.includes('business')) return 'enterprise';
        if (t.includes('nft') || t.includes('collectible')) return 'nft';
        return 'general';
      }
      case 'chain_name':
        return text.trim();
      case 'parent_chain': {
        if (t.includes('sepolia') || t.includes('test')) return 'arbitrum-sepolia';
        if (t.includes('one') || t.includes('main')) return 'arbitrum-one';
        if (t.includes('nova')) return 'arbitrum-nova';
        return 'arbitrum-sepolia';
      }
      case 'data_availability': {
        if (t.includes('rollup')) return 'rollup';
        return 'anytrust';
      }
      case 'validators': {
        const m = t.match(/(\d+)/);
        return m ? parseInt(m[1]) : 3;
      }
      case 'owner_address': {
        const m = t.match(/0x[a-fA-F0-9]{40}/);
        if (m) return m[0];
        if (walletAddress && (t.includes('wallet') || t.includes('my') || t.includes('yes') || t.includes('sure') || t.includes('ok'))) {
          return walletAddress;
        }
        return null;
      }
      case 'native_token': {
        if (t.includes('custom')) return { name: 'Custom', symbol: 'TOKEN', decimals: 18 };
        return { name: 'Ether', symbol: 'ETH', decimals: 18 };
      }
      case 'block_time': {
        const m = t.match(/(\d+)/);
        return m ? parseInt(m[1]) : 2;
      }
      case 'gas_limit': {
        const m = t.match(/(\d{7,9})/);
        if (m) return parseInt(m[0]);
        if (t.includes('50') || t.includes('high')) return 50000000;
        return 30000000;
      }
      case 'challenge_period': {
        if (t.includes('14')) return 14;
        return 7;
      }
      default:
        return null;
    }
  };
  
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;
    
    setError(null);
    latestUserMsgRef.current = text.trim();
    
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
      setDefaultParams([]);
      setChangedFields(new Set());
      prevCompletedRef.current = [];
      latestUserMsgRef.current = '';
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
    <div className={cn("flex flex-col gap-4", className)}>
      {/* AI Chat Box */}
      <div className="rounded-lg border border-border flex flex-col h-[520px]">
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
      <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4">
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
      </div>
      
      {/* Chain Configuration - editable form */}
      <div className="rounded-lg border border-border bg-muted/30 p-4">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-medium">Chain Configuration</h4>
          <span className="text-xs text-muted-foreground">
            {Object.keys(collectedParams).filter(k => !k.startsWith('_') && collectedParams[k] !== undefined && collectedParams[k] !== null && collectedParams[k] !== '').length}/10 fields
          </span>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          {/* Use Case */}
          <ConfigField 
            label="Use Case" 
            fieldKey="use_case"
            value={collectedParams.use_case}
            isDefault={defaultParams.includes('use_case')}
            isHighlighted={changedFields.has('use_case')}
            inputType="select"
            options={[
              { value: 'gaming', label: 'Gaming' },
              { value: 'defi', label: 'DeFi' },
              { value: 'enterprise', label: 'Enterprise' },
              { value: 'nft', label: 'NFT' },
              { value: 'general', label: 'General' },
            ]}
            onChange={(val) => handleParamChange('use_case', val)}
          />
          
          {/* Chain Name */}
          <ConfigField 
            label="Chain Name" 
            fieldKey="chain_name"
            value={collectedParams.chain_name}
            isDefault={defaultParams.includes('chain_name')}
            isHighlighted={changedFields.has('chain_name')}
            inputType="text"
            className="font-mono"
            onChange={(val) => handleParamChange('chain_name', val)}
          />
          
          {/* Parent Chain */}
          <ConfigField 
            label="Parent Chain" 
            fieldKey="parent_chain"
            value={collectedParams.parent_chain}
            isDefault={defaultParams.includes('parent_chain')}
            isHighlighted={changedFields.has('parent_chain')}
            inputType="select"
            options={[
              { value: 'arbitrum-sepolia', label: 'Arbitrum Sepolia' },
              { value: 'arbitrum-one', label: 'Arbitrum One' },
              { value: 'arbitrum-nova', label: 'Arbitrum Nova' },
            ]}
            onChange={(val) => handleParamChange('parent_chain', val)}
          />
          
          {/* Data Availability */}
          <ConfigField 
            label="Data Availability" 
            fieldKey="data_availability"
            value={collectedParams.data_availability}
            isDefault={defaultParams.includes('data_availability')}
            isHighlighted={changedFields.has('data_availability')}
            inputType="select"
            options={[
              { value: 'anytrust', label: 'Anytrust' },
              { value: 'rollup', label: 'Rollup' },
            ]}
            onChange={(val) => handleParamChange('data_availability', val)}
          />
          
          {/* Validators */}
          <ConfigField 
            label="Validators" 
            fieldKey="validators"
            value={collectedParams.validators}
            isDefault={defaultParams.includes('validators')}
            isHighlighted={changedFields.has('validators')}
            inputType="number"
            numberMin={1}
            numberMax={20}
            onChange={(val) => handleParamChange('validators', val)}
          />
          
          {/* Owner Address */}
          <ConfigField 
            label="Owner Address" 
            fieldKey="owner_address"
            value={collectedParams.owner_address}
            isDefault={defaultParams.includes('owner_address')}
            isHighlighted={changedFields.has('owner_address')}
            inputType="text"
            placeholder={walletAddress ? `${walletAddress.slice(0,10)}...` : '0x...'}
            className="font-mono"
            onChange={(val) => handleParamChange('owner_address', val)}
          />
          
          {/* Gas Token */}
          <ConfigField 
            label="Gas Token" 
            fieldKey="native_token"
            value={collectedParams.native_token}
            isDefault={defaultParams.includes('native_token')}
            isHighlighted={changedFields.has('native_token')}
            inputType="select"
            options={[
              { value: 'ETH', label: 'ETH' },
              { value: 'CUSTOM', label: 'Custom Token' },
            ]}
            displayValue={typeof collectedParams.native_token === 'object' ? collectedParams.native_token?.symbol : collectedParams.native_token}
            onChange={(val) => {
              if (val === 'ETH') handleParamChange('native_token', { name: 'Ether', symbol: 'ETH', decimals: 18 });
              else handleParamChange('native_token', { name: 'Custom', symbol: 'TOKEN', decimals: 18 });
            }}
          />
          
          {/* Block Time */}
          <ConfigField 
            label="Block Time" 
            fieldKey="block_time"
            value={collectedParams.block_time}
            isDefault={defaultParams.includes('block_time')}
            isHighlighted={changedFields.has('block_time')}
            inputType="number"
            numberMin={1}
            numberMax={30}
            suffix="s"
            onChange={(val) => handleParamChange('block_time', val)}
          />
          
          {/* Gas Limit */}
          <ConfigField 
            label="Gas Limit" 
            fieldKey="gas_limit"
            value={collectedParams.gas_limit}
            isDefault={defaultParams.includes('gas_limit')}
            isHighlighted={changedFields.has('gas_limit')}
            inputType="select"
            options={[
              { value: '30000000', label: '30M' },
              { value: '40000000', label: '40M' },
              { value: '50000000', label: '50M' },
            ]}
            displayValue={collectedParams.gas_limit ? `${(collectedParams.gas_limit / 1_000_000).toFixed(0)}M` : undefined}
            onChange={(val) => handleParamChange('gas_limit', parseInt(val))}
          />
          
          {/* Challenge Period */}
          <ConfigField 
            label="Challenge Period" 
            fieldKey="challenge_period"
            value={collectedParams.challenge_period}
            isDefault={defaultParams.includes('challenge_period')}
            isHighlighted={changedFields.has('challenge_period')}
            inputType="select"
            options={[
              { value: '7', label: '7 days' },
              { value: '14', label: '14 days' },
            ]}
            displayValue={collectedParams.challenge_period ? `${collectedParams.challenge_period} days` : undefined}
            onChange={(val) => handleParamChange('challenge_period', parseInt(val))}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Editable config field component with real-time update animations.
 * Supports text, number, and select inputs. Highlights on change
 * and differentiates between preset defaults and user-confirmed values.
 */
function ConfigField({ 
  label, 
  fieldKey,
  value, 
  isDefault = false,
  isHighlighted = false,
  className = '',
  inputType = 'text',
  options,
  placeholder,
  suffix,
  numberMin,
  numberMax,
  displayValue,
  onChange,
}: { 
  label: string;
  fieldKey: string;
  value: any;
  isDefault?: boolean;
  isHighlighted?: boolean;
  className?: string;
  inputType?: 'text' | 'number' | 'select';
  options?: { value: string; label: string }[];
  placeholder?: string;
  suffix?: string;
  numberMin?: number;
  numberMax?: number;
  displayValue?: string;
  onChange?: (value: any) => void;
}) {
  const hasValue = value !== undefined && value !== null && value !== '';
  
  // For select inputs with complex values (like native_token), use displayValue
  const selectValue = displayValue !== undefined 
    ? (options?.find(o => o.label === displayValue)?.value ?? String(value))
    : String(value ?? '');
  
  return (
    <div>
      <label className="block text-[11px] text-muted-foreground mb-1">
        {label}
        {hasValue && isDefault && (
          <span className="ml-1 text-[10px] text-blue-500/70">(recommended)</span>
        )}
      </label>
      <div 
        className={cn(
          "rounded-md border bg-background text-sm transition-all duration-500",
          isHighlighted 
            ? "border-green-500/70 bg-green-500/5 ring-1 ring-green-500/20" 
            : hasValue && !isDefault
              ? "border-border"
              : hasValue && isDefault
                ? "border-blue-500/30 bg-blue-500/[0.03]"
                : "border-border",
        )}
      >
        {inputType === 'select' && options ? (
          <select
            value={selectValue}
            onChange={(e) => onChange?.(e.target.value)}
            className={cn(
              "w-full px-3 py-2 bg-transparent text-sm rounded-md outline-none cursor-pointer",
              className,
              !hasValue && "text-muted-foreground",
              isDefault && !isHighlighted ? "text-muted-foreground" : "text-foreground"
            )}
          >
            {!hasValue && <option value="">Waiting...</option>}
            {options.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        ) : inputType === 'number' ? (
          <div className="flex items-center">
            <input
              type="number"
              value={hasValue ? value : ''}
              min={numberMin}
              max={numberMax}
              placeholder={placeholder || 'Waiting...'}
              onChange={(e) => {
                const num = parseInt(e.target.value);
                if (!isNaN(num)) onChange?.(num);
              }}
              className={cn(
                "w-full px-3 py-2 bg-transparent text-sm rounded-md outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                className,
                isDefault && !isHighlighted ? "text-muted-foreground" : "text-foreground"
              )}
            />
            {suffix && hasValue && (
              <span className="pr-3 text-sm text-muted-foreground shrink-0">{suffix}</span>
            )}
          </div>
        ) : (
          <input
            type="text"
            value={hasValue ? String(value) : ''}
            placeholder={placeholder || 'Waiting...'}
            onChange={(e) => onChange?.(e.target.value)}
            className={cn(
              "w-full px-3 py-2 bg-transparent text-sm rounded-md outline-none",
              className,
              isDefault && !isHighlighted ? "text-muted-foreground" : "text-foreground"
            )}
          />
        )}
      </div>
    </div>
  );
}
