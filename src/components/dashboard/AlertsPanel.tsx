import { AlertTriangle, AlertCircle, Info, TrendingDown, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface Alert {
  id: string;
  type: 'warning' | 'error' | 'info';
  title: string;
  description: string;
  metric?: string;
  trend?: 'up' | 'down';
}

interface AlertsPanelProps {
  alerts: Alert[];
  className?: string;
}

export function AlertsPanel({ alerts, className }: AlertsPanelProps) {
  const getAlertIcon = (type: Alert['type']) => {
    switch (type) {
      case 'error':
        return AlertCircle;
      case 'warning':
        return AlertTriangle;
      default:
        return Info;
    }
  };

  const getAlertStyles = (type: Alert['type']) => {
    switch (type) {
      case 'error':
        return 'border-l-destructive bg-destructive/5';
      case 'warning':
        return 'border-l-warning bg-warning/5';
      default:
        return 'border-l-info bg-info/5';
    }
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-warning" />
          Alertas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {alerts.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No hay alertas activas
          </p>
        ) : (
          alerts.map((alert) => {
            const Icon = getAlertIcon(alert.type);
            return (
              <div
                key={alert.id}
                className={cn(
                  "p-3 rounded-lg border-l-4 transition-colors",
                  getAlertStyles(alert.type)
                )}
              >
                <div className="flex items-start gap-3">
                  <Icon className={cn(
                    "h-4 w-4 mt-0.5 shrink-0",
                    alert.type === 'error' && "text-destructive",
                    alert.type === 'warning' && "text-warning",
                    alert.type === 'info' && "text-info"
                  )} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{alert.title}</p>
                      {alert.metric && (
                        <Badge variant="secondary" className="shrink-0">
                          {alert.trend === 'up' && <TrendingUp className="h-3 w-3 mr-1" />}
                          {alert.trend === 'down' && <TrendingDown className="h-3 w-3 mr-1" />}
                          {alert.metric}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {alert.description}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
