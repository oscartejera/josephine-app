/**
 * Seat Picker
 * Selector de asiento para asignar items
 */

import { Button } from '@/components/ui/button';
import { Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SeatPickerProps {
  covers: number;
  selectedSeat: number | null;
  onSelectSeat: (seat: number | null) => void;
}

export function SeatPicker({ covers, selectedSeat, onSelectSeat }: SeatPickerProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Button
        variant={selectedSeat === null ? 'default' : 'outline'}
        size="sm"
        onClick={() => onSelectSeat(null)}
        className={cn('h-9', selectedSeat === null && 'ring-2 ring-primary')}
      >
        Sin asiento
      </Button>
      
      {Array.from({ length: covers }, (_, i) => i + 1).map((seat) => (
        <Button
          key={seat}
          variant={selectedSeat === seat ? 'default' : 'outline'}
          size="sm"
          onClick={() => onSelectSeat(seat)}
          className={cn('h-9 w-14', selectedSeat === seat && 'ring-2 ring-primary')}
        >
          <Users className="h-3 w-3 mr-1" />
          {seat}
        </Button>
      ))}
    </div>
  );
}
