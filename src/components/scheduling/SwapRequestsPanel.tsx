import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { ArrowRightLeft, Check, X, Clock, Calendar, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { SwapRequest } from '@/hooks/useSchedulingSupabase';

interface SwapRequestsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  requests: SwapRequest[];
  onApprove: (requestId: string) => void;
  onReject: (requestId: string) => void;
}

function SwapRequestCard({
  request,
  onApprove,
  onReject,
}: {
  request: SwapRequest;
  onApprove: () => void;
  onReject: () => void;
}) {
  const isPending = request.status === 'pending';
  
  return (
    <div className={cn(
      "p-4 rounded-lg border transition-colors",
      isPending ? "bg-card border-border" : "bg-muted/30 border-muted"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ArrowRightLeft className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Swap Request</span>
        </div>
        <div className="flex items-center gap-2">
          {request.status === 'pending' && (
            <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
              Pending
            </Badge>
          )}
          {request.status === 'approved' && (
            <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50">
              Approved
            </Badge>
          )}
          {request.status === 'rejected' && (
            <Badge variant="outline" className="text-red-600 border-red-300 bg-red-50">
              Rejected
            </Badge>
          )}
        </div>
      </div>
      
      {/* Swap visualization */}
      <div className="flex items-center gap-3 mb-3">
        {/* Requester */}
        <div className="flex-1 p-2 bg-muted/50 rounded-md">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
              {request.requesterInitials}
            </div>
            <span className="text-sm font-medium truncate">{request.requesterName}</span>
          </div>
          <div className="text-xs text-muted-foreground space-y-0.5">
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {format(parseISO(request.requesterShiftDate), 'EEE, MMM d')}
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {request.requesterShiftTime}
            </div>
          </div>
        </div>
        
        <ArrowRightLeft className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        
        {/* Target */}
        <div className="flex-1 p-2 bg-muted/50 rounded-md">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
              {request.targetInitials}
            </div>
            <span className="text-sm font-medium truncate">{request.targetName}</span>
          </div>
          <div className="text-xs text-muted-foreground space-y-0.5">
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {format(parseISO(request.targetShiftDate), 'EEE, MMM d')}
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {request.targetShiftTime}
            </div>
          </div>
        </div>
      </div>
      
      {/* Reason if provided */}
      {request.reason && (
        <div className="mb-3 p-2 bg-muted/30 rounded text-xs text-muted-foreground">
          <MessageSquare className="h-3 w-3 inline mr-1" />
          "{request.reason}"
        </div>
      )}
      
      {/* Footer */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {formatDistanceToNow(parseISO(request.createdAt), { addSuffix: true })}
        </span>
        
        {isPending && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={onReject}
            >
              <X className="h-4 w-4 mr-1" />
              Reject
            </Button>
            <Button
              size="sm"
              className="h-8"
              onClick={onApprove}
            >
              <Check className="h-4 w-4 mr-1" />
              Approve
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export function SwapRequestsPanel({
  isOpen,
  onClose,
  requests,
  onApprove,
  onReject,
}: SwapRequestsPanelProps) {
  const pendingRequests = requests.filter(r => r.status === 'pending');
  const processedRequests = requests.filter(r => r.status !== 'pending');
  
  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-[400px] sm:w-[450px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-primary" />
            Shift Swap Requests
          </SheetTitle>
          <SheetDescription>
            Review and manage shift swap requests from employees
          </SheetDescription>
        </SheetHeader>
        
        <ScrollArea className="h-[calc(100vh-120px)] mt-4 -mx-6 px-6">
          {requests.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ArrowRightLeft className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No swap requests yet</p>
              <p className="text-xs mt-1">Employees can request to swap shifts with colleagues</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Pending requests */}
              {pendingRequests.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <Badge variant="secondary">{pendingRequests.length}</Badge>
                    Pending Approval
                  </h3>
                  <div className="space-y-3">
                    {pendingRequests.map((request) => (
                      <SwapRequestCard
                        key={request.id}
                        request={request}
                        onApprove={() => onApprove(request.id)}
                        onReject={() => onReject(request.id)}
                      />
                    ))}
                  </div>
                </div>
              )}
              
              {/* Processed requests */}
              {processedRequests.length > 0 && (
                <div>
                  {pendingRequests.length > 0 && <Separator className="my-4" />}
                  <h3 className="text-sm font-medium mb-3 text-muted-foreground">
                    Recent Activity
                  </h3>
                  <div className="space-y-3">
                    {processedRequests.map((request) => (
                      <SwapRequestCard
                        key={request.id}
                        request={request}
                        onApprove={() => {}}
                        onReject={() => {}}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}