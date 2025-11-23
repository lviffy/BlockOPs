'use client';

import { useState } from 'react';
import { Rocket, Layers, Settings, Shield, Zap, Info, Sparkles } from 'lucide-react';
import { OrbitConfigForm } from '@/components/orbit/OrbitConfigForm';
import { DeploymentStatus } from '@/components/orbit/DeploymentStatus';
import { ConfigList } from '@/components/orbit/ConfigList';
import { OrbitAIChat } from '@/components/orbit/OrbitAIChat';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function OrbitBuilderPage() {
  const [activeTab, setActiveTab] = useState<'create' | 'deployments'>('create');
  const [selectedConfig, setSelectedConfig] = useState<string | null>(null);
  const [deploymentId, setDeploymentId] = useState<string | null>(null);
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const [aiGeneratedConfig, setAiGeneratedConfig] = useState<any>(null);

  const handleApplyAIConfig = (config: any) => {
    setAiGeneratedConfig(config);
    setActiveTab('create');
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-background via-background to-muted/20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8 lg:mb-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-muted rounded-lg">
                <Rocket className="w-7 h-7 text-foreground" />
              </div>
              <div>
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight">
                  <span className="bg-linear-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                    Orbit L3 Builder
                  </span>
                </h1>
                <p className="text-muted-foreground mt-1 text-sm sm:text-base">
                  Create and deploy custom Layer 3 chains on Arbitrum
                </p>
              </div>
            </div>
            <Button
              onClick={() => setAiChatOpen(true)}
              className="gap-2 bg-foreground hover:bg-foreground/90"
              size="lg"
            >
              <Sparkles className="w-4 h-4" />
              AI Assistant
            </Button>
          </div>

          {/* Feature Highlights */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-6">
            <Card className="transition-all duration-200 hover:shadow-lg hover:shadow-foreground/5">
              <CardContent className="p-4">
                <Layers className="w-5 h-5 text-foreground mb-2" />
                <h3 className="font-semibold text-sm">Custom L3 Chains</h3>
                <p className="text-muted-foreground text-xs mt-1">Build your own Layer 3 rollup</p>
              </CardContent>
            </Card>
            <Card className="transition-all duration-200 hover:shadow-lg hover:shadow-foreground/5">
              <CardContent className="p-4">
                <Settings className="w-5 h-5 text-foreground mb-2" />
                <h3 className="font-semibold text-sm">Flexible Config</h3>
                <p className="text-muted-foreground text-xs mt-1">Customize every parameter</p>
              </CardContent>
            </Card>
            <Card className="transition-all duration-200 hover:shadow-lg hover:shadow-foreground/5">
              <CardContent className="p-4">
                <Shield className="w-5 h-5 text-foreground mb-2" />
                <h3 className="font-semibold text-sm">Secure Deployment</h3>
                <p className="text-muted-foreground text-xs mt-1">Battle-tested contracts</p>
              </CardContent>
            </Card>
            <Card className="transition-all duration-200 hover:shadow-lg hover:shadow-foreground/5">
              <CardContent className="p-4">
                <Zap className="w-5 h-5 text-foreground mb-2" />
                <h3 className="font-semibold text-sm">One-Click Deploy</h3>
                <p className="text-muted-foreground text-xs mt-1">Deploy in minutes</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('create')}
            className={`px-6 py-2.5 rounded-lg font-semibold transition-all text-sm ${
              activeTab === 'create'
                ? 'bg-foreground text-background shadow-lg'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            Create Configuration
          </button>
          <button
            onClick={() => setActiveTab('deployments')}
            className={`px-6 py-2.5 rounded-lg font-semibold transition-all text-sm ${
              activeTab === 'deployments'
                ? 'bg-foreground text-background shadow-lg'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            My Deployments
          </button>
        </div>

        {/* Content */}
        <Card className="mb-8">
          <CardContent className="p-6">
            {activeTab === 'create' ? (
              <OrbitConfigForm 
                initialConfig={aiGeneratedConfig}
                onDeploymentStart={(depId) => {
                  setDeploymentId(depId);
                  setActiveTab('deployments');
                }}
              />
            ) : (
              <div className="space-y-6">
                {deploymentId && (
                  <DeploymentStatus deploymentId={deploymentId} />
                )}
                <ConfigList 
                  onSelectConfig={setSelectedConfig}
                  onDeploymentStart={(depId) => setDeploymentId(depId)}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info Section */}
        <Card className="bg-muted/50">
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-background rounded-lg shrink-0">
                <Info className="w-5 h-5 text-foreground" />
              </div>
              <div>
                <h3 className="text-lg font-bold mb-3">
                  About Arbitrum Orbit
                </h3>
                <div className="text-muted-foreground space-y-3 text-sm">
                  <p>
                    <strong className="text-foreground">Arbitrum Orbit</strong> allows you to create your own dedicated Layer 3 (L3) 
                    chains that settle to Arbitrum Layer 2 networks.
                  </p>
                  <div>
                    <strong className="text-foreground">Benefits:</strong>
                    <ul className="list-disc list-inside ml-2 space-y-1 mt-1">
                      <li>Full control over chain parameters and governance</li>
                      <li>Custom gas tokens and fee structures</li>
                      <li>Dedicated throughput and block space</li>
                      <li>Lower fees than L2, faster than L1</li>
                      <li>Seamless Arbitrum ecosystem interoperability</li>
                    </ul>
                  </div>
                  <p>
                    <strong className="text-foreground">Use Cases:</strong> Gaming, DeFi protocols, enterprise applications, 
                    NFT platforms, and high-throughput applications.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Chat Assistant */}
      <OrbitAIChat 
        open={aiChatOpen}
        onOpenChange={setAiChatOpen}
        onApplyConfig={handleApplyAIConfig}
      />
    </div>
  );
}
