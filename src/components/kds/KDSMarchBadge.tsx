/**
 * KDS March Badge
 * Banda naranja para órdenes marchadas
 */

import { Flame } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface KDSMarchBadgeProps {
  isMarched: boolean;
  course: number;
  className?: string;
}

const courseLabels: Record<number, string> = {
  0: 'Bebidas',
  1: '1º Curso',
  2: '2º Curso',
  3: 'Postre',
};

export function KDSMarchBadge({ isMarched, course, className }: KDSMarchBadgeProps) {
  if (!isMarched) return null;

  return (
    <div className={cn(
      "w-full py-2 px-3 bg-orange-500 flex items-center justify-center gap-2",
      "border-y-2 border-orange-400 shadow-lg",
      className
    )}>
      <Flame className="h-5 w-5 text-white animate-pulse" />
      <span className="text-white font-bold text-sm uppercase tracking-wide">
        MARCHAR {courseLabels[course] || `Curso ${course}`}
      </span>
      <Flame className="h-5 w-5 text-white animate-pulse" />
    </div>
  );
}
