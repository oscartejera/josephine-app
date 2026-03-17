import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, Package, ArrowRight, Wifi } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface LowStockItem {
  id: string;
  name: string;
  currentStock: number;
  parLevel: number;
  unit: string;
  category: string;
  percentOfPar: number;
}

export function LowStockWidget() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [items, setItems] = useState<LowStockItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);

  const fetchLowStockItems = async () => {
    try {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('id, name, current_stock, par_level, unit, category')
        .not('par_level', 'is', null)
        .gt('par_level', 0);

      if (error) throw error;

      // Filter items below par level
      const lowStockItems: LowStockItem[] = (data || [])
        .filter(item => (item.current_stock || 0) < (item.par_level || 0))
        .map(item => ({
          id: item.id,
          name: item.name,
          currentStock: item.current_stock || 0,
          parLevel: item.par_level || 0,
          unit: item.unit || 'units',
          category: item.category || 'Other',
          percentOfPar: item.par_level ? ((item.current_stock || 0) / item.par_level) * 100 : 0
        }))
        .sort((a, b) => a.percentOfPar - b.percentOfPar)
        .slice(0, 5);

      setItems(lowStockItems);
    } catch (error) {
      console.error('Error fetching low stock items:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!session) return;

    fetchLowStockItems();

    // Subscribe to realtime inventory updates
    const channel = supabase
      .channel('low-stock-widget-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'inventory_items'
        },
        (payload) => {
          console.log('Low stock widget realtime update:', payload);
          fetchLowStockItems();
          setIsLive(true);
          
          // Flash the live indicator
          setTimeout(() => setIsLive(false), 2000);
          
          if (payload.eventType === 'UPDATE') {
            const newRecord = payload.new as any;
            if (newRecord.current_stock < newRecord.par_level) {
              toast.warning(`Low stock: ${newRecord.name}`, {
                description: `Current: ${newRecord.current_stock} ${newRecord.unit || 'units'} (Par: ${newRecord.par_level})`,
                duration: 5000,
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session]);

  const getSeverityColor = (percentOfPar: number) => {
    if (percentOfPar <= 25) return 'bg-destructive/10 text-destructive border-destructive/30';
    if (percentOfPar <= 50) return 'bg-warning/10 text-warning border-warning/30';
    return 'bg-muted text-muted-foreground';
  };

  const getSeverityBadge = (percentOfPar: number) => {
    if (percentOfPar <= 25) return <Badge variant="destructive">Critical</Badge>;
    if (percentOfPar <= 50) return <Badge className="bg-warning/10 text-warning hover:bg-warning/20">Low</Badge>;
    return <Badge variant="secondary">Monitor</Badge>;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Low Stock Alerts
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-6 w-16" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Low Stock Alerts
            {isLive && (
              <Badge variant="outline" className="gap-1 text-success border-success/30 animate-pulse">
                <Wifi className="h-3 w-3" />
                Live
              </Badge>
            )}
          </CardTitle>
          <Badge variant="secondary">{items.length} items</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="py-8 text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">All items are well stocked</p>
            <p className="text-sm text-muted-foreground mt-1">No items below par level</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map(item => (
              <div
                key={item.id}
                className={`flex items-center gap-3 p-3 rounded-lg border ${getSeverityColor(item.percentOfPar)}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{item.name}</p>
                    {getSeverityBadge(item.percentOfPar)}
                  </div>
                  <p className="text-sm opacity-80 mt-0.5">
                    {item.currentStock.toFixed(1)} / {item.parLevel.toFixed(1)} {item.unit}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">{item.percentOfPar.toFixed(0)}%</p>
                  <p className="text-xs opacity-70">of par</p>
                </div>
              </div>
            ))}
            
            <Button 
              variant="ghost" 
              className="w-full mt-2 gap-2"
              onClick={() => navigate('/procurement')}
            >
              Order Now
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}