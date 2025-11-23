'use client';

import { useState, useEffect } from 'react';
import { CheckCircle2, Clock, XCircle, Loader2, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

interface DeploymentStatusProps {
  deploymentId: string;
}

export function DeploymentStatus({ deploymentId }: DeploymentStatusProps) {
  const [deployment, setDeployment] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDeploymentStatus();
    
    // Poll for updates every 3 seconds if deployment is pending
    const interval = setInterval(() => {
      if (deployment?.status === 'pending') {
        fetchDeploymentStatus();
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [deploymentId, deployment?.status]);

  const fetchDeploymentStatus = async () => {
    try {
      const response = await fetch(`http://localhost:3002/api/orbit/deploy/status/${deploymentId}`);
      const data = await response.json();
      
      if (data.success) {
        setDeployment(data.data);
      }
    } catch (error) {
      console.error('Error fetching deployment status:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-foreground animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (!deployment) {
    return null;
  }

  const getStatusIcon = () => {
    switch (deployment.status) {
      case 'completed':
        return <CheckCircle2 className="w-5 h-5 text-foreground" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-destructive" />;
      default:
        return <Loader2 className="w-5 h-5 text-foreground animate-spin" />;
    }
  };

  const getStatusColor = () => {
    switch (deployment.status) {
      case 'completed':
        return 'text-foreground';
      case 'failed':
        return 'text-destructive';
      default:
        return 'text-muted-foreground';
    }
  };

  const progress = deployment.logs ? (deployment.logs.length / 7) * 100 : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getStatusIcon()}
            <div>
              <CardTitle className="text-base">
                Deployment {deployment.status === 'completed' ? 'Completed' : 'In Progress'}
              </CardTitle>
              <CardDescription className="text-xs">ID: {deploymentId}</CardDescription>
            </div>
          </div>
          <span className={`font-semibold text-xs ${getStatusColor()}`}>
            {deployment.status.toUpperCase()}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress Bar */}
        {deployment.status === 'pending' && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-1.5" />
          </div>
        )}

        {/* Deployment Logs */}
        <div>
          <h4 className="text-xs font-semibold mb-2">Deployment Logs</h4>
          <div className="bg-muted rounded-lg p-3 max-h-48 overflow-y-auto">
            {deployment.logs && deployment.logs.length > 0 ? (
              <div className="space-y-1 font-mono text-xs">
                {deployment.logs.map((log: string, index: number) => (
                  <div key={index} className="flex items-start gap-2">
                    <Clock className="w-3 h-3 text-muted-foreground mt-0.5 shrink-0" />
                    <span className="text-muted-foreground">{log}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-xs">No logs available</p>
            )}
          </div>
        </div>

        {/* Deployment Results */}
        {deployment.status === 'completed' && (
          <div className="space-y-3 pt-4 border-t">
            <h4 className="text-xs font-semibold">Deployment Details</h4>
            
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Transaction Hash:</span>
                <code className="text-[10px] bg-muted px-2 py-1 rounded font-mono">
                  {deployment.transactionHash?.slice(0, 10)}...{deployment.transactionHash?.slice(-8)}
                </code>
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Chain Address:</span>
                <code className="text-[10px] bg-muted px-2 py-1 rounded font-mono">
                  {deployment.chainAddress?.slice(0, 10)}...{deployment.chainAddress?.slice(-8)}
                </code>
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">RPC URL:</span>
                <code className="text-[10px] bg-muted px-2 py-1 rounded font-mono truncate max-w-[200px]">
                  {deployment.rpcUrl}
                </code>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              {deployment.explorerUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs h-8"
                  onClick={() => window.open(deployment.explorerUrl, '_blank')}
                >
                  <ExternalLink className="w-3 h-3 mr-1.5" />
                  View on Explorer
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-xs h-8"
                onClick={() => {
                  navigator.clipboard.writeText(deployment.rpcUrl);
                }}
              >
                Copy RPC URL
              </Button>
            </div>
          </div>
        )}

        {/* Error Message */}
        {deployment.status === 'failed' && deployment.error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
            <p className="text-destructive text-xs">{deployment.error}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
