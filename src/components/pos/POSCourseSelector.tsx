import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { UtensilsCrossed, Soup, IceCream2 } from 'lucide-react';

export const COURSE_CONFIG = {
  1: { 
    label: '1º Curso', 
    shortLabel: '1º', 
    color: 'emerald',
    bgClass: 'bg-emerald-500',
    bgClassLight: 'bg-emerald-500/20',
    borderClass: 'border-emerald-500',
    textClass: 'text-emerald-500',
    icon: Soup,
  },
  2: { 
    label: '2º Curso', 
    shortLabel: '2º', 
    color: 'blue',
    bgClass: 'bg-blue-500',
    bgClassLight: 'bg-blue-500/20',
    borderClass: 'border-blue-500',
    textClass: 'text-blue-500',
    icon: UtensilsCrossed,
  },
  3: { 
    label: 'Postre', 
    shortLabel: '🍰', 
    color: 'purple',
    bgClass: 'bg-purple-500',
    bgClassLight: 'bg-purple-500/20',
    borderClass: 'border-purple-500',
    textClass: 'text-purple-500',
    icon: IceCream2,
  },
} as const;

export type CourseNumber = keyof typeof COURSE_CONFIG;

export function getCourseConfig(course: number) {
  return COURSE_CONFIG[course as CourseNumber] || COURSE_CONFIG[1];
}

interface POSCourseSelectorProps {
  selectedCourse: number;
  onCourseChange: (course: number) => void;
  courseCounts?: Record<number, number>;
  compact?: boolean;
}

export function POSCourseSelector({ 
  selectedCourse, 
  onCourseChange, 
  courseCounts = {},
  compact = false 
}: POSCourseSelectorProps) {
  const courses = [1, 2, 3] as const;

  return (
    <div className={cn("flex gap-1", compact ? "gap-0.5" : "gap-1")}>
      {courses.map((course) => {
        const config = COURSE_CONFIG[course];
        const Icon = config.icon;
        const count = courseCounts[course] || 0;
        const isSelected = selectedCourse === course;

        return (
          <Button
            key={course}
            variant={isSelected ? "default" : "outline"}
            size={compact ? "sm" : "default"}
            onClick={() => onCourseChange(course)}
            className={cn(
              "relative transition-all",
              compact ? "h-8 px-2" : "h-9 px-3",
              isSelected && config.bgClass,
              isSelected && "text-white border-transparent",
              !isSelected && config.textClass,
              !isSelected && "hover:bg-muted"
            )}
          >
            <Icon className={cn("h-4 w-4", compact ? "mr-1" : "mr-1.5")} />
            <span className={compact ? "text-xs" : "text-sm"}>
              {compact ? config.shortLabel : config.label}
            </span>
            {count > 0 && (
              <span className={cn(
                "absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center",
                "rounded-full text-[10px] font-bold",
                isSelected ? "bg-white text-zinc-900" : cn(config.bgClass, "text-white")
              )}>
                {count}
              </span>
            )}
          </Button>
        );
      })}
    </div>
  );
}

// Badge component for showing course indicator on items
interface CourseBadgeProps {
  course: number;
  size?: 'sm' | 'md';
  showLabel?: boolean;
}

export function CourseBadge({ course, size = 'sm', showLabel = false }: CourseBadgeProps) {
  const config = getCourseConfig(course);
  const Icon = config.icon;

  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full font-medium",
      config.bgClass,
      "text-white",
      size === 'sm' ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs"
    )}>
      <Icon className={size === 'sm' ? "h-2.5 w-2.5" : "h-3 w-3"} />
      {showLabel && <span>{config.shortLabel}</span>}
    </span>
  );
}
