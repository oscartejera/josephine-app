import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp, Activity, AlertTriangle, CheckCircle2, Ticket } from 'lucide-react';
import { subDays, format } from 'date-fns';

interface HealthStats {
  ticketsLast7Days: number;
  errorsLast7Days: number;
  lastError: string | null;
  lastErrorDate: string | null;
}

export function HealthPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [stats, setStats] = useState<HealthStats>({
    ticketsLast7Days: 0,
    errorsLast7Days: 0,
    lastError: null,
    lastErrorDate: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    const sevenDaysAgo = subDays(new Date(), 7).toISOString();

    // Count tickets from last 7 days
    const { count: ticketCount } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', sevenDaysAgo);

    // Get connections with errors
    const { data: errorConnections } = await supabase
      .from('pos_connections')
      .select('config_json, last_sync_at')
      .eq('status', 'error')
      .order('last_sync_at', { ascending: false })
      .limit(1);

    // Count error connections from last 7 days
    const { count: errorCount } = await supabase
      .from('pos_connections')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'error')
      .gte('last_sync_at', sevenDaysAgo);

    const errorConfig = errorConnections?.[0]?.config_json as { last_error?: string } | null;

    setStats({
      ticketsLast7Days: ticketCount || 0,
      errorsLast7Days: errorCount || 0,
      lastError: errorConfig?.last_error || null,
      lastErrorDate: errorConnections?.[0]?.last_sync_at || null,
    });
    setLoading(false);
  };

  const isHealthy = stats.errorsLast7Days === 0;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className={isHealthy ? 'border-success/30' : 'border-warning/30'}>
        <CollapsibleTrigger className="w-full">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className={`h-5 w-5 ${isHealthy ? 'text-success' : 'text-warning'}`} />
                <CardTitle className="text-base">Health Panel</CardTitle>
                {isHealthy ? (
                  <Badge className="bg-success/10 text-success border-success/30">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    All systems OK
                  </Badge>
                ) : (
                  <Badge className="bg-warning/10 text-warning border-warning/30">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    {stats.errorsLast7Days} issues
                  </Badge>
                )}
              </div>
              {isOpen ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="pt-0">
            {loading ? (
              <div className="text-center py-4 text-muted-foreground">Loading...</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Ticket className="h-4 w-4 text-primary" />
                    <span className="text-sm text-muted-foreground">Tickets (7 días)</span>
                  </div>
                  <p className="text-2xl font-bold">{stats.ticketsLast7Days.toLocaleString()}</p>
                </div>
                
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className={`h-4 w-4 ${stats.errorsLast7Days > 0 ? 'text-destructive' : 'text-success'}`} />
                    <span className="text-sm text-muted-foreground">Errores sync (7 días)</span>
                  </div>
                  <p className={`text-2xl font-bold ${stats.errorsLast7Days > 0 ? 'text-destructive' : 'text-success'}`}>
                    {stats.errorsLast7Days}
                  </p>
                </div>
                
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Último error</span>
                  </div>
                  {stats.lastError ? (
                    <div>
                      <p className="text-sm text-destructive truncate" title={stats.lastError}>
                        {stats.lastError}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {stats.lastErrorDate && format(new Date(stats.lastErrorDate), 'dd/MM HH:mm')}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-success">Sin errores recientes</p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
