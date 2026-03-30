/**
 * WasteFloatingButton v2 — Global FAB for waste logging
 *
 * Sprint 2 upgrades:
 * - Badge showing daily log count
 * - Tab system: Quick Log | Day Flow
 * - WastePersonalStats shown after successful registration
 */

import { useState, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Trash2, ExternalLink, Zap, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
} from '@/components/ui/sheet';
import { WasteQuickLogContent } from './WasteQuickLogContent';
import { WasteDayFlow } from './WasteDayFlow';
import { WastePersonalStats } from './WastePersonalStats';
import { cn } from '@/lib/utils';

// Pages where the FAB should NOT appear
const HIDDEN_PATHS = [
  '/insights/waste',
  '/login',
  '/signup',
  '/reset-password',
  '/onboarding',
  '/kiosk',
];

// ── Daily stats helper (shared with WasteQuickLogContent) ──
const DAILY_STATS_KEY = 'josephine_waste_daily';
const STREAK_KEY = 'josephine_waste_streak';
const TOTAL_LOGS_KEY = 'josephine_waste_total_logs';
const TOTAL_VALUE_KEY = 'josephine_waste_total_value';
const WEEK_LOGS_KEY = 'josephine_waste_week_logs';

function getTodayStr() {
  return new Date().toISOString().slice(0, 10);
}

function getWeekStr() {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff)).toISOString().slice(0, 10);
}

function getDailyStats() {
  try {
    const stored = localStorage.getItem(DAILY_STATS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.date === getTodayStr()) return parsed;
    }
  } catch { /* ignore */ }
  return { date: getTodayStr(), count: 0, totalCost: 0 };
}

function getStreak(): number {
  try {
    const stored = localStorage.getItem(STREAK_KEY);
    if (stored) {
      const { lastDate, streak } = JSON.parse(stored);
      const today = getTodayStr();
      if (lastDate === today) return streak;
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      if (lastDate === yesterday.toISOString().slice(0, 10)) return streak;
    }
  } catch { /* ignore */ }
  return 0;
}

function getTotalLogs(): number {
  try { return parseInt(localStorage.getItem(TOTAL_LOGS_KEY) || '0', 10); }
  catch { return 0; }
}

function getTotalValue(): number {
  try { return parseFloat(localStorage.getItem(TOTAL_VALUE_KEY) || '0'); }
  catch { return 0; }
}

function getWeekLogs(): number {
  try {
    const stored = localStorage.getItem(WEEK_LOGS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.week === getWeekStr()) return parsed.count;
    }
  } catch { /* ignore */ }
  return 0;
}

type TabMode = 'quick' | 'flow' | 'stats';

export function WasteFloatingButton() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<TabMode>('quick');
  const [refreshKey, setRefreshKey] = useState(0);

  // Refresh stats when opening
  const dailyStats = useMemo(() => getDailyStats(), [open, refreshKey]);
  const streak = useMemo(() => getStreak(), [open, refreshKey]);
  const totalLogs = useMemo(() => getTotalLogs(), [open, refreshKey]);
  const totalValue = useMemo(() => getTotalValue(), [open, refreshKey]);
  const weekLogs = useMemo(() => getWeekLogs(), [open, refreshKey]);

  // Hide on excluded paths
  const shouldHide = HIDDEN_PATHS.some(p => pathname.startsWith(p))
    || pathname.startsWith('/team');

  if (shouldHide) return null;

  const handleSuccess = () => {
    setRefreshKey(k => k + 1);
  };

  return (
    <>
      {/* FAB Button with badge */}
      <button
        onClick={() => { setOpen(true); setTab('quick'); }}
        className={cn(
          "fixed bottom-6 right-6 z-50",
          "w-14 h-14 rounded-2xl",
          "bg-gradient-to-br from-red-500 to-orange-500",
          "text-white shadow-lg shadow-red-500/25",
          "flex items-center justify-center",
          "transition-all duration-300 hover:scale-110 hover:shadow-xl hover:shadow-red-500/30",
          "active:scale-95",
          "group",
        )}
        title="Registrar merma rápida"
        aria-label="Registrar merma"
      >
        <Trash2 className="h-6 w-6 transition-transform group-hover:rotate-12" />
        {/* Daily count badge */}
        {dailyStats.count > 0 && (
          <span className="absolute -top-1.5 -right-1.5 h-5 min-w-5 px-1 rounded-full bg-white text-red-600 text-[10px] font-bold flex items-center justify-center shadow-md border border-red-100">
            {dailyStats.count}
          </span>
        )}
      </button>

      {/* Main Sheet */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="h-[88vh] rounded-t-2xl p-0 overflow-hidden flex flex-col">
          {/* Tab switcher */}
          <div className="flex items-center gap-1 px-4 pt-3 pb-1 flex-shrink-0 border-b border-border/50">
            <button
              onClick={() => setTab('quick')}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                tab === 'quick' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Zap className="h-3.5 w-3.5" />
              Quick Log
            </button>
            <button
              onClick={() => setTab('flow')}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                tab === 'flow' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <CalendarDays className="h-3.5 w-3.5" />
              Flujo del Día
            </button>
            <button
              onClick={() => setTab('stats')}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                tab === 'stats' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              🏆
              Mi Progreso
            </button>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto">
            {tab === 'quick' && (
              <WasteQuickLogContent
                onBack={() => setOpen(false)}
                onSuccess={handleSuccess}
              />
            )}
            {tab === 'flow' && (
              <div className="p-4">
                <WasteDayFlow
                  dailyCount={dailyStats.count}
                  dailyCost={dailyStats.totalCost}
                  streak={streak}
                  onSelectPhase={(phase) => {
                    if (phase === 'closing') {
                      setOpen(false);
                      navigate('/insights/waste');
                    } else {
                      setTab('quick');
                    }
                  }}
                />
              </div>
            )}
            {tab === 'stats' && (
              <div className="p-4 space-y-4">
                <WastePersonalStats
                  totalLogs={totalLogs}
                  weekLogs={weekLogs}
                  totalWasteValue={totalValue}
                  streak={streak}
                />
                <p className="text-xs text-center text-muted-foreground">
                  Los datos se acumulan mientras usas esta cuenta
                </p>
              </div>
            )}
          </div>

          {/* Footer link to full waste page */}
          <div className="flex-shrink-0 px-4 py-3 border-t border-border/50 bg-background">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground hover:text-foreground gap-2"
              onClick={() => {
                setOpen(false);
                navigate('/insights/waste');
              }}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Ver dashboard completo de merma
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
