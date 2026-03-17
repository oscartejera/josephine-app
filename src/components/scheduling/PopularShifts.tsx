import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ShiftTemplate {
  id: string;
  label: string;
  startTime: string;
  endTime: string;
  hours: number;
  colorClass: string;
}

const POPULAR_SHIFTS: ShiftTemplate[] = [
  { id: 'apertura', label: 'Apertura', startTime: '09:00', endTime: '14:00', hours: 5, colorClass: 'bg-orange-50 border-orange-200 text-orange-700' },
  { id: 'comida', label: 'Comida', startTime: '11:00', endTime: '16:00', hours: 5, colorClass: 'bg-blue-50 border-blue-200 text-blue-700' },
  { id: 'jornada', label: 'Jornada', startTime: '10:00', endTime: '18:00', hours: 8, colorClass: 'bg-slate-100 border-slate-300 text-slate-700' },
  { id: 'tarde', label: 'Tarde', startTime: '16:00', endTime: '23:30', hours: 7.5, colorClass: 'bg-purple-50 border-purple-200 text-purple-700' },
  { id: 'cena', label: 'Cena', startTime: '18:00', endTime: '23:30', hours: 5.5, colorClass: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
];

interface PopularShiftsProps {
  onDragStart?: (template: { startTime: string; endTime: string; hours: number; label: string }) => void;
}

export function PopularShifts({ onDragStart }: PopularShiftsProps) {
  const handleDragStart = (e: React.DragEvent, shift: ShiftTemplate) => {
    const payload = {
      type: 'template',
      startTime: shift.startTime,
      endTime: shift.endTime,
      hours: shift.hours,
      label: shift.label,
    };
    e.dataTransfer.setData('application/json', JSON.stringify(payload));
    e.dataTransfer.effectAllowed = 'copy';
    onDragStart?.(payload);
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">Popular Shifts</span>
      <div className="flex items-center gap-1.5 overflow-x-auto">
        {POPULAR_SHIFTS.map((shift) => (
          <div
            key={shift.id}
            draggable
            onDragStart={(e) => handleDragStart(e, shift)}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs cursor-grab active:cursor-grabbing hover:shadow-sm transition-all select-none shrink-0",
              shift.colorClass
            )}
          >
            <GripVertical className="h-3 w-3 opacity-50" />
            <span className="font-medium">{shift.label}</span>
            <span className="opacity-70">{shift.startTime}-{shift.endTime}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
