import { useState, useCallback, useMemo, useEffect } from 'react';
import { useWeatherForecast } from '@/hooks/useWeatherForecast';
import { useSearchParams } from 'react-router-dom';
import { startOfWeek, parseISO, format, isThisWeek } from 'date-fns';
import { toast } from 'sonner';
import { ArrowRightLeft, AlertTriangle, CalendarDays } from 'lucide-react';
import { EventCalendarManager } from '@/components/settings/EventCalendarManager';
import { useSchedulingSupabase, ViewMode, Shift, resolveLocationId } from '@/hooks/useSchedulingSupabase';
import { useAuth } from '@/contexts/AuthContext';
import { useScheduleEfficiency } from '@/hooks/useScheduleEfficiency';
import { useApp } from '@/contexts/AppContext';
import {
  SchedulingHeader,
  CreateScheduleModal,
  ScheduleGrid,
  ViewModeDropdown,
  ScheduleToast,
  PublishModal,
  EmptyScheduleState,
  SwapShiftDialog,
  SwapRequestsPanel,
  PopularShifts,
  ScheduleSettingsSheet,
  DemandOverlay,
} from '@/components/scheduling';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useTranslation } from 'react-i18next';

// Generate placeholder KPIs for empty state
function generatePlaceholderKPIs(weekStart: Date) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return days.map((dayName, i) => ({
    date: '',
    dayName,
    sales: 0,
    cost: 0,
    colPercent: 0,
    hours: 0,
    forecastSales: 0,
    forecastLaborCost: 0,
    forecastLaborHours: 0,
    forecastColPercent: 0,
    shiftsCost: 0,
    shiftsHours: 0,
    shiftsCount: 0,
    varianceCost: 0,
    varianceCostPct: 0,
  }));
}

