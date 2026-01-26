import { TrendingUp, TrendingDown, Wallet, Receipt, ShoppingCart, CalendarClock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { FiscalMetrics } from '@/hooks/useFiscalData';
import { getQuarterDeadline } from '@/hooks/useFiscalData';
import { format, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';

interface FiscalKPICardsProps {
  metrics: FiscalMetrics;
  selectedYear: number;
  selectedQuarter: number;
  isLoading?: boolean;
}

export function FiscalKPICards({ 
  metrics, 
  selectedYear, 
  selectedQuarter,
  isLoading 
}: FiscalKPICardsProps) {
  const deadline = getQuarterDeadline(selectedYear, selectedQuarter);
  const daysUntilDeadline = differenceInDays(deadline, new Date());
  const isPastDeadline = daysUntilDeadline < 0;
  const isUrgent = daysUntilDeadline >= 0 && daysUntilDeadline <= 7;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const cards = [
    {
      title: 'IVA Repercutido',
      subtitle: 'Ventas',
      value: metrics.ivaRepercutido,
      icon: TrendingUp,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
    },
    {
      title: 'IVA Soportado',
      subtitle: 'Compras',
      value: metrics.ivaSoportado,
      icon: TrendingDown,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
    },
    {
      title: 'IVA a Pagar',
      subtitle: metrics.ivaAPagar >= 0 ? 'A ingresar' : 'A compensar',
      value: metrics.ivaAPagar,
      icon: Wallet,
      color: metrics.ivaAPagar >= 0 ? 'text-red-600' : 'text-blue-600',
      bgColor: metrics.ivaAPagar >= 0 ? 'bg-red-50' : 'bg-blue-50',
    },
    {
      title: 'Próximo Vencimiento',
      subtitle: format(deadline, "d 'de' MMMM", { locale: es }),
      value: null,
      displayValue: isPastDeadline 
        ? 'Vencido' 
        : `${daysUntilDeadline} días`,
      icon: CalendarClock,
      color: isPastDeadline ? 'text-red-600' : isUrgent ? 'text-amber-600' : 'text-primary',
      bgColor: isPastDeadline ? 'bg-red-50' : isUrgent ? 'bg-amber-50' : 'bg-primary/10',
    },
  ];

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-4 w-24 rounded bg-muted" />
              <div className="mt-4 h-8 w-32 rounded bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">
                  {card.title}
                </p>
                <p className="text-xs text-muted-foreground/70">
                  {card.subtitle}
                </p>
              </div>
              <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', card.bgColor)}>
                <card.icon className={cn('h-5 w-5', card.color)} />
              </div>
            </div>
            <div className="mt-4">
              <p className={cn('text-2xl font-bold', card.color)}>
                {card.value !== null ? formatCurrency(card.value) : card.displayValue}
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
