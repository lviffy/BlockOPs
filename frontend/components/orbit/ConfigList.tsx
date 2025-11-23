'use client';

import { useState, useEffect } from 'react';
import { Layers, Trash2, Rocket, Eye } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface ConfigListProps {
  onSelectConfig?: (configId: string) => void;
  onDeploymentStart?: (deploymentId: string) => void;
}

export function ConfigList({ onSelectConfig, onDeploymentStart }: ConfigListProps) {
  const { toast } = useToast();
  const [configs, setConfigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    try {
      const response = await fetch('http://localhost:3002/api/orbit/configs');
      const data = await response.json();
      
      if (data.success) {
        setConfigs(data.data.configs);
      }
    } catch (error) {
      console.error('Error fetching configs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (configId: string) => {
    try {
      const response = await fetch(`http://localhost:3002/api/orbit/config/${configId}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: 'Deleted',
          description: 'Configuration deleted successfully'
        });
        fetchConfigs(); // Refresh list
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete configuration',
        variant: 'destructive'
      });
    }
  };

  const handleDeploy = async (configId: string) => {
    try {
      const response = await fetch('http://localhost:3002/api/orbit/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configId })
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: 'Deployment Started',
          description: 'Your L3 chain deployment has begun!'
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
    }
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      draft: 'bg-muted text-muted-foreground',
      deploying: 'bg-muted text-foreground',
      deployed: 'bg-foreground text-background',
      failed: 'bg-destructive text-destructive-foreground'
    };

    return (
      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${colors[status as keyof typeof colors] || colors.draft}`}>
        {status.toUpperCase()}
      </span>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-muted-foreground text-sm">Loading configurations...</p>
        </CardContent>
      </Card>
    );
  }

  if (configs.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <Layers className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">No configurations yet</p>
            <p className="text-muted-foreground text-xs mt-1">Create your first L3 configuration to get started</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Your L3 Configurations</h3>
      
      <div className="grid gap-3">
        {configs.map((config) => (
          <Card key={config.id} className="transition-all duration-200 hover:shadow-lg hover:shadow-foreground/5 hover:-translate-y-0.5">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-base flex items-center gap-2">
                    {config.name}
                    {getStatusBadge(config.status)}
                  </CardTitle>
                  <CardDescription className="mt-1 text-xs">
                    Chain ID: {config.chainId} | Parent: {config.parentChain}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {config.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">{config.description}</p>
                )}
                
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Validators:</span>
                    <span className="ml-2 font-medium">{config.validators?.length || 0}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">DA:</span>
                    <span className="ml-2 font-medium">{config.dataAvailability}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Created:</span>
                    <span className="ml-2 font-medium">
                      {new Date(config.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Updated:</span>
                    <span className="ml-2 font-medium">
                      {new Date(config.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onSelectConfig && onSelectConfig(config.id)}
                    className="flex-1 h-8 text-xs"
                  >
                    <Eye className="w-3 h-3 mr-1.5" />
                    View Details
                  </Button>
                  
                  {config.status === 'draft' && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => handleDeploy(config.id)}
                        className="flex-1 bg-foreground text-background hover:bg-foreground/90 h-8 text-xs"
                      >
                        <Rocket className="w-3 h-3 mr-1.5" />
                        Deploy
                      </Button>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(config.id)}
                        className="h-8 px-2"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
