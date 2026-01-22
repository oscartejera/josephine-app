import { useState, useEffect } from 'react';
import { ArrowLeft, Wifi, WifiOff, BarChart3, AlertTriangle, ChefHat, Monitor, ChevronDown, History, Maximize, Minimize, Keyboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { KDSAlertSettingsDialog } from './KDSAlertSettingsDialog';
import type { KDSAlertSettings } from '@/hooks/useKDSAlerts';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface KDSHeaderProps {
  locationName: string;
  isConnected: boolean;
  pendingCount: number;
  preparingCount: number;
  onShowStats?: () => void;
  alertSettings?: KDSAlertSettings;
  onUpdateAlertSettings?: (settings: Partial<KDSAlertSettings>) => void;
  alertCount?: number;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  keyboardEnabled?: boolean;
  onToggleKeyboard?: () => void;
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
  isFullscreen = false,
  onToggleFullscreen,
  keyboardEnabled = false,
  onToggleKeyboard,
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm"
              className="text-zinc-400 hover:text-white hover:bg-zinc-800 gap-1 px-2"
            >
              <ArrowLeft className="h-5 w-5" />
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent 
            align="start" 
            className="w-48 bg-zinc-800 border-zinc-700 z-50"
          >
            <DropdownMenuItem 
              onClick={() => navigate(-1)}
              className="text-zinc-200 focus:bg-zinc-700 focus:text-white cursor-pointer"
            >
              <History className="h-4 w-4 mr-2" />
              Página anterior
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => navigate('/insights/kds')}
              className="text-zinc-200 focus:bg-zinc-700 focus:text-white cursor-pointer"
            >
              <ChefHat className="h-4 w-4 mr-2" />
              Dashboard KDS
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => navigate('/pos')}
              className="text-zinc-200 focus:bg-zinc-700 focus:text-white cursor-pointer"
            >
              <Monitor className="h-4 w-4 mr-2" />
              POS
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
          {/* Keyboard toggle */}
          {onToggleKeyboard && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={onToggleKeyboard}
                    className={cn(
                      "h-9 w-9 border-zinc-700",
                      keyboardEnabled 
                        ? "bg-emerald-600 text-white hover:bg-emerald-500 border-emerald-500" 
                        : "bg-zinc-800 text-white hover:bg-zinc-700"
                    )}
                  >
                    <Keyboard className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="bg-zinc-800 text-white border-zinc-700">
                  <p>{keyboardEnabled ? 'Desactivar atajos' : 'Activar atajos de teclado'}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* Fullscreen toggle */}
          {onToggleFullscreen && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={onToggleFullscreen}
                    className={cn(
                      "h-9 w-9 border-zinc-700",
                      isFullscreen 
                        ? "bg-emerald-600 text-white hover:bg-emerald-500 border-emerald-500" 
                        : "bg-zinc-800 text-white hover:bg-zinc-700"
                    )}
                  >
                    {isFullscreen ? (
                      <Minimize className="h-4 w-4" />
                    ) : (
                      <Maximize className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="bg-zinc-800 text-white border-zinc-700">
                  <p>{isFullscreen ? 'Salir de pantalla completa' : 'Modo Kiosk (pantalla completa)'}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          
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
              className="bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700"
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
