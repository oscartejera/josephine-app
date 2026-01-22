import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ArrowRightLeft, Calendar, Clock, User, MessageSquare } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import { Shift, Employee } from '@/hooks/useSchedulingSupabase';

interface SwapShiftDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (targetShift: Shift, reason?: string) => void;
  myShift: Shift;
  myName: string;
  availableShifts: { shift: Shift; employee: Employee }[];
}

export function SwapShiftDialog({
  isOpen,
  onClose,
  onSubmit,
  myShift,
  myName,
  availableShifts,
}: SwapShiftDialogProps) {
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  
  const selectedShift = availableShifts.find(s => s.shift.id === selectedShiftId);
  
  const handleSubmit = () => {
    if (!selectedShift) return;
    onSubmit(selectedShift.shift, reason || undefined);
    setSelectedShiftId(null);
    setReason('');
    onClose();
  };
  
  const handleClose = () => {
    setSelectedShiftId(null);
    setReason('');
    onClose();
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-primary" />
            Request Shift Swap
          </DialogTitle>
          <DialogDescription>
            Select a colleague's shift to propose a swap
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-2">
          {/* My shift card */}
          <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
            <div className="text-xs text-muted-foreground mb-1">Your shift</div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                {myName.split(' ').map(n => n[0]).join('')}
              </div>
              <div className="flex-1">
                <div className="font-medium text-sm">{myShift.role}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-3 w-3" />
                  {format(parseISO(myShift.date), 'EEE, MMM d')}
                  <Clock className="h-3 w-3 ml-1" />
                  {myShift.startTime} - {myShift.endTime}
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex items-center justify-center">
            <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
          </div>
          
          {/* Available shifts to swap with */}
          <div>
            <Label className="text-sm mb-2 block">Select shift to swap with</Label>
            <ScrollArea className="h-[200px] border rounded-lg p-2">
              {availableShifts.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-8">
                  No available shifts to swap with this week
                </div>
              ) : (
                <RadioGroup value={selectedShiftId || ''} onValueChange={setSelectedShiftId}>
                  <div className="space-y-2">
                    {availableShifts.map(({ shift, employee }) => (
                      <label
                        key={shift.id}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                          selectedShiftId === shift.id 
                            ? "bg-primary/5 border-primary/40" 
                            : "hover:bg-muted/50 border-border"
                        )}
                      >
                        <RadioGroupItem value={shift.id} id={shift.id} />
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                          {employee.initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">{employee.name}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(parseISO(shift.date), 'EEE, MMM d')}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {shift.startTime} - {shift.endTime}
                            </span>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </RadioGroup>
              )}
            </ScrollArea>
          </div>
          
          {/* Reason (optional) */}
          <div className="space-y-2">
            <Label htmlFor="reason" className="flex items-center gap-2 text-sm">
              <MessageSquare className="h-4 w-4" />
              Reason (optional)
            </Label>
            <Textarea
              id="reason"
              placeholder="E.g., Doctor's appointment on Thursday..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              className="resize-none"
            />
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!selectedShiftId}>
            Send Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}