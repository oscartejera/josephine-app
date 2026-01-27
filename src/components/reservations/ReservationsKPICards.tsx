import { CalendarCheck, Users, Clock, XCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { DayStats } from '@/hooks/useReservationsModule';

interface ReservationsKPICardsProps {
  stats: DayStats;
}

export function ReservationsKPICards({ stats }: ReservationsKPICardsProps) {
  const kpis = [
    {
      label: 'Reservas',
      value: stats.totalReservations,
      sublabel: `${stats.confirmedReservations} confirmadas`,
      icon: CalendarCheck,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      label: 'Comensales',
      value: stats.totalCovers,
      sublabel: `${stats.seatedReservations} sentados`,
      icon: Users,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      label: 'Pendientes',
      value: stats.pendingReservations,
      sublabel: 'Por confirmar',
      icon: Clock,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
    },
    {
      label: 'No-shows',
      value: stats.noShows,
      sublabel: `${stats.cancellations} cancelaciones`,
      icon: XCircle,
      color: 'text-red-500',
      bgColor: 'bg-red-500/10',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {kpis.map((kpi) => (
        <Card key={kpi.label}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{kpi.label}</p>
                <p className="text-2xl font-bold mt-1">{kpi.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{kpi.sublabel}</p>
              </div>
              <div className={`p-2 rounded-lg ${kpi.bgColor}`}>
                <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