export default function Scheduling() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const { selectedLocationId, accessibleLocations } = useApp();

  // Parse URL params - location comes from global context now
  const locationIdParam = selectedLocationId !== 'all' ? selectedLocationId : searchParams.get('location');
  const startParam = searchParams.get('start');
  const weekStart = startParam
    ? startOfWeek(parseISO(startParam), { weekStartsOn: 1 })
    : startOfWeek(new Date(), { weekStartsOn: 1 });

  // State
  const [viewMode, setViewMode] = useState<ViewMode>('departments');
  const [isCreating, setIsCreating] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showSwapPanel, setShowSwapPanel] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showEventCalendar, setShowEventCalendar] = useState(false);

  const [swapDialogData, setSwapDialogData] = useState<{
    shift: Shift;
    employeeName: string;
  } | null>(null);

  // Track if we've already resolved location to avoid infinite loops
  const [locationResolved, setLocationResolved] = useState(false);

  // First, fetch locations to resolve the location param
  const {
    data,
    isLoading,
    hasSchedule,
    hasChanges,
    locations,
    positions,
    swapRequests,
    pendingSwapRequests,
    createSchedule,
    undoSchedule,
    acceptSchedule,
    publishSchedule,
    moveShift,
    addShift,
    createSwapRequest,
    approveSwapRequest,
    rejectSwapRequest,
  } = useSchedulingSupabase(null, weekStart); // Initial call to get locations

  // Resolve location ID - prefer global context, fallback to URL param or first location
  // Scheduling ALWAYS needs a specific location (can't show "all locations")
  const resolvedLocationId = useMemo(() => {
    if (locations.length === 0) return null;
    // If global context has a specific location, use it
    if (selectedLocationId && selectedLocationId !== 'all') {
      return selectedLocationId;
    }
    // If URL param exists, resolve it
    if (locationIdParam) {
      return resolveLocationId(locationIdParam, locations);
    }
    // Default to first location (scheduling requires a single location)
    return locations[0]?.id || null;
  }, [locations, locationIdParam, selectedLocationId]);

  // Get the actual scheduling data with the resolved location
  const schedulingData = useSchedulingSupabase(resolvedLocationId, weekStart);

  // Efficiency engine
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const { data: efficiency } = useScheduleEfficiency(
    resolvedLocationId,
    weekStart,
    weekEnd,
    !!resolvedLocationId && (resolvedLocationId ? schedulingData.hasSchedule : false)
  );

  // Use resolved data — ALWAYS prefer schedulingData (which has the real locationId)
  // The first hook (null) is ONLY for fetching the locations list.
  const actualData = schedulingData.data;
  const actualHasSchedule = schedulingData.hasSchedule;
  const actualIsLoading = isLoading || schedulingData.isLoading;
  const actualCreateSchedule = schedulingData.createSchedule;
  const actualUndoSchedule = schedulingData.undoSchedule;
  const actualAcceptSchedule = schedulingData.acceptSchedule;
  const actualApproveSchedule = schedulingData.approveSchedule;
  const actualPublishSchedule = schedulingData.publishSchedule;
  const actualMoveShift = schedulingData.moveShift;
  const actualAddShift = schedulingData.addShift;
  const actualAutoFillShifts = schedulingData.autoFillShifts;
  const actualSwapRequests = schedulingData.swapRequests;
  const actualPendingSwapRequests = schedulingData.pendingSwapRequests;
  const actualCreateSwapRequest = schedulingData.createSwapRequest;
  const actualApproveSwapRequest = schedulingData.approveSwapRequest;
  const actualRejectSwapRequest = schedulingData.rejectSwapRequest;

  // Resolve location ID and update URL when locations are loaded
  useEffect(() => {
    if (locations.length === 0 || locationResolved) return;

    const newResolvedId = resolveLocationId(locationIdParam, locations);

    if (newResolvedId && newResolvedId !== locationIdParam) {
      // URL has legacy/invalid location, redirect to UUID
      const params = new URLSearchParams(searchParams);
      params.set('location', newResolvedId);
      setSearchParams(params, { replace: true });
      setLocationResolved(true);
      console.log('[Scheduling] Resolved location:', locationIdParam, '->', newResolvedId);
    } else if (!locationIdParam && newResolvedId) {
      // No location in URL, set default
      const params = new URLSearchParams(searchParams);
      params.set('location', newResolvedId);
      setSearchParams(params, { replace: true });
      setLocationResolved(true);
    } else if (newResolvedId) {
      setLocationResolved(true);
    }
  }, [locations, locationIdParam, searchParams, setSearchParams, locationResolved]);

  // Reset resolution flag when location param changes externally
  useEffect(() => {
    setLocationResolved(false);
  }, [locationIdParam]);

  const currentLocationId = resolvedLocationId || '';

  // Weather forecast for ScheduleGrid (Madrid coords default)
  const { forecast: weatherForecast } = useWeatherForecast(
    currentLocationId || null,
    40.4168, // Madrid latitude
    -3.7038  // Madrid longitude
  );
  const weatherData = useMemo(() =>
    weatherForecast.map(w => ({
      date: w.date,
      temperature: w.temperature,
      condition: w.condition,
      iconCode: w.iconCode,
      salesMultiplier: w.salesMultiplier,
    })),
    [weatherForecast]
  );

  // Placeholder KPIs for empty state
  const placeholderKPIs = useMemo(() => generatePlaceholderKPIs(weekStart), [weekStart]);

  // Handlers — use functional updater to avoid stale-closure bugs
  const handleWeekChange = useCallback((newWeekStart: Date) => {
    setSearchParams(prev => {
      const params = new URLSearchParams(prev);
      params.set('start', format(newWeekStart, 'yyyy-MM-dd'));
      return params;
    }, { replace: true });
  }, [setSearchParams]);

  const handleGoToToday = useCallback(() => {
    const today = startOfWeek(new Date(), { weekStartsOn: 1 });
    setSearchParams(prev => {
      const params = new URLSearchParams(prev);
      params.set('start', format(today, 'yyyy-MM-dd'));
      return params;
    }, { replace: true });
  }, [setSearchParams]);

  const handleLocationChange = useCallback((newLocationId: string) => {
    setSearchParams(prev => {
      const params = new URLSearchParams(prev);
      params.set('location', newLocationId);
      return params;
    }, { replace: true });
  }, [setSearchParams]);

  const handleCreateSchedule = useCallback(async () => {
    setIsCreating(true);
    await actualCreateSchedule();
    setIsCreating(false);
    setShowToast(true);
  }, [actualCreateSchedule]);

  const handleAccept = useCallback(() => {
    actualAcceptSchedule();
    setShowToast(false);
    toast.success(t('scheduling.accepted'));
  }, [actualAcceptSchedule]);

  const handleUndo = useCallback(() => {
    actualUndoSchedule();
    setShowToast(false);
    toast.info(t('scheduling.reverted'));
  }, [actualUndoSchedule]);

  const handlePublish = useCallback(async (emailBody: string) => {
    await actualPublishSchedule(emailBody);
    toast.success(t('scheduling.published'));
  }, [actualPublishSchedule]);

  const handleApprove = useCallback(async () => {
    await actualApproveSchedule();
  }, [actualApproveSchedule]);

  const handleInitiateSwap = useCallback((shift: Shift, employeeName: string) => {
    setSwapDialogData({ shift, employeeName });
  }, []);

  const handleSubmitSwap = useCallback((targetShift: Shift, reason?: string) => {
    if (!swapDialogData) return;
    actualCreateSwapRequest(swapDialogData.shift, targetShift, reason);
    toast.success(t('scheduling.swapRequested'));
  }, [swapDialogData, actualCreateSwapRequest]);

  const handleApproveSwap = useCallback((requestId: string) => {
    actualApproveSwapRequest(requestId);
    toast.success(t('scheduling.swapApproved'));
  }, [actualApproveSwapRequest]);

  const handleRejectSwap = useCallback((requestId: string) => {
    actualRejectSwapRequest(requestId);
    toast.info(t('scheduling.swapRejected'));
  }, [actualRejectSwapRequest]);

  // Get available shifts to swap with (other employees' shifts)
  const availableSwapShifts = useMemo(() => {
    if (!actualData || !swapDialogData) return [];

    return actualData.shifts
      .filter(s => s.employeeId !== swapDialogData.shift.employeeId && !s.isOpen)
      .map(shift => ({
        shift,
        employee: actualData.employees.find(e => e.id === shift.employeeId)!,
      }))
      .filter(item => item.employee);
  }, [actualData, swapDialogData]);

  const currentLocation = locations.find(l => l.id === currentLocationId) || locations[0];

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <SchedulingHeader
        weekStart={weekStart}
        onWeekChange={handleWeekChange}
        onGoToToday={handleGoToToday}
        onCreateSchedule={handleCreateSchedule}
        onAutoFill={async () => {
          const count = await actualAutoFillShifts();
          if (count && count > 0) {
            toast.success(`Auto-fill: ${count} turno${count > 1 ? 's' : ''} añadido${count > 1 ? 's' : ''}`);
          } else {
            toast.info(t('scheduling.autoFillEmpty'));
          }
        }}
        onPublish={() => setShowPublishModal(true)}
        onOpenSettings={() => setShowSettings(true)}
        hasSchedule={actualHasSchedule}
        isCreating={isCreating}
        projectedSales={actualData?.projectedSales}
        projectedColPercent={actualData?.projectedColPercent}
        scheduledColPercent={actualData?.scheduledColPercent}
        targetColPercent={actualData?.targetColPercent}
        targetCost={actualData?.targetCost}
        totalShiftsCost={actualData?.totalShiftsCost}
        totalShiftsHours={actualData?.totalShiftsHours}
        totalVarianceCost={actualData?.totalVarianceCost}
        splh={actualData?.splh}
        oplh={actualData?.oplh}
        efficiency={efficiency}
      />

      {/* Missing payroll warning */}
      {actualHasSchedule && actualData && actualData.missingPayrollCount > 0 && (
        <Alert variant="default" className="border-amber-200 bg-amber-50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            Faltan datos de nómina para {actualData.missingPayrollCount} empleados.
            <a href="/settings" className="underline ml-1 font-medium">
              Completa Settings → Payroll
            </a>
          </AlertDescription>
        </Alert>
      )}

      {/* Controls row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <ViewModeDropdown value={viewMode} onChange={setViewMode} />
        </div>

        <div className="flex items-center gap-3">
          {/* Swap requests button */}
          {actualHasSchedule && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSwapPanel(true)}
              className="relative"
            >
              <ArrowRightLeft className="h-4 w-4 mr-2" />
              Swap Requests
              {actualPendingSwapRequests.length > 0 && (
                <Badge
                  variant="destructive"
                  className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs"
                >
                  {actualPendingSwapRequests.length}
                </Badge>
              )}
            </Button>
          )}

          {actualData && (
            <div className="flex items-center gap-2">
              {/* Schedule status badge */}
              {actualHasSchedule && (
                <Badge
                  variant={actualData.status === 'published' ? 'default' : 'secondary'}
                  className={actualData.status === 'published'
                    ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                    : actualData.status === 'approved'
                      ? 'bg-amber-100 text-amber-700 border-amber-200'
                      : 'bg-gray-100 text-gray-600 border-gray-200'
                  }
                >
                  {actualData.status === 'published' ? 'Publicado'
                    : actualData.status === 'approved' ? t('payroll.aprobado')
                      : 'Borrador'}
                </Badge>
              )}

              {/* Approve button (draft → approved) */}
              {actualHasSchedule && actualData.status === 'draft' && (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-amber-300 text-amber-700 hover:bg-amber-50"
                  onClick={() => setShowApproveModal(true)}
                >
                  ✓ Aprobar
                </Button>
              )}

              {/* Publish button (approved → published) */}
              {actualHasSchedule && actualData.status !== 'published' && (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-primary/30 text-primary hover:bg-primary/5"
                  onClick={() => setShowPublishModal(true)}
                >
                  ✉ Publicar
                </Button>
              )}

              <span className="text-sm text-muted-foreground">
                {actualData.employees.length} employees · {actualData.totalHours}h scheduled
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Popular Shifts + Grid */}
      {actualHasSchedule && actualData && (
        <PopularShifts />
      )}

      {actualHasSchedule && actualData && (
        <>
          {/* Demand forecast overlay above the grid */}
          <DemandOverlay
            locationId={resolvedLocationId ?? undefined}
            weekStart={weekStart}
          />
          <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
            <div className="min-w-[800px]">
              <ScheduleGrid
                data={actualData}
                viewMode={viewMode}
                positions={positions}
                weatherData={weatherData}
                onMoveShift={actualMoveShift}
                onAddShift={actualAddShift}
                onInitiateSwap={handleInitiateSwap}
              />
            </div>
          </div>
        </>
      )}
      {!actualHasSchedule && (
        <EmptyScheduleState weekStart={weekStart} dailyKPIs={placeholderKPIs} />
      )}

      {/* Create schedule modal */}
      <CreateScheduleModal
        isOpen={isCreating}
        onComplete={() => setIsCreating(false)}
      />

      {/* Accept/Undo toast */}
      <ScheduleToast
        isVisible={showToast}
        hoursAdded={actualData?.totalHours || 0}
        onAccept={handleAccept}
        onUndo={handleUndo}
      />

      {/* Approve modal */}
      <PublishModal
        isOpen={showApproveModal}
        onClose={() => setShowApproveModal(false)}
        onConfirm={async () => { await handleApprove(); }}
        locationName={currentLocation?.name || 'Location'}
        mode="approve"
      />

      {/* Publish modal */}
      <PublishModal
        isOpen={showPublishModal}
        onClose={() => setShowPublishModal(false)}
        onConfirm={handlePublish}
        locationName={currentLocation?.name || 'Location'}
        mode="publish"
      />

      {/* Swap shift dialog */}
      {swapDialogData && (
        <SwapShiftDialog
          isOpen={true}
          onClose={() => setSwapDialogData(null)}
          onSubmit={handleSubmitSwap}
          myShift={swapDialogData.shift}
          myName={swapDialogData.employeeName}
          availableShifts={availableSwapShifts}
        />
      )}

      {/* Swap requests panel */}
      <SwapRequestsPanel
        isOpen={showSwapPanel}
        onClose={() => setShowSwapPanel(false)}
        requests={actualSwapRequests}
        onApprove={handleApproveSwap}
        onReject={handleRejectSwap}
      />

      {/* Schedule Settings Sheet */}
      <ScheduleSettingsSheet
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        locationId={currentLocationId}
        locationName={currentLocation?.name || 'Location'}
      />

      {/* Event Calendar toggle button */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowEventCalendar(!showEventCalendar)}
          className="gap-2"
        >
          <CalendarDays className="h-4 w-4" />
          {showEventCalendar ? 'Ocultar' : 'Calendario de Eventos'}
        </Button>
      </div>

      {/* Event Calendar (collapsible) */}
      {showEventCalendar && (
        <EventCalendarManager locationId={currentLocationId} />
      )}
    </div>
  );
}
