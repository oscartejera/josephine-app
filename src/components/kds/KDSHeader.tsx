import { useState, useEffect } from 'react';
import { ArrowLeft, Wifi, WifiOff, BarChart3, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { KDSAlertSettingsDialog } from './KDSAlertSettingsDialog';
import type { KDSAlertSettings } from '@/hooks/useKDSAlerts';

interface KDSHeaderProps {
  locationName: string;
  isConnected: boolean;
  pendingCount: number;
  preparingCount: number;
  onShowStats?: () => void;
  alertSettings?: KDSAlertSettings;
  onUpdateAlertSettings?: (settings: Partial<KDSAlertSettings>) => void;
  alertCount?: number;
}

export function KDSHeader({ 
  locationName, 
  isConnected, 
  pendingCount, 
  preparingCount, 
  onShowStats,
  alertSettings,
  onUpdateAlertSettings,
  alertCount = 0,
}: KDSHeaderProps) {
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="h-16 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center gap-4">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => {
            // Try to go back, but if there's no history, go to KDS dashboard or POS
            if (window.history.length > 1) {
              navigate(-1);
            } else {
              navigate('/insights/kds');
            }
          }}
          className="text-zinc-400 hover:text-white hover:bg-zinc-800"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-white">KDS - {locationName}</h1>
          <div className="flex items-center gap-3 text-sm">
            {isConnected ? (
              <span className="flex items-center gap-1 text-emerald-400">
                <Wifi className="h-3 w-3" />
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                Live
              </span>
            ) : (
              <span className="flex items-center gap-1 text-zinc-500">
                <WifiOff className="h-3 w-3" />
                Desconectado
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-amber-400">{pendingCount}</p>
            <p className="text-xs text-zinc-500">Pendientes</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-400">{preparingCount}</p>
            <p className="text-xs text-zinc-500">En preparación</p>
          </div>
          {alertCount > 0 && (
            <div className="text-center">
              <div className="flex items-center justify-center gap-1">
                <AlertTriangle className="h-5 w-5 text-red-400 animate-pulse" />
                <p className="text-2xl font-bold text-red-400">{alertCount}</p>
              </div>
              <p className="text-xs text-zinc-500">Alertas</p>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {alertSettings && onUpdateAlertSettings && (
            <KDSAlertSettingsDialog
              settings={alertSettings}
              onUpdateSettings={onUpdateAlertSettings}
            />
          )}
          
          {onShowStats && (
            <Button
              variant="outline"
              size="sm"
              onClick={onShowStats}
              className="bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-white"
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              Stats
            </Button>
          )}
        </div>
        
        <div className="text-right">
          <p className="text-3xl font-mono font-bold text-white">
            {currentTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
          </p>
          <p className="text-xs text-zinc-500">
            {currentTime.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })}
          </p>
        </div>
      </div>
    </header>
  );
}
