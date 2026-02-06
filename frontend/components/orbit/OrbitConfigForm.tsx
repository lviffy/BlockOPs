'use client';

import { useState, useEffect } from 'react';
import { Save, Rocket, AlertCircle, CheckCircle2, Trash2, Plus, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';

interface OrbitConfigFormProps {
  onDeploymentStart?: (deploymentId: string) => void;
  initialConfig?: any;
}

export function OrbitConfigForm({ onDeploymentStart, initialConfig }: OrbitConfigFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [configId, setConfigId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    chainId: '',
    description: '',
    parentChain: 'arbitrum-sepolia',
    nativeToken: '',
    dataAvailability: 'anytrust',
    validators: [''],
    challengePeriod: '604800',
    stakeToken: '',
    l2GasPrice: '0.1',
    l1GasPrice: '10',
    sequencerAddress: '',
    ownerAddress: '',
    batchPosterAddress: '',
  });

  // Apply AI-generated config when it changes
  useEffect(() => {
    if (initialConfig) {
      const newFormData: any = {
        name: initialConfig.name || '',
        chainId: initialConfig.chainId || '',
        description: initialConfig.chainConfig?.chainName || '',
        parentChain: initialConfig.parentChain || 'arbitrum-sepolia',
        nativeToken: initialConfig.chainConfig?.nativeToken?.symbol || '',
        dataAvailability: 'anytrust',
        validators: initialConfig.validators || [''],
        challengePeriod: '604800',
        stakeToken: '',
        l2GasPrice: '0.1',
        l1GasPrice: '10',
        sequencerAddress: initialConfig.chainConfig?.sequencerUrl || '',
        ownerAddress: initialConfig.owner || '',
        batchPosterAddress: '',
      };
      setFormData(newFormData);
      
      toast({
        title: "AI Configuration Applied",
        description: `Configuration for "${initialConfig.chainConfig?.chainName || initialConfig.name}" has been loaded.`,
      });
    }
  }, [initialConfig, toast]);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleValidatorChange = (index: number, value: string) => {
    const newValidators = [...formData.validators];
    newValidators[index] = value;
    setFormData(prev => ({ ...prev, validators: newValidators }));
  };

  const addValidator = () => {
    setFormData(prev => ({
      ...prev,
      validators: [...prev.validators, '']
    }));
  };

  const removeValidator = (index: number) => {
    setFormData(prev => ({
      ...prev,
      validators: prev.validators.filter((_, i) => i !== index)
    }));
  };

  const handleSave = async () => {
    try {
      setLoading(true);

      // Validation
      if (!formData.name || !formData.chainId || !formData.ownerAddress) {
        toast({
          title: 'Validation Error',
          description: 'Please fill in all required fields',
          variant: 'destructive'
        });
        return;
      }

      const response = await fetch('http://localhost:3000/api/orbit/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (data.success) {
        setConfigId(data.data.configId);
        toast({
          title: 'Success',
          description: 'Configuration saved successfully!',
        });
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save configuration',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeploy = async () => {
    try {
      if (!configId) {
        toast({
          title: 'Error',
          description: 'Please save the configuration first',
          variant: 'destructive'
        });
        return;
      }

      setLoading(true);

      const response = await fetch('http://localhost:3000/api/orbit/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configId })
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: 'Deployment Started',
          description: 'Your L3 chain deployment has begun!',
        });
        
        if (onDeploymentStart) {
          onDeploymentStart(data.data.deploymentId);
        }
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      toast({
        title: 'Deployment Error',
        description: error.message || 'Failed to start deployment',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Basic Information */}
      <section className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">Basic Information</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Configure your L3 chain&apos;s identity</p>
        </div>
        <Separator />
        <div className="grid gap-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs">Chain Name <span className="text-muted-foreground">*</span></Label>
              <Input
                id="name"
                placeholder="e.g., My Awesome L3"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="chainId" className="text-xs">Chain ID <span className="text-muted-foreground">*</span></Label>
              <Input
                id="chainId"
                type="number"
                placeholder="e.g., 123456"
                value={formData.chainId}
                onChange={(e) => handleChange('chainId', e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">Must be unique (1 – 4,294,967,295)</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description" className="text-xs">Description</Label>
            <Textarea
              id="description"
              placeholder="Describe your L3 chain purpose and features..."
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              rows={2}
              className="resize-none"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="parentChain" className="text-xs">Parent Chain <span className="text-muted-foreground">*</span></Label>
              <Select
                value={formData.parentChain}
                onValueChange={(value) => handleChange('parentChain', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="arbitrum-one">Arbitrum One</SelectItem>
                  <SelectItem value="arbitrum-sepolia">Arbitrum Sepolia (Testnet)</SelectItem>
                  <SelectItem value="arbitrum-goerli">Arbitrum Goerli (Testnet)</SelectItem>
                  <SelectItem value="ethereum">Ethereum Mainnet</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dataAvailability" className="text-xs">Data Availability</Label>
              <Select
                value={formData.dataAvailability}
                onValueChange={(value) => handleChange('dataAvailability', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="anytrust">AnyTrust (Lower Cost)</SelectItem>
                  <SelectItem value="rollup">Rollup (Higher Security)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </section>

      {/* Chain Governance */}
      <section className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">Chain Governance</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Set up validators and ownership</p>
        </div>
        <Separator />
        <div className="grid gap-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="ownerAddress" className="text-xs">Owner Address <span className="text-muted-foreground">*</span></Label>
              <Input
                id="ownerAddress"
                placeholder="0x..."
                value={formData.ownerAddress}
                onChange={(e) => handleChange('ownerAddress', e.target.value)}
                className="font-mono text-xs"
              />
              <p className="text-[11px] text-muted-foreground">Controls the chain</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sequencerAddress" className="text-xs">Sequencer Address <span className="text-muted-foreground">*</span></Label>
              <Input
                id="sequencerAddress"
                placeholder="0x..."
                value={formData.sequencerAddress}
                onChange={(e) => handleChange('sequencerAddress', e.target.value)}
                className="font-mono text-xs"
              />
              <p className="text-[11px] text-muted-foreground">Sequences transactions</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Validators</Label>
            <div className="space-y-2">
              {formData.validators.map((validator, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    placeholder="0x..."
                    value={validator}
                    onChange={(e) => handleValidatorChange(index, e.target.value)}
                    className="font-mono text-xs"
                  />
                  {formData.validators.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeValidator(index)}
                      className="shrink-0 size-9"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addValidator}
                className="w-full gap-1.5 text-xs"
              >
                <Plus className="size-3" />
                Add Validator
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="challengePeriod" className="text-xs">Challenge Period (seconds)</Label>
            <Input
              id="challengePeriod"
              type="number"
              value={formData.challengePeriod}
              onChange={(e) => handleChange('challengePeriod', e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">Default: 604800 (7 days)</p>
          </div>
        </div>
      </section>

      {/* Advanced Settings — collapsible */}
      <Collapsible>
        <div className="space-y-4">
          <CollapsibleTrigger className="flex items-center justify-between w-full group">
            <div>
              <h3 className="text-sm font-semibold tracking-tight text-left">Advanced Settings</h3>
              <p className="text-xs text-muted-foreground mt-0.5 text-left">Optional advanced configuration</p>
            </div>
            <ChevronDown className="size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
          <Separator />
          <CollapsibleContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="nativeToken" className="text-xs">Custom Native Token</Label>
                <Input
                  id="nativeToken"
                  placeholder="0x... (Leave empty for ETH)"
                  value={formData.nativeToken}
                  onChange={(e) => handleChange('nativeToken', e.target.value)}
                  className="font-mono text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="batchPosterAddress" className="text-xs">Batch Poster Address</Label>
                <Input
                  id="batchPosterAddress"
                  placeholder="0x..."
                  value={formData.batchPosterAddress}
                  onChange={(e) => handleChange('batchPosterAddress', e.target.value)}
                  className="font-mono text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="l2GasPrice" className="text-xs">L2 Gas Price (Gwei)</Label>
                <Input
                  id="l2GasPrice"
                  type="number"
                  step="0.01"
                  value={formData.l2GasPrice}
                  onChange={(e) => handleChange('l2GasPrice', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="l1GasPrice" className="text-xs">L1 Gas Price (Gwei)</Label>
                <Input
                  id="l1GasPrice"
                  type="number"
                  step="0.1"
                  value={formData.l1GasPrice}
                  onChange={(e) => handleChange('l1GasPrice', e.target.value)}
                />
              </div>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* Actions */}
      <Separator />
      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          onClick={handleSave}
          disabled={loading}
          variant="outline"
          className="flex-1 gap-1.5"
        >
          <Save className="size-3.5" />
          {configId ? 'Update Configuration' : 'Save Configuration'}
        </Button>

        <Button
          onClick={handleDeploy}
          disabled={loading || !configId}
          className="flex-1 gap-1.5"
        >
          <Rocket className="size-3.5" />
          Deploy L3 Chain
        </Button>
      </div>

      {/* Status Messages */}
      {configId && (
        <div className="flex items-center gap-2.5 rounded-md border border-border px-3 py-2.5 text-sm">
          <CheckCircle2 className="size-4 shrink-0" />
          <span>
            Configuration saved · <code className="font-mono text-xs text-muted-foreground">{configId}</code>
          </span>
        </div>
      )}

      {!formData.ownerAddress && (
        <div className="flex items-center gap-2.5 rounded-md border border-border px-3 py-2.5 text-sm text-muted-foreground">
          <AlertCircle className="size-4 shrink-0" />
          <span>Owner address is required for deployment</span>
        </div>
      )}
    </div>
  );
}
