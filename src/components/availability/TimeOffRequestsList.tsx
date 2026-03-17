import { format, parseISO, differenceInDays, formatDistanceToNow } from 'date-fns';
import { 
  Calendar, Check, X, Clock, Plane, HeartPulse, User, 
  MoreHorizontal, Trash2, AlertCircle 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { TimeOffRequest } from '@/hooks/useAvailabilityData';

interface TimeOffRequestsListProps {
  requests: TimeOffRequest[];
  isManager?: boolean;
  onApprove?: (requestId: string) => void;
  onReject?: (requestId: string) => void;
  onCancel?: (requestId: string) => void;
}

const TYPE_CONFIG: Record<TimeOffRequest['type'], { label: string; icon: React.ElementType; color: string }> = {
  vacation: { label: 'Vacation', icon: Plane, color: 'text-blue-600 bg-blue-50' },
  sick: { label: 'Sick', icon: HeartPulse, color: 'text-red-600 bg-red-50' },
  personal: { label: 'Personal', icon: User, color: 'text-purple-600 bg-purple-50' },
  other: { label: 'Other', icon: MoreHorizontal, color: 'text-gray-600 bg-gray-50' },
};

const STATUS_CONFIG: Record<TimeOffRequest['status'], { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  approved: { label: 'Approved', color: 'bg-green-50 text-green-700 border-green-200' },
  rejected: { label: 'Rejected', color: 'bg-red-50 text-red-700 border-red-200' },
};

function TimeOffRequestCard({
  request,
  isManager,
  onApprove,
  onReject,
  onCancel,
}: {
  request: TimeOffRequest;
  isManager?: boolean;
  onApprove?: () => void;
  onReject?: () => void;
  onCancel?: () => void;
}) {
  const typeConfig = TYPE_CONFIG[request.type];
  const statusConfig = STATUS_CONFIG[request.status];
  const TypeIcon = typeConfig.icon;
  
  const startDate = parseISO(request.startDate);
  const endDate = parseISO(request.endDate);
  const duration = differenceInDays(endDate, startDate) + 1;
  
  const isPast = endDate < new Date();
  const isPending = request.status === 'pending';
  
  return (
    <div className={cn(
      "p-4 rounded-lg border transition-colors",
      isPending ? "bg-card" : "bg-muted/30",
      isPast && "opacity-60"
    )}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
            {request.employeeInitials}
          </div>
          <div>
            <div className="font-medium">{request.employeeName}</div>
            <div className="text-xs text-muted-foreground">
              {formatDistanceToNow(parseISO(request.createdAt), { addSuffix: true })}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Type badge */}
          <div className={cn("px-2 py-1 rounded-md text-xs flex items-center gap-1", typeConfig.color)}>
            <TypeIcon className="h-3 w-3" />
            {typeConfig.label}
          </div>
          {/* Status badge */}
          <Badge variant="outline" className={statusConfig.color}>
            {statusConfig.label}
          </Badge>
        </div>
      </div>
      
      {/* Dates */}
      <div className="flex items-center gap-4 mb-3 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span>
            {format(startDate, 'MMM d')}
            {duration > 1 && ` - ${format(endDate, 'MMM d')}`}
            {`, ${format(startDate, 'yyyy')}`}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{duration} day{duration !== 1 ? 's' : ''}</span>
        </div>
      </div>
      
      {/* Reason */}
      <div className="text-sm text-muted-foreground mb-3 p-2 bg-muted/50 rounded">
        "{request.reason}"
      </div>
      
      {/* Review notes if rejected */}
      {request.status === 'rejected' && request.notes && (
        <div className="text-sm text-red-600 mb-3 p-2 bg-red-50 rounded flex items-start gap-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>{request.notes}</span>
        </div>
      )}
      
      {/* Actions */}
      {isPending && (
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          {isManager ? (
            <>
              <Button
                size="sm"
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={onReject}
              >
                <X className="h-4 w-4 mr-1" />
                Reject
              </Button>
              <Button size="sm" onClick={onApprove}>
                <Check className="h-4 w-4 mr-1" />
                Approve
              </Button>
            </>
          ) : (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="outline" className="text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4 mr-1" />
                  Cancel Request
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancel Time Off Request?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to cancel this time off request? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep Request</AlertDialogCancel>
                  <AlertDialogAction onClick={onCancel} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Cancel Request
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      )}
    </div>
  );
}

export function TimeOffRequestsList({
  requests,
  isManager = false,
  onApprove,
  onReject,
  onCancel,
}: TimeOffRequestsListProps) {
  const pendingRequests = requests.filter(r => r.status === 'pending');
  const processedRequests = requests.filter(r => r.status !== 'pending');
  
  if (requests.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Calendar className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p className="text-sm">No time off requests</p>
        <p className="text-xs mt-1">
          {isManager 
            ? "Employee requests will appear here"
            : "Click 'Request Time Off' to submit a new request"
          }
        </p>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Pending */}
      {pendingRequests.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
            <Badge variant="secondary">{pendingRequests.length}</Badge>
            Pending {isManager ? 'Approval' : 'Requests'}
          </h4>
          <div className="space-y-3">
            {pendingRequests.map(request => (
              <TimeOffRequestCard
                key={request.id}
                request={request}
                isManager={isManager}
                onApprove={() => onApprove?.(request.id)}
                onReject={() => onReject?.(request.id)}
                onCancel={() => onCancel?.(request.id)}
              />
            ))}
          </div>
        </div>
      )}
      
      {/* Processed */}
      {processedRequests.length > 0 && (
        <div>
          {pendingRequests.length > 0 && <Separator className="my-4" />}
          <h4 className="text-sm font-medium mb-3 text-muted-foreground">
            {isManager ? 'Previously Reviewed' : 'Past Requests'}
          </h4>
          <div className="space-y-3">
            {processedRequests.slice(0, 5).map(request => (
              <TimeOffRequestCard
                key={request.id}
                request={request}
                isManager={isManager}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}