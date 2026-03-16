import { useState, useEffect } from 'react';
import { WifiOff, Wifi } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

/**
 * OfflineBanner — shows a subtle warning when the browser loses network connectivity.
 * Auto-reconnects by invalidating all React-Query caches when connectivity resumes.
 * Auto-dismisses 3 seconds after reconnection with a success message.
 */
export function OfflineBanner() {
  const { t } = useTranslation();
    const [isOffline, setIsOffline] = useState(!navigator.onLine);
    const [showReconnected, setShowReconnected] = useState(false);
    const queryClient = useQueryClient();

    useEffect(() => {
        const handleOffline = () => {
            setIsOffline(true);
            setShowReconnected(false);
        };

        const handleOnline = () => {
            setIsOffline(false);
            setShowReconnected(true);

            // Auto-reconnect: invalidate all queries so stale data gets refetched
            queryClient.invalidateQueries();

            // Auto-dismiss reconnected message after 3s
            setTimeout(() => setShowReconnected(false), 3000);
        };

        window.addEventListener('offline', handleOffline);
        window.addEventListener('online', handleOnline);

        return () => {
            window.removeEventListener('offline', handleOffline);
            window.removeEventListener('online', handleOnline);
        };
    }, [queryClient]);

    if (!isOffline && !showReconnected) return null;

    if (showReconnected) {
        return (
            <div className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-2 bg-green-600 text-white text-sm py-2 px-4 animate-in slide-in-from-top duration-300">
                <Wifi className="h-4 w-4" />
                <span>Conexión restaurada — datos actualizándose</span>
            </div>
        );
    }

    return (
        <div className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-2 bg-amber-500 text-white text-sm py-2 px-4 animate-in slide-in-from-top duration-300">
            <WifiOff className="h-4 w-4" />
            <span>Sin conexión — los datos pueden no estar actualizados</span>
        </div>
    );
}
