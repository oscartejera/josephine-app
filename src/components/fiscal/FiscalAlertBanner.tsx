import { AlertTriangle, CalendarClock, X } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { getQuarterDeadline } from '@/hooks/useFiscalData';
import { format, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';

interface FiscalAlertBannerProps {
  year: number;
  quarter: number;
}

export function FiscalAlertBanner({ year, quarter }: FiscalAlertBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  
  const deadline = getQuarterDeadline(year, quarter);
  const daysUntilDeadline = differenceInDays(deadline, new Date());
  const isPastDeadline = daysUntilDeadline < 0;
  const isUrgent = daysUntilDeadline >= 0 && daysUntilDeadline <= 7;
  const isWarning = daysUntilDeadline > 7 && daysUntilDeadline <= 15;

  // Don't show if more than 15 days away or dismissed
  if (dismissed || (!isPastDeadline && !isUrgent && !isWarning)) {
    return null;
  }

  const variant = isPastDeadline ? 'destructive' : isUrgent ? 'destructive' : 'default';

  return (
    <Alert variant={variant} className="relative">
      <CalendarClock className="h-4 w-4" />
      <AlertTitle className="flex items-center gap-2">
        {isPastDeadline ? (
          <>
            <AlertTriangle className="h-4 w-4" />
            Plazo vencido
          </>
        ) : isUrgent ? (
          <>
            <AlertTriangle className="h-4 w-4" />
            Plazo urgente
          </>
        ) : (
          'Recordatorio fiscal'
        )}
      </AlertTitle>
      <AlertDescription>
        {isPastDeadline ? (
          <>
            El plazo para presentar el Modelo 303 del T{quarter} {year} venció el{' '}
            {format(deadline, "d 'de' MMMM", { locale: es })}.
          </>
        ) : (
          <>
            Quedan <strong>{daysUntilDeadline} días</strong> para presentar el Modelo 303 del T{quarter} {year}.
            Fecha límite: {format(deadline, "d 'de' MMMM 'de' yyyy", { locale: es })}.
          </>
        )}
      </AlertDescription>
      <Button
        variant="ghost"
        size="sm"
        className="absolute right-2 top-2 h-6 w-6 p-0"
        onClick={() => setDismissed(true)}
      >
        <X className="h-4 w-4" />
      </Button>
    </Alert>
  );
}
