'use client';

import { useState } from 'react';
import { Layers, Settings, Shield, Zap, ChevronRight, Plus, List, User, Wallet, LogOut } from 'lucide-react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { OrbitBuilderChat } from '@/components/orbit/OrbitBuilderChat';
import { DeploymentStatus } from '@/components/orbit/DeploymentStatus';
import { ConfigList } from '@/components/orbit/ConfigList';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

const features = [
  { icon: Layers, title: 'Custom L3 Chains', desc: 'Build your own Layer 3 rollup' },
  { icon: Settings, title: 'Flexible Config', desc: 'Customize every parameter' },
  { icon: Shield, title: 'Secure Deployment', desc: 'Battle-tested contracts' },
  { icon: Zap, title: 'One-Click Deploy', desc: 'Deploy in minutes' },
];

export default function OrbitBuilderPage() {
  const { authenticated, login, logout } = usePrivy();
  const { wallets } = useWallets();
  const [activeTab, setActiveTab] = useState('create');
  const [selectedConfig, setSelectedConfig] = useState<string | null>(null);
  const [deploymentId, setDeploymentId] = useState<string | null>(null);
  const walletAddress = wallets && wallets.length > 0 ? wallets[0].address : null;
  const truncatedAddress = walletAddress 
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
    : 'Not connected';

  const handleDisconnect = () => {
    logout();
  };

  return (
    <div className="min-h-screen bg-background" style={{ scrollbarGutter: 'stable' }}>
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-10 lg:py-14">
        {/* Header */}
        <header className="mb-10">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-semibold tracking-tight">
                  Orbit L3 Builder
                </h1>
              </div>
              <p className="text-sm text-muted-foreground">
                Create and deploy custom Layer 3 chains on Arbitrum
              </p>
            </div>
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <button className="shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                  <Avatar className="size-9 cursor-pointer">
                    <AvatarImage src="" alt="User" />
                    <AvatarFallback className="bg-muted">
                      <User className="size-4 text-muted-foreground" />
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-xs text-muted-foreground">Wallet</p>
                    <p className="text-xs font-mono leading-none">
                      {truncatedAddress}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <Wallet className="mr-2 size-4" />
                  {authenticated && walletAddress ? 'Connected' : 'Not Connected'}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={handleDisconnect}>
                  <LogOut className="mr-2 size-4" />
                  Disconnect
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <Separator className="mt-6" />

          {/* Feature cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
            {features.map((f) => (
              <div
                key={f.title}
                className="flex flex-col items-start gap-2 rounded-lg border border-border p-3"
              >
                <f.icon className="size-4 text-muted-foreground" />
                <div>
                  <p className="font-medium text-sm leading-none">{f.title}</p>
                  <p className="text-muted-foreground text-xs mt-1 leading-tight">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </header>

        {/* Main content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="w-full">
            <TabsTrigger value="create" className="gap-1.5">
              <Plus className="size-3.5" />
              Create Configuration
            </TabsTrigger>
            <TabsTrigger value="deployments" className="gap-1.5">
              <List className="size-3.5" />
              My Deployments
            </TabsTrigger>
          </TabsList>

          <TabsContent value="create">
            <OrbitBuilderChat
              className="min-h-[500px]"
              onDeploymentStart={(depId) => {
                setDeploymentId(depId);
                setActiveTab('deployments');
              }}
            />
          </TabsContent>

          <TabsContent value="deployments">
            <div className="space-y-6">
              {deploymentId && (
                <DeploymentStatus deploymentId={deploymentId} />
              )}
              <ConfigList
                onSelectConfig={setSelectedConfig}
                onDeploymentStart={(depId) => setDeploymentId(depId)}
              />
            </div>
          </TabsContent>
        </Tabs>

        {/* Info accordion */}
        <div className="mt-10">
          <Separator className="mb-6" />
          <Accordion type="single" collapsible>
            <AccordionItem value="about" className="border-none">
              <AccordionTrigger className="py-3 hover:no-underline">
                <span className="text-sm font-medium">About Arbitrum Orbit</span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 text-sm text-muted-foreground pt-1">
                  <p>
                    <strong className="text-foreground font-medium">Arbitrum Orbit</strong> allows you to create your own dedicated Layer 3 (L3)
                    chains that settle to Arbitrum Layer 2 networks.
                  </p>

                  <div>
                    <p className="text-foreground font-medium mb-2">Benefits</p>
                    <ul className="space-y-1.5">
                      {[
                        'Full control over chain parameters and governance',
                        'Custom gas tokens and fee structures',
                        'Dedicated throughput and block space',
                        'Lower fees than L2, faster than L1',
                        'Seamless Arbitrum ecosystem interoperability',
                      ].map((item) => (
                        <li key={item} className="flex items-center gap-2">
                          <ChevronRight className="size-3 text-muted-foreground/60 shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <p className="text-foreground font-medium mb-2">Use Cases</p>
                    <div className="flex flex-wrap gap-1.5">
                      {['Gaming', 'DeFi Protocols', 'Enterprise', 'NFT Platforms', 'High-Throughput Apps'].map((tag) => (
                        <Badge key={tag} variant="outline" className="font-normal">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>
    </div>
  );
}
