import { useState } from 'react';
import { format } from 'date-fns';
import { Clock, User, Briefcase } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface CreateShiftDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    startTime: string;
    endTime: string;
    role: string;
  }) => void;
  employeeName: string;
  date: Date;
  positions: string[];
}

// Time options for 8h shifts starting at each hour
const START_TIME_OPTIONS = [
  '06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00',
  '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00',
];

// Spanish law: shifts must be exactly 8 hours
const SHIFT_HOURS = 8;

function calculateEndTime(startTime: string): string {
  const [startH, startM] = startTime.split(':').map(Number);
  let endH = startH + SHIFT_HOURS;
  
  // Handle overnight (e.g., 22:00 -> 06:00)
  if (endH >= 24) {
    endH = endH - 24;
  }
  
  return `${String(endH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`;
}

function isOvernightShift(startTime: string): boolean {
  const [startH] = startTime.split(':').map(Number);
  return startH >= 16; // 16:00 or later ends after midnight
}

export function CreateShiftDialog({
  isOpen,
  onClose,
  onSubmit,
  employeeName,
  date,
  positions,
}: CreateShiftDialogProps) {
  const [startTime, setStartTime] = useState('09:00');
  const [role, setRole] = useState(positions[0] || 'Server');
  
  // End time is always 8 hours after start (Spanish labor law)
  const endTime = calculateEndTime(startTime);
  const overnight = isOvernightShift(startTime);
  
  const handleSubmit = () => {
    onSubmit({
      startTime,
      endTime,
      role,
    });
    
    // Reset form
    setStartTime('09:00');
    setRole(positions[0] || 'Server');
    onClose();
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Create New Shift
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Employee & Date info */}
          <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{employeeName}</span>
            </div>
            <div className="text-sm text-muted-foreground">
              {format(date, 'EEEE, MMM d')}
            </div>
          </div>
          
          {/* Role selector */}
          <div className="space-y-2">
            <Label htmlFor="role" className="flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              Role / Position
            </Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                {positions.map((pos) => (
                  <SelectItem key={pos} value={pos}>
                    {pos}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Time selector - only start time (end is auto-calculated) */}
          <div className="space-y-2">
            <Label htmlFor="start-time">Start Time</Label>
            <Select value={startTime} onValueChange={setStartTime}>
              <SelectTrigger>
                <SelectValue placeholder="Start" />
              </SelectTrigger>
              <SelectContent className="max-h-[200px]">
                {START_TIME_OPTIONS.map((time) => (
                  <SelectItem key={time} value={time}>
                    {time}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Shift duration info (fixed 8h per Spanish law) */}
          <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Duration:</span>
              <span className="font-semibold text-primary">{SHIFT_HOURS}h (Spanish law)</span>
            </div>
            <div className="flex items-center justify-between text-sm mt-1">
              <span className="text-muted-foreground">End Time:</span>
              <span className="font-medium">
                {endTime}
                {overnight && <span className="text-xs text-muted-foreground ml-1">(+1 day)</span>}
              </span>
            </div>
          </div>
          
          {overnight && (
            <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded-md flex items-center gap-2">
              <Clock className="h-3 w-3" />
              Overnight shift: ends next day at {endTime}
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>
            Create Shift
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}