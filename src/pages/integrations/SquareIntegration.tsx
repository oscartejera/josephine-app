/**
 * Square Integration Page  
 * Configuration and status - Demo mode (no Edge Functions needed)
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Plug2 } from 'lucide-react';
import { toast } from 'sonner';

export default function SquareIntegration() {
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleConnect = () => {
    setLoading(true);
    
    // Simulate connection (no Edge Functions needed for demo)
    setTimeout(() => {
      setIsConnected(true);
      setLoading(false);
      toast.success('Square POS connected successfully (Demo mode)', {
        description: 'In production, this would sync your Square catalog, orders, and payments.',
      });
    }, 1500);
  };

  const handleSync = () => {
    toast.info('Syncing from Square...', {
      description: 'This would pull latest data from Square API.',
    });
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <span className="text-3xl">🔷</span>
            Square POS
          </h1>
          <p className="text-muted-foreground">
            Automatic sync with Square
          </p>
        </div>

        {isConnected ? (
          <Badge variant="default" className="gap-2">
            <CheckCircle className="h-4 w-4" />
            Connected
          </Badge>
        ) : (
          <Button onClick={handleConnect} size="lg" disabled={loading}>
            <Plug2 className="h-4 w-4 mr-2" />
            {loading ? 'Connecting...' : 'Connect with Square'}
          </Button>
        )}
      </div>

      {!isConnected ? (
        <Card>
          <CardHeader>
            <CardTitle>Connect your Square account</CardTitle>
            <CardDescription>
              Sync products, orders, and payments automatically from Square POS
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Josephine will sync:
            </p>
            <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
              <li>All locations</li>
              <li>Product catalog (items and categories)</li>
              <li>Orders and transactions</li>
              <li>Payment methods and amounts</li>
            </ul>
            <p className="text-sm text-muted-foreground">
              Data is normalized to Josephine's Canonical Data Model (CDM) for unified analytics.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Connection Status</CardTitle>
              <CardDescription>
                Environment: <strong>Demo</strong> • Status: <strong>Active</strong>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <Button onClick={handleSync}>
                  Sync Now
                </Button>
                <Button variant="outline">
                  View Sync History
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>What's Next?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                ✅ Your Square data will sync automatically every 5 minutes
              </p>
              <p>
                ✅ View sales, products, and orders in Insights
              </p>
              <p>
                ✅ AI will generate forecasts and recommendations based on your data
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
