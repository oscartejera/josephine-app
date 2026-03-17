import { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string | ReactNode;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: {
    value: number;
    label?: string;
    positive?: boolean;
  };
  variant?: 'default' | 'success' | 'warning' | 'danger';
  className?: string;
  children?: ReactNode;
}

export function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  variant = 'default',
  className,
  children
}: MetricCardProps) {
  const variantStyles = {
    default: 'border-l-primary',
    success: 'border-l-success',
    warning: 'border-l-warning',
    danger: 'border-l-destructive'
  };

  return (
    <Card className={cn("border-l-4", variantStyles[variant], className)}>
      <CardContent className="p-4 md:p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl md:text-3xl font-display font-bold">{value}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
            {trend && (
              <div className="flex items-center gap-1 mt-1">
                <span className={cn(
                  "text-xs font-medium",
                  trend.positive ? "text-success" : "text-destructive"
                )}>
                  {trend.positive ? '+' : ''}{trend.value}%
                </span>
                {trend.label && (
                  <span className="text-xs text-muted-foreground">{trend.label}</span>
                )}
              </div>
            )}
          </div>
          {Icon && (
            <div className={cn(
              "p-2 rounded-lg",
              variant === 'success' && "bg-success/10 text-success",
              variant === 'warning' && "bg-warning/10 text-warning",
              variant === 'danger' && "bg-destructive/10 text-destructive",
              variant === 'default' && "bg-primary/10 text-primary"
            )}>
              <Icon className="h-5 w-5" />
            </div>
          )}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}
