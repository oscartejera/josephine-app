/**
 * BadgePill — Small pill badge with colored dot
 * 
 * Used for module identification (Business Intelligence, Inventory, etc.)
 */
import { cn } from '@/lib/utils';

interface BadgePillProps {
  text: string;
  color: 'red' | 'blue' | 'green' | 'yellow' | 'orange' | 'lavender';
  variant?: 'light' | 'dark';
  className?: string;
}

export function BadgePill({ text, color, variant = 'light', className }: BadgePillProps) {
  return (
    <span className={cn('l-badge', variant === 'dark' && 'l-badge-dark', className)}>
      <span className={cn('l-badge-dot', color)} />
      {text}
    </span>
  );
}
