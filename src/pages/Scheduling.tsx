import { useState, useCallback, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { startOfWeek, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { ArrowRightLeft, AlertTriangle } from 'lucide-react';
import { useSchedulingSupabase, ViewMode, Shift } from '@/hooks/useSchedulingSupabase';
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
  
  // Parse URL params
  const locationIdParam = searchParams.get('location');
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
  const [swapDialogData, setSwapDialogData] = useState<{
    shift: Shift;
    employeeName: string;
  } | null>(null);
  
  // Data hook
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
  } = useSchedulingSupabase(locationIdParam, weekStart);
  
  // Set default location in URL when locations load
  useEffect(() => {
    if (locations.length > 0 && !locationIdParam) {
      const params = new URLSearchParams(searchParams);
      params.set('location', locations[0].id);
      setSearchParams(params, { replace: true });
    }
  }, [locations, locationIdParam, searchParams, setSearchParams]);
  
  const currentLocationId = locationIdParam || (locations.length > 0 ? locations[0].id : '');
  
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
    await createSchedule();
    setIsCreating(false);
    setShowToast(true);
  }, [createSchedule]);
  
  const handleAccept = useCallback(() => {
    acceptSchedule();
    setShowToast(false);
    toast.success('Schedule accepted');
  }, [acceptSchedule]);
  
  const handleUndo = useCallback(() => {
    undoSchedule();
    setShowToast(false);
    toast.info('Schedule reverted');
  }, [undoSchedule]);
  
  const handlePublish = useCallback(async (emailBody: string) => {
    await publishSchedule(emailBody);
    toast.success('Schedule published and notifications sent to all employees');
  }, [publishSchedule]);
  
  const handleInitiateSwap = useCallback((shift: Shift, employeeName: string) => {
    setSwapDialogData({ shift, employeeName });
  }, []);
  
  const handleSubmitSwap = useCallback((targetShift: Shift, reason?: string) => {
    if (!swapDialogData) return;
    createSwapRequest(swapDialogData.shift, targetShift, reason);
    toast.success('Swap request sent for approval');
  }, [swapDialogData, createSwapRequest]);
  
  const handleApproveSwap = useCallback((requestId: string) => {
    approveSwapRequest(requestId);
    toast.success('Swap approved - shifts have been exchanged');
  }, [approveSwapRequest]);
  
  const handleRejectSwap = useCallback((requestId: string) => {
    rejectSwapRequest(requestId);
    toast.info('Swap request rejected');
  }, [rejectSwapRequest]);
  
  // Get available shifts to swap with (other employees' shifts)
  const availableSwapShifts = useMemo(() => {
    if (!data || !swapDialogData) return [];
    
    return data.shifts
      .filter(s => s.employeeId !== swapDialogData.shift.employeeId && !s.isOpen)
      .map(shift => ({
        shift,
        employee: data.employees.find(e => e.id === shift.employeeId)!,
      }))
      .filter(item => item.employee);
  }, [data, swapDialogData]);
  
  const currentLocation = locations.find(l => l.id === currentLocationId) || locations[0];
  
  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <SchedulingHeader
        weekStart={weekStart}
        onWeekChange={handleWeekChange}
        onCreateSchedule={handleCreateSchedule}
        onPublish={() => setShowPublishModal(true)}
        hasSchedule={hasSchedule}
        isCreating={isCreating}
        projectedSales={data?.projectedSales}
        projectedColPercent={data?.projectedColPercent}
        targetColPercent={data?.targetColPercent}
        totalShiftsCost={data?.totalShiftsCost}
        totalVarianceCost={data?.totalVarianceCost}
      />
      
      {/* Missing payroll warning */}
      {hasSchedule && data && data.missingPayrollCount > 0 && (
        <Alert variant="default" className="border-amber-200 bg-amber-50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            Faltan datos de nómina para {data.missingPayrollCount} empleados. 
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
          
          <Select value={currentLocationId} onValueChange={handleLocationChange}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select location" />
            </SelectTrigger>
            <SelectContent>
              {locations.map((loc) => (
                <SelectItem key={loc.id} value={loc.id}>
                  {loc.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Swap requests button */}
          {hasSchedule && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSwapPanel(true)}
              className="relative"
            >
              <ArrowRightLeft className="h-4 w-4 mr-2" />
              Swap Requests
              {pendingSwapRequests.length > 0 && (
                <Badge 
                  variant="destructive" 
                  className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs"
                >
                  {pendingSwapRequests.length}
                </Badge>
              )}
            </Button>
          )}
          
          {data && (
            <div className="text-sm text-muted-foreground">
              {data.employees.length} employees · {data.totalHours}h scheduled
            </div>
          )}
        </div>
      </div>
      
      {/* Grid */}
      {hasSchedule && data ? (
        <ScheduleGrid 
          data={data} 
          viewMode={viewMode} 
          positions={positions}
          onMoveShift={moveShift} 
          onAddShift={addShift}
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
        hoursAdded={data?.totalHours || 0}
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
        requests={swapRequests}
        onApprove={handleApproveSwap}
        onReject={handleRejectSwap}
      />
    </div>
  );
}
