import { Minus, Plus, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { KDSModifier } from '@/hooks/useKDSData';

interface KDSModifierBadgeProps {
  modifier: KDSModifier;
  size?: 'sm' | 'md' | 'lg';
}

export function KDSModifierBadge({ modifier, size = 'md' }: KDSModifierBadgeProps) {
  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5 gap-1',
    md: 'text-sm px-2 py-1 gap-1.5',
    lg: 'text-base px-3 py-1.5 gap-2',
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-3.5 w-3.5',
    lg: 'h-4 w-4',
  };

  const config = {
    remove: {
      bg: 'bg-red-500/30',
      border: 'border-red-500',
      text: 'text-red-200',
      icon: Minus,
      prefix: 'SIN',
    },
    add: {
      bg: 'bg-emerald-500/30',
      border: 'border-emerald-500',
      text: 'text-emerald-200',
      icon: Plus,
      prefix: 'EXTRA',
    },
    substitute: {
      bg: 'bg-amber-500/30',
      border: 'border-amber-500',
      text: 'text-amber-200',
      icon: RefreshCw,
      prefix: 'CAMBIAR',
    },
  };

  const { bg, border, text, icon: Icon, prefix } = config[modifier.type];
  
  // Determine the display text
  const displayText = modifier.option_name || modifier.modifier_name;

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-md border font-bold uppercase",
        bg,
        border,
        text,
        sizeClasses[size]
      )}
    >
      <Icon className={iconSizes[size]} />
      <span>{prefix}</span>
      <span className="font-medium normal-case">{displayText}</span>
    </div>
  );
}

interface KDSModifiersListProps {
  modifiers: KDSModifier[];
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function KDSModifiersList({ modifiers, size = 'md', className }: KDSModifiersListProps) {
  if (!modifiers || modifiers.length === 0) return null;

  // Sort modifiers: remove first, then substitute, then add
  const sortedModifiers = [...modifiers].sort((a, b) => {
    const order = { remove: 0, substitute: 1, add: 2 };
    return order[a.type] - order[b.type];
  });

  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {sortedModifiers.map((modifier) => (
        <KDSModifierBadge key={modifier.id} modifier={modifier} size={size} />
      ))}
    </div>
  );
}
