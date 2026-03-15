import { useTranslation } from 'react-i18next';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Clock, LogOut } from 'lucide-react';

interface SessionTimeoutDialogProps {
  open: boolean;
  minutesRemaining: number;
  onStayLoggedIn: () => void;
  onLogout: () => void;
}

export function SessionTimeoutDialog({
  open,
  minutesRemaining,
  onStayLoggedIn,
  onLogout,
}: SessionTimeoutDialogProps) {
  const { t } = useTranslation();

  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="mx-auto w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-2">
            <Clock className="w-6 h-6 text-amber-600 dark:text-amber-400" />
          </div>
          <AlertDialogTitle className="text-center">
            {t('auth.sessionExpiredTitle')}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            {t('auth.sessionExpiresIn', { minutes: minutesRemaining })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="sm:justify-center gap-2">
          <AlertDialogCancel onClick={onLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            {t('auth.logout')}
          </AlertDialogCancel>
          <AlertDialogAction onClick={onStayLoggedIn}>
            {t('auth.stayConnected')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
