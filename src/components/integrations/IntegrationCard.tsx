import { format, addMinutes, addHours, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  RefreshCw, Plug, PlugZap, Eye, Trash2, Loader2, 
  CheckCircle, XCircle, Clock, AlertTriangle 
} from 'lucide-react';

export interface PosConnectionData {
  id: string;
  location_id: string;
  location_name: string;
  provider: string;
  status: 'connected' | 'disconnected' | 'error' | 'syncing';
  last_sync_at: string | null;
  config_json: {
    schedule?: '15min' | '1hour' | 'daily';
    auth_type?: 'api_key' | 'oauth' | 'username_password' | 'csv_only';
    last_error?: string;
  };
}

export interface ProviderInfo {
  id: string;
  name: string;
  description: string;
  logo: string;
  authTypes: ('api_key' | 'oauth' | 'username_password' | 'csv_only')[];
}

interface IntegrationCardProps {
  provider: ProviderInfo;
  connections: PosConnectionData[];
  syncing: string | null;
  onConnect: (providerId: string) => void;
  onReconnect: (connectionId: string) => void;
  onSync: (connectionId: string, provider: string) => void;
  onViewMapping: (connectionId: string, provider: string) => void;
  onDisconnect: (connectionId: string) => void;
  onCsvImport?: () => void;
}

const getStatusIcon = (status: string, syncing: boolean) => {
  if (syncing) return <Loader2 className="h-4 w-4 animate-spin text-info" />;
  switch (status) {
    case 'connected':
      return <CheckCircle className="h-4 w-4 text-success" />;
    case 'error':
      return <XCircle className="h-4 w-4 text-destructive" />;
    case 'syncing':
      return <Loader2 className="h-4 w-4 animate-spin text-info" />;
    default:
      return <Clock className="h-4 w-4 text-muted-foreground" />;
  }
};

const getStatusBadge = (status: string, syncing: boolean) => {
  if (syncing) return <Badge className="bg-info/10 text-info border-info/30">Sincronizando</Badge>;
  switch (status) {
    case 'connected':
      return <Badge className="bg-success/10 text-success border-success/30">Connected</Badge>;
    case 'error':
      return <Badge variant="destructive">Error</Badge>;
    case 'syncing':
      return <Badge className="bg-info/10 text-info border-info/30">Syncing</Badge>;
    default:
      return <Badge variant="secondary">Disconnected</Badge>;
  }
};

const getNextSyncTime = (lastSync: string | null, schedule?: string): string | null => {
  if (!lastSync || !schedule) return null;
  
  const last = new Date(lastSync);
  let next: Date;
  
  switch (schedule) {
    case '15min':
      next = addMinutes(last, 15);
      break;
    case '1hour':
      next = addHours(last, 1);
      break;
    case 'daily':
      next = addDays(last, 1);
      break;
    default:
      return null;
  }
  
  return format(next, 'dd/MM HH:mm', { locale: es });
};

export function IntegrationCard({
  provider,
  connections,
  syncing,
  onConnect,
  onReconnect,
  onSync,
  onViewMapping,
  onDisconnect,
  onCsvImport,
}: IntegrationCardProps) {
  const hasConnections = connections.length > 0;
  const isConnected = connections.some(c => c.status === 'connected');
  const hasError = connections.some(c => c.status === 'error');

  return (
    <Card className={`transition-all hover:shadow-md ${
      isConnected ? 'border-success/50 bg-success/5' : 
      hasError ? 'border-destructive/50 bg-destructive/5' : ''
    }`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-3xl">{provider.logo}</div>
            <div>
              <h3 className="font-semibold">{provider.name}</h3>
              <p className="text-xs text-muted-foreground">{provider.description}</p>
            </div>
          </div>
          {isConnected && <CheckCircle className="h-5 w-5 text-success" />}
          {hasError && !isConnected && <AlertTriangle className="h-5 w-5 text-destructive" />}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {hasConnections ? (
          <div className="space-y-2">
            {connections.map(conn => {
              const isSyncing = syncing === conn.id;
              const nextSync = getNextSyncTime(conn.last_sync_at, conn.config_json?.schedule);
              
              return (
                <div key={conn.id} className="p-3 bg-muted/50 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(conn.status, isSyncing)}
                      <span className="text-sm font-medium">{conn.location_name}</span>
                    </div>
                    {getStatusBadge(conn.status, isSyncing)}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <div>
                      <span className="font-medium">Last sync:</span>{' '}
                      {conn.last_sync_at 
                        ? format(new Date(conn.last_sync_at), 'dd/MM HH:mm', { locale: es })
                        : 'Never'
                      }
                    </div>
                    <div>
                      <span className="font-medium">Next sync:</span>{' '}
                      {nextSync || 'Manual'}
                    </div>
                  </div>
                  
                  {conn.config_json?.last_error && conn.status === 'error' && (
                    <p className="text-xs text-destructive bg-destructive/10 p-2 rounded">
                      {conn.config_json.last_error}
                    </p>
                  )}
                  
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {conn.status === 'error' ? (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="h-7 text-xs"
                        onClick={() => onReconnect(conn.id)}
                      >
                        <PlugZap className="h-3 w-3 mr-1" />
                        Reconnect
                      </Button>
                    ) : (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="h-7 text-xs"
                        disabled={isSyncing}
                        onClick={() => onSync(conn.id, provider.id)}
                      >
                        {isSyncing ? (
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3 w-3 mr-1" />
                        )}
                        Sync now
                      </Button>
                    )}
                    
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="h-7 text-xs"
                      onClick={() => onViewMapping(conn.id, provider.id)}
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      View mapping
                    </Button>
                    
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="h-7 text-xs text-destructive hover:text-destructive"
                      onClick={() => onDisconnect(conn.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-4">
            {provider.id === 'csv' ? (
              <Button variant="outline" size="sm" onClick={onCsvImport}>
                <Plug className="h-4 w-4 mr-2" />
                Import CSV
              </Button>
            ) : (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => onConnect(provider.id)}
              >
                <Plug className="h-4 w-4 mr-2" />
                Connect
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
