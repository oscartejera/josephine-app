import { useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { startOfWeek, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { useSchedulingData, ViewMode } from '@/hooks/useSchedulingData';
import {
  SchedulingHeader,
  CreateScheduleModal,
  ScheduleGrid,
  ViewModeDropdown,
  ScheduleToast,
  PublishModal,
  EmptyScheduleState,
} from '@/components/scheduling';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Generate placeholder KPIs for empty state
function generatePlaceholderKPIs(weekStart: Date) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return days.map((dayName, i) => ({
    date: '',
    dayName,
    sales: 2000 + Math.random() * 2000,
    cost: 500 + Math.random() * 300,
    colPercent: 20 + Math.random() * 8,
    hours: 50 + Math.random() * 30,
  }));
}

export default function Scheduling() {
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Parse URL params
  const locationId = searchParams.get('location') || 'westside';
  const startParam = searchParams.get('start');
  const weekStart = startParam 
    ? startOfWeek(parseISO(startParam), { weekStartsOn: 1 })
    : startOfWeek(new Date(), { weekStartsOn: 1 });
  
  // State
  const [viewMode, setViewMode] = useState<ViewMode>('departments');
  const [isCreating, setIsCreating] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  
  // Data hook
  const {
    data,
    isLoading,
    hasSchedule,
    hasChanges,
    locations,
    createSchedule,
    undoSchedule,
    acceptSchedule,
    publishSchedule,
    moveShift,
  } = useSchedulingData(locationId, weekStart);
  
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
  
  const currentLocation = locations.find(l => l.id === locationId) || locations[0];
  
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
      />
      
      {/* Controls row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ViewModeDropdown value={viewMode} onChange={setViewMode} />
          
          <Select value={locationId} onValueChange={handleLocationChange}>
            <SelectTrigger className="w-[180px]">
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
        
        {data && (
          <div className="text-sm text-muted-foreground">
            {data.employees.length} employees · {data.totalHours}h scheduled
          </div>
        )}
      </div>
      
      {/* Grid */}
      {hasSchedule && data ? (
        <ScheduleGrid data={data} viewMode={viewMode} onMoveShift={moveShift} />
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
        locationName={currentLocation.name}
      />
    </div>
  );
}
