import { useState, useCallback, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { startOfWeek, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { ArrowRightLeft, AlertTriangle } from 'lucide-react';
import { useSchedulingSupabase, ViewMode, Shift, resolveLocationId } from '@/hooks/useSchedulingSupabase';
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
  const [showSwapPanel, setShowSwapPanel] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
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
  const resolvedLocationId = useMemo(() => {
    if (locations.length === 0) return null;
    // If global context has a specific location, use it
    if (selectedLocationId && selectedLocationId !== 'all') {
      return selectedLocationId;
    }
    // Otherwise resolve from URL param or default to first
    return resolveLocationId(locationIdParam, locations);
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

  // Use resolved data
  const actualData = resolvedLocationId ? schedulingData.data : data;
  const actualHasSchedule = resolvedLocationId ? schedulingData.hasSchedule : hasSchedule;
  const actualIsLoading = isLoading || (resolvedLocationId ? schedulingData.isLoading : false);
  const actualCreateSchedule = resolvedLocationId ? schedulingData.createSchedule : createSchedule;
  const actualUndoSchedule = resolvedLocationId ? schedulingData.undoSchedule : undoSchedule;
  const actualAcceptSchedule = resolvedLocationId ? schedulingData.acceptSchedule : acceptSchedule;
  const actualPublishSchedule = resolvedLocationId ? schedulingData.publishSchedule : publishSchedule;
  const actualMoveShift = resolvedLocationId ? schedulingData.moveShift : moveShift;
  const actualAddShift = resolvedLocationId ? schedulingData.addShift : addShift;
  const actualSwapRequests = resolvedLocationId ? schedulingData.swapRequests : swapRequests;
  const actualPendingSwapRequests = resolvedLocationId ? schedulingData.pendingSwapRequests : pendingSwapRequests;
  const actualCreateSwapRequest = resolvedLocationId ? schedulingData.createSwapRequest : createSwapRequest;
  const actualApproveSwapRequest = resolvedLocationId ? schedulingData.approveSwapRequest : approveSwapRequest;
  const actualRejectSwapRequest = resolvedLocationId ? schedulingData.rejectSwapRequest : rejectSwapRequest;

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

  // Placeholder KPIs for empty state
  const placeholderKPIs = useMemo(() => generatePlaceholderKPIs(weekStart), [weekStart]);

  // Handlers
  const handleWeekChange = useCallback((newWeekStart: Date) => {
    const params = new URLSearchParams(searchParams);
    params.set('start', newWeekStart.toISOString().split('T')[0]);
    setSearchParams(params);
  }, [searchParams, setSearchParams]);

  const handleLocationChange = useCallback((newLocationId: string) => {
    const params = new URLSearchParams(searchParams);
    params.set('location', newLocationId);
    setSearchParams(params);
  }, [searchParams, setSearchParams]);

  const handleCreateSchedule = useCallback(async () => {
    setIsCreating(true);
    await actualCreateSchedule();
    setIsCreating(false);
    setShowToast(true);
  }, [actualCreateSchedule]);

  const handleAccept = useCallback(() => {
    actualAcceptSchedule();
    setShowToast(false);
    toast.success('Schedule accepted');
  }, [actualAcceptSchedule]);

  const handleUndo = useCallback(() => {
    actualUndoSchedule();
    setShowToast(false);
    toast.info('Schedule reverted');
  }, [actualUndoSchedule]);

  const handlePublish = useCallback(async (emailBody: string) => {
    await actualPublishSchedule(emailBody);
    toast.success('Schedule published and notifications sent to all employees');
  }, [actualPublishSchedule]);

  const handleInitiateSwap = useCallback((shift: Shift, employeeName: string) => {
    setSwapDialogData({ shift, employeeName });
  }, []);

  const handleSubmitSwap = useCallback((targetShift: Shift, reason?: string) => {
    if (!swapDialogData) return;
    actualCreateSwapRequest(swapDialogData.shift, targetShift, reason);
    toast.success('Swap request sent for approval');
  }, [swapDialogData, actualCreateSwapRequest]);

  const handleApproveSwap = useCallback((requestId: string) => {
    actualApproveSwapRequest(requestId);
    toast.success('Swap approved - shifts have been exchanged');
  }, [actualApproveSwapRequest]);

  const handleRejectSwap = useCallback((requestId: string) => {
    actualRejectSwapRequest(requestId);
    toast.info('Swap request rejected');
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
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <SchedulingHeader
        weekStart={weekStart}
        onWeekChange={handleWeekChange}
        onCreateSchedule={handleCreateSchedule}
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
      <div className="flex items-center justify-between">
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
            <div className="text-sm text-muted-foreground">
              {actualData.employees.length} employees · {actualData.totalHours}h scheduled
            </div>
          )}
        </div>
      </div>

      {/* Popular Shifts + Grid */}
      {actualHasSchedule && actualData && (
        <PopularShifts />
      )}

      {actualHasSchedule && actualData ? (
        <ScheduleGrid
          data={actualData}
          viewMode={viewMode}
          positions={positions}
          onMoveShift={actualMoveShift}
          onAddShift={actualAddShift}
          onInitiateSwap={handleInitiateSwap}
        />
      ) : (
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

      {/* Publish modal */}
      <PublishModal
        isOpen={showPublishModal}
        onClose={() => setShowPublishModal(false)}
        onConfirm={handlePublish}
        locationName={currentLocation?.name || 'Location'}
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
    </div>
  );
}
