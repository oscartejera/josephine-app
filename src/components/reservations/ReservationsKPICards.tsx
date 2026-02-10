import { CalendarDays, Users, BarChart3, XCircle, Clock, CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { ReservationStats } from '@/hooks/useReservationsModule';

interface ReservationsKPICardsProps {
  stats: ReservationStats;
  loading?: boolean;
}

export function ReservationsKPICards({ stats, loading }: ReservationsKPICardsProps) {
  const kpis = [
    {
      label: 'Reservas',
      value: stats.totalReservations,
      icon: CalendarDays,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      label: 'Comensales',
      value: stats.totalCovers,
      icon: Users,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-500/10',
    },
    {
      label: 'Ocupación',
      value: `${stats.occupancyRate}%`,
      icon: BarChart3,
      color: 'text-violet-500',
      bgColor: 'bg-violet-500/10',
    },
    {
      label: 'Confirmadas',
      value: stats.confirmedCount,
      icon: CheckCircle2,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      label: 'Pendientes',
      value: stats.pendingCount,
      icon: Clock,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
    },
    {
      label: 'No-shows',
      value: stats.noShowCount,
      icon: XCircle,
      color: 'text-red-500',
      bgColor: 'bg-red-500/10',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {kpis.map((kpi) => (
        <Card key={kpi.label} className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${kpi.bgColor}`}>
                <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
              </div>
              <div>
                {loading ? (
                  <div className="h-6 w-10 bg-muted animate-pulse rounded" />
                ) : (
                  <p className="text-xl font-bold">{kpi.value}</p>
                )}
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
