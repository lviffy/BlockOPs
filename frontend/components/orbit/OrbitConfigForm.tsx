'use client';

import { useState, useEffect } from 'react';
import { Save, Rocket, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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

      const response = await fetch('http://localhost:3002/api/orbit/config', {
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

      const response = await fetch('http://localhost:3002/api/orbit/deploy', {
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
    <div className="space-y-6">
      {/* Basic Information */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
          <CardDescription>Configure your L3 chain's identity</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="name">Chain Name *</Label>
            <Input
              id="name"
              placeholder="e.g., My Awesome L3"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="chainId">Chain ID *</Label>
            <Input
              id="chainId"
              type="number"
              placeholder="e.g., 123456"
              value={formData.chainId}
              onChange={(e) => handleChange('chainId', e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">Must be unique (1 - 4,294,967,295)</p>
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Describe your L3 chain purpose and features..."
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="parentChain">Parent Chain *</Label>
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

          <div>
            <Label htmlFor="dataAvailability">Data Availability</Label>
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
        </CardContent>
      </Card>

      {/* Chain Governance */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle>Chain Governance</CardTitle>
          <CardDescription>Set up validators and ownership</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="ownerAddress">Owner Address *</Label>
            <Input
              id="ownerAddress"
              placeholder="0x..."
              value={formData.ownerAddress}
              onChange={(e) => handleChange('ownerAddress', e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">Address that controls the chain</p>
          </div>

          <div>
            <Label htmlFor="sequencerAddress">Sequencer Address *</Label>
            <Input
              id="sequencerAddress"
              placeholder="0x..."
              value={formData.sequencerAddress}
              onChange={(e) => handleChange('sequencerAddress', e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">Address that sequences transactions</p>
          </div>

          <div>
            <Label>Validators</Label>
            <div className="space-y-2 mt-2">
              {formData.validators.map((validator, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    placeholder="0x..."
                    value={validator}
                    onChange={(e) => handleValidatorChange(index, e.target.value)}
                  />
                  {formData.validators.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeValidator(index)}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addValidator}
                className="w-full"
              >
                + Add Validator
              </Button>
            </div>
          </div>

          <div>
            <Label htmlFor="challengePeriod">Challenge Period (seconds)</Label>
            <Input
              id="challengePeriod"
              type="number"
              value={formData.challengePeriod}
              onChange={(e) => handleChange('challengePeriod', e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">Default: 604800 (7 days)</p>
          </div>
        </CardContent>
      </Card>

      {/* Advanced Settings */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle>Advanced Settings</CardTitle>
          <CardDescription>Optional advanced configuration</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="nativeToken">Custom Native Token (Optional)</Label>
            <Input
              id="nativeToken"
              placeholder="0x... (Leave empty for ETH)"
              value={formData.nativeToken}
              onChange={(e) => handleChange('nativeToken', e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="batchPosterAddress">Batch Poster Address (Optional)</Label>
            <Input
              id="batchPosterAddress"
              placeholder="0x..."
              value={formData.batchPosterAddress}
              onChange={(e) => handleChange('batchPosterAddress', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="l2GasPrice">L2 Gas Price (Gwei)</Label>
              <Input
                id="l2GasPrice"
                type="number"
                step="0.01"
                value={formData.l2GasPrice}
                onChange={(e) => handleChange('l2GasPrice', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="l1GasPrice">L1 Gas Price (Gwei)</Label>
              <Input
                id="l1GasPrice"
                type="number"
                step="0.1"
                value={formData.l1GasPrice}
                onChange={(e) => handleChange('l1GasPrice', e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button
          onClick={handleSave}
          disabled={loading}
          variant="outline"
          className="flex-1 font-semibold"
        >
          <Save className="w-4 h-4 mr-2" />
          {configId ? 'Update Configuration' : 'Save Configuration'}
        </Button>
        
        <Button
          onClick={handleDeploy}
          disabled={loading || !configId}
          className="flex-1 bg-foreground text-background hover:bg-foreground/90 font-semibold"
        >
          <Rocket className="w-4 h-4 mr-2" />
          Deploy L3 Chain
        </Button>
      </div>

      {/* Status Messages */}
      {configId && (
        <div className="flex items-center gap-2 p-3 bg-muted rounded-lg border border-border">
          <CheckCircle2 className="w-4 h-4 text-foreground shrink-0" />
          <span className="text-sm text-foreground">
            Configuration saved! ID: <code className="font-mono text-xs">{configId}</code>
          </span>
        </div>
      )}

      {!formData.ownerAddress && (
        <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border border-border">
          <AlertCircle className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="text-sm text-muted-foreground">
            Owner address is required for deployment
          </span>
        </div>
      )}
    </div>
  );
}
