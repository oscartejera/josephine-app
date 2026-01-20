import { useState } from 'react';
import { format, addDays, differenceInDays, parseISO } from 'date-fns';
import { Calendar, Clock, FileText, Plane, HeartPulse, User, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { TimeOffRequest } from '@/hooks/useAvailabilityData';

interface TimeOffRequestDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (request: Omit<TimeOffRequest, 'id' | 'employeeId' | 'employeeName' | 'employeeInitials' | 'status' | 'createdAt'>) => Promise<void>;
}

const TYPE_CONFIG: Record<TimeOffRequest['type'], { label: string; icon: React.ElementType }> = {
  vacation: { label: 'Vacation', icon: Plane },
  sick: { label: 'Sick Leave', icon: HeartPulse },
  personal: { label: 'Personal', icon: User },
  other: { label: 'Other', icon: MoreHorizontal },
};

export function TimeOffRequestDialog({
  isOpen,
  onClose,
  onSubmit,
}: TimeOffRequestDialogProps) {
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [type, setType] = useState<TimeOffRequest['type']>('vacation');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const duration = startDate && endDate 
    ? differenceInDays(endDate, startDate) + 1 
    : 0;
  
  const isValid = startDate && endDate && reason.trim().length > 0 && duration > 0;
  
  const handleSubmit = async () => {
    if (!isValid || !startDate || !endDate) return;
    
    setIsSubmitting(true);
    try {
      await onSubmit({
        startDate: format(startDate, 'yyyy-MM-dd'),
        endDate: format(endDate, 'yyyy-MM-dd'),
        type,
        reason: reason.trim(),
      });
      
      // Reset form
      setStartDate(undefined);
      setEndDate(undefined);
      setType('vacation');
      setReason('');
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleClose = () => {
    setStartDate(undefined);
    setEndDate(undefined);
    setType('vacation');
    setReason('');
    onClose();
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Request Time Off
          </DialogTitle>
          <DialogDescription>
            Submit a request for time off. Your manager will review and approve or reject it.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Type selector */}
          <div className="space-y-2">
            <Label>Type of Leave</Label>
            <Select value={type} onValueChange={(v) => setType(v as TimeOffRequest['type'])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TYPE_CONFIG).map(([key, config]) => {
                  const Icon = config.icon;
                  return (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        {config.label}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          
          {/* Date range */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, 'MMM d, yyyy') : 'Select date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => {
                      setStartDate(date);
                      if (date && (!endDate || date > endDate)) {
                        setEndDate(date);
                      }
                    }}
                    disabled={(date) => date < new Date()}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
            
            <div className="space-y-2">
              <Label>End Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, 'MMM d, yyyy') : 'Select date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    disabled={(date) => date < (startDate || new Date())}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          
          {/* Duration preview */}
          {duration > 0 && (
            <div className="p-3 bg-primary/5 rounded-lg text-sm">
              <span className="font-medium">{duration} day{duration !== 1 ? 's' : ''}</span>
              <span className="text-muted-foreground"> requested</span>
            </div>
          )}
          
          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">Reason</Label>
            <Textarea
              id="reason"
              placeholder="Brief description of why you need this time off..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid || isSubmitting}>
            {isSubmitting ? 'Submitting...' : 'Submit Request'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}