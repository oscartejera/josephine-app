import { ChevronDown, Users, Briefcase, MapPin, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ViewMode } from '@/hooks/useSchedulingData';

interface ViewModeDropdownProps {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
}

const VIEW_OPTIONS: { value: ViewMode; label: string; icon: typeof Users }[] = [
  { value: 'departments', label: 'Departments', icon: Building2 },
  { value: 'people', label: 'People', icon: Users },
  { value: 'positions', label: 'Positions', icon: Briefcase },
  { value: 'stations', label: 'Stations', icon: MapPin },
];

export function ViewModeDropdown({ value, onChange }: ViewModeDropdownProps) {
  const selected = VIEW_OPTIONS.find(o => o.value === value) || VIEW_OPTIONS[0];
  const Icon = selected.icon;
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Icon className="h-4 w-4" />
          {selected.label}
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        {VIEW_OPTIONS.map((option) => {
          const OptionIcon = option.icon;
          return (
            <DropdownMenuItem
              key={option.value}
              onClick={() => onChange(option.value)}
              className="gap-2"
            >
              <OptionIcon className="h-4 w-4" />
              {option.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
