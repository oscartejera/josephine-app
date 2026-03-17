/**
 * LabourByRole - Breakdown of labour metrics by employee role
 * Shows COL%, Hours, and Cost by role type
 */

import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';
import type { MetricMode } from '@/hooks/useLabourData';

interface RoleData {
  role: string;
  hours: number;
  cost: number;
  salesShare: number;
  col: number;
  variance: number;
  count: number;
}

interface LabourByRoleProps {
  isLoading?: boolean;
  metricMode: MetricMode;
}

const ROLE_COLORS = {
  Chef: '#ef4444',
  Server: '#f59e0b',
  Bartender: '#8b5cf6',
  Host: '#06b6d4',
  Manager: '#10b981',
  Other: '#6b7280',
};

const VarianceIndicator = ({ value, inverted = false }: { value: number; inverted?: boolean }) => {
  const isPositive = inverted ? value <= 0 : value >= 0;
  const Icon = isPositive ? TrendingUp : TrendingDown;
  
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-medium', isPositive ? 'text-emerald-600' : 'text-rose-600')}>
      <Icon className="h-3 w-3" />
      {isPositive ? '+' : ''}{value.toFixed(2)}%
    </span>
  );
};

function RoleSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map(i => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}

export function LabourByRole({ isLoading, metricMode }: LabourByRoleProps) {
  // Mock data - in production would come from backend
  const rolesData: RoleData[] = [
    { role: 'Chef', hours: 180, cost: 3600, salesShare: 35, col: 28.5, variance: -2.1, count: 8 },
    { role: 'Server', hours: 240, cost: 3360, salesShare: 40, col: 26.8, variance: 1.5, count: 12 },
    { role: 'Bartender', hours: 120, cost: 1920, salesShare: 15, col: 30.2, variance: 3.2, count: 5 },
    { role: 'Host', hours: 60, cost: 840, salesShare: 5, col: 33.6, variance: 5.1, count: 3 },
    { role: 'Manager', hours: 50, cost: 1250, salesShare: 5, col: 25.0, variance: -1.8, count: 2 },
  ];

  const totalHours = rolesData.reduce((sum, r) => sum + r.hours, 0);
  const totalCost = rolesData.reduce((sum, r) => sum + r.cost, 0);

  if (isLoading) {
    return (
      <Card className="p-6 bg-white">
        <h3 className="text-base font-semibold text-gray-900 mb-4">Labour by Role</h3>
        <RoleSkeleton />
      </Card>
    );
  }

  return (
    <Card className="p-6 bg-white">
      <h3 className="text-base font-semibold text-gray-900 mb-4">Labour by Role</h3>
      
      <div className="space-y-4">
        {rolesData.map((role) => {
          const percentage = (role.hours / totalHours) * 100;
          
          return (
            <div key={role.role} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: ROLE_COLORS[role.role as keyof typeof ROLE_COLORS] }}
                  ></div>
                  <div>
                    <span className="font-medium text-gray-900">{role.role}</span>
                    <span className="text-sm text-gray-500 ml-2">({role.count} employees)</span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {metricMode === 'percentage' && (
                    <>
                      <span className="text-sm text-gray-600">COL: {role.col.toFixed(1)}%</span>
                      <VarianceIndicator value={role.variance} inverted={true} />
                    </>
                  )}
                  {metricMode === 'hours' && (
                    <span className="text-sm font-semibold text-gray-900">{role.hours.toFixed(1)}h</span>
                  )}
                  {metricMode === 'amount' && (
                    <span className="text-sm font-semibold text-gray-900">€{role.cost.toLocaleString()}</span>
                  )}
                </div>
              </div>
              
              {/* Progress bar */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2.5 bg-gray-100 rounded-sm overflow-hidden">
                  <div 
                    className="h-full transition-all"
                    style={{ 
                      width: `${percentage}%`,
                      backgroundColor: ROLE_COLORS[role.role as keyof typeof ROLE_COLORS]
                    }}
                  ></div>
                </div>
                <span className="text-xs text-gray-500 w-12 text-right">
                  {percentage.toFixed(1)}%
                </span>
              </div>
            </div>
          );
        })}

        {/* Total row */}
        <div className="pt-3 border-t flex items-center justify-between font-semibold text-gray-900">
          <span>Total</span>
          <div className="flex items-center gap-4">
            {metricMode === 'hours' && <span>{totalHours.toFixed(1)}h</span>}
            {metricMode === 'amount' && <span>€{totalCost.toLocaleString()}</span>}
            {metricMode === 'percentage' && <span>100%</span>}
          </div>
        </div>
      </div>
    </Card>
  );
}
