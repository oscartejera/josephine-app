import { useEffect, useRef, useState } from 'react';
import { MapPin, Check, ChevronDown, Search } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { useTranslation } from 'react-i18next';

interface LocationSwitcherProps {
  /** When true, shows only the icon (for collapsed sidebar) */
  collapsed?: boolean;
  /** Alignment of the dropdown */
  align?: 'start' | 'end' | 'center';
  /** Side for the dropdown (used in collapsed mode) */
  side?: 'bottom' | 'right' | 'left' | 'top';
}

export function LocationSwitcher({
  const { t } = useTranslation(); collapsed = false, align = 'start', side }: LocationSwitcherProps) {
  const {
    selectedLocationId,
    setSelectedLocationId,
    accessibleLocations,
    canShowAllLocations,
  } = useApp();

  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Derive label for current selection
  const selectedLocationLabel =
    selectedLocationId === 'all'
      ? 'Todos los locales'
      : accessibleLocations.find(l => l.id === selectedLocationId)?.name || 'Seleccionar local';

  // Keyboard shortcut: Cmd+L / Ctrl+L to toggle location switcher
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'l') {
        e.preventDefault();
        // Programmatically click the trigger to toggle the dropdown
        triggerRef.current?.click();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Don't render anything if no locations
  if (accessibleLocations.length === 0) return null;

  const handleSelect = (id: string) => {
    setSelectedLocationId(id);
    setOpen(false);
  };

  if (collapsed) {
    return (
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button ref={triggerRef} variant="ghost" size="icon" className="w-full h-10 mb-2">
            <MapPin className="h-4 w-4 text-primary" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side={side || 'right'} align={align} className="w-56">
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Locales ({accessibleLocations.length})
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {canShowAllLocations && (
            <DropdownMenuItem onClick={() => handleSelect('all')}>
              <span className="flex-1">Todos los locales</span>
              {selectedLocationId === 'all' && <Check className="h-4 w-4 text-primary" />}
            </DropdownMenuItem>
          )}
          {accessibleLocations.map(loc => (
            <DropdownMenuItem key={loc.id} onClick={() => handleSelect(loc.id)}>
              <div className="flex-1">
                <div className="text-sm">{loc.name}</div>
                {loc.city && <div className="text-xs text-muted-foreground">{loc.city}</div>}
              </div>
              {selectedLocationId === loc.id && <Check className="h-4 w-4 text-primary" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          ref={triggerRef}
          variant="outline"
          className="w-full justify-start gap-2 h-10 mb-2 border-border/60 bg-muted/30 hover:bg-muted/50"
        >
          <MapPin className="h-4 w-4 shrink-0 text-primary" />
          <span className="flex-1 text-left text-sm truncate">{selectedLocationLabel}</span>
          <kbd className="hidden md:inline-flex h-5 items-center rounded border bg-muted px-1 text-[10px] text-muted-foreground">
            ⌘L
          </kbd>
          <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-56">
        <DropdownMenuLabel className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Locales</span>
          <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded-full text-[10px] font-medium">
            {accessibleLocations.length}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {canShowAllLocations && (
          <DropdownMenuItem onClick={() => handleSelect('all')}>
            <span className="flex-1 font-medium">Todos los locales</span>
            {selectedLocationId === 'all' && <Check className="h-4 w-4 text-primary" />}
          </DropdownMenuItem>
        )}
        {canShowAllLocations && <DropdownMenuSeparator />}
        {accessibleLocations.map(loc => (
          <DropdownMenuItem key={loc.id} onClick={() => handleSelect(loc.id)}>
            <div className="flex-1">
              <div className="text-sm">{loc.name}</div>
              {loc.city && <div className="text-xs text-muted-foreground">{loc.city}</div>}
            </div>
            {selectedLocationId === loc.id && <Check className="h-4 w-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
