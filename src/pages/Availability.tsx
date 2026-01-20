import { useState, useCallback } from 'react';
import { Calendar, Plus, Users, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useAvailabilityData, TimeOffRequest } from '@/hooks/useAvailabilityData';
import {
  WeeklyAvailabilityGrid,
  TimeOffRequestDialog,
  TimeOffRequestsList,
} from '@/components/availability';

export default function Availability() {
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'availability' | 'requests' | 'team'>('availability');
  
  const {
    availability,
    timeOffRequests,
    pendingRequests,
    myRequests,
    currentEmployee,
    hasChanges,
    updateDayAvailability,
    saveAvailability,
    createTimeOffRequest,
    approveTimeOffRequest,
    rejectTimeOffRequest,
    cancelTimeOffRequest,
  } = useAvailabilityData();
  
  const handleSaveAvailability = useCallback(async () => {
    setIsSaving(true);
    try {
      await saveAvailability();
      toast.success('Availability saved successfully');
    } catch (error) {
      toast.error('Failed to save availability');
    } finally {
      setIsSaving(false);
    }
  }, [saveAvailability]);
  
  const handleCreateRequest = useCallback(async (
    request: Omit<TimeOffRequest, 'id' | 'employeeId' | 'employeeName' | 'employeeInitials' | 'status' | 'createdAt'>
  ) => {
    await createTimeOffRequest(request);
    toast.success('Time off request submitted');
  }, [createTimeOffRequest]);
  
  const handleApproveRequest = useCallback(async (requestId: string) => {
    await approveTimeOffRequest(requestId);
    toast.success('Request approved');
  }, [approveTimeOffRequest]);
  
  const handleRejectRequest = useCallback(async (requestId: string) => {
    await rejectTimeOffRequest(requestId);
    toast.info('Request rejected');
  }, [rejectTimeOffRequest]);
  
  const handleCancelRequest = useCallback(async (requestId: string) => {
    await cancelTimeOffRequest(requestId);
    toast.success('Request cancelled');
  }, [cancelTimeOffRequest]);
  
  return (
    <div className="p-6 space-y-6 max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <span>Schedule & Workforce</span>
            <span>/</span>
            <span className="text-foreground">Availability</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Staff Availability</h1>
        </div>
        
        <Button onClick={() => setShowRequestDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Request Time Off
        </Button>
      </div>
      
      {/* Current employee info */}
      <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg border">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-lg font-medium text-primary">
          {currentEmployee.initials}
        </div>
        <div>
          <div className="font-medium">{currentEmployee.name}</div>
          <div className="text-sm text-muted-foreground">
            {currentEmployee.position} · {currentEmployee.department}
          </div>
        </div>
      </div>
      
      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList className="grid w-full grid-cols-3 max-w-[400px]">
          <TabsTrigger value="availability" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            My Hours
          </TabsTrigger>
          <TabsTrigger value="requests" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            My Requests
            {myRequests.filter(r => r.status === 'pending').length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center">
                {myRequests.filter(r => r.status === 'pending').length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="team" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Team
            {pendingRequests.length > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 flex items-center justify-center">
                {pendingRequests.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="availability" className="mt-6">
          <WeeklyAvailabilityGrid
            availability={availability}
            onUpdateDay={updateDayAvailability}
            hasChanges={hasChanges}
            onSave={handleSaveAvailability}
            isSaving={isSaving}
          />
        </TabsContent>
        
        <TabsContent value="requests" className="mt-6">
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold text-lg">My Time Off Requests</h3>
              <Button variant="outline" size="sm" onClick={() => setShowRequestDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                New Request
              </Button>
            </div>
            <TimeOffRequestsList
              requests={myRequests}
              isManager={false}
              onCancel={handleCancelRequest}
            />
          </div>
        </TabsContent>
        
        <TabsContent value="team" className="mt-6">
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="mb-6">
              <h3 className="font-semibold text-lg">Team Time Off Requests</h3>
              <p className="text-sm text-muted-foreground">
                Review and manage time off requests from your team
              </p>
            </div>
            <TimeOffRequestsList
              requests={timeOffRequests}
              isManager={true}
              onApprove={handleApproveRequest}
              onReject={handleRejectRequest}
            />
          </div>
        </TabsContent>
      </Tabs>
      
      {/* Time Off Request Dialog */}
      <TimeOffRequestDialog
        isOpen={showRequestDialog}
        onClose={() => setShowRequestDialog(false)}
        onSubmit={handleCreateRequest}
      />
    </div>
  );
}