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

const TIME_OPTIONS = [
  '06:00', '06:30', '07:00', '07:30', '08:00', '08:30', '09:00', '09:30',
  '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
  '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
  '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30',
  '22:00', '22:30', '23:00', '23:30',
];

function calculateHours(startTime: string, endTime: string): number {
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);
  
  let startMinutes = startH * 60 + startM;
  let endMinutes = endH * 60 + endM;
  
  // Handle overnight shifts
  if (endMinutes <= startMinutes) {
    endMinutes += 24 * 60;
  }
  
  return (endMinutes - startMinutes) / 60;
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
  const [endTime, setEndTime] = useState('17:00');
  const [role, setRole] = useState(positions[0] || 'Server');
  
  const hours = calculateHours(startTime, endTime);
  const isValid = hours > 0 && hours <= 12;
  
  const handleSubmit = () => {
    if (!isValid) return;
    
    onSubmit({
      startTime,
      endTime,
      role,
    });
    
    // Reset form
    setStartTime('09:00');
    setEndTime('17:00');
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
          
          {/* Time selectors */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start-time">Start Time</Label>
              <Select value={startTime} onValueChange={setStartTime}>
                <SelectTrigger>
                  <SelectValue placeholder="Start" />
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  {TIME_OPTIONS.map((time) => (
                    <SelectItem key={time} value={time}>
                      {time}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="end-time">End Time</Label>
              <Select value={endTime} onValueChange={setEndTime}>
                <SelectTrigger>
                  <SelectValue placeholder="End" />
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  {TIME_OPTIONS.map((time) => (
                    <SelectItem key={time} value={time}>
                      {time}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* Hours preview */}
          <div className={`text-sm p-2 rounded-md ${isValid ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'}`}>
            {isValid ? (
              <span>Shift duration: <strong>{hours}h</strong></span>
            ) : hours > 12 ? (
              <span>⚠️ Shift cannot exceed 12 hours</span>
            ) : (
              <span>⚠️ End time must be after start time</span>
            )}
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid}>
            Create Shift
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}