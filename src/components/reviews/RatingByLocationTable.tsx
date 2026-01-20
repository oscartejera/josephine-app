import { useState } from 'react';
import { Search } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { LocationRatingData } from '@/hooks/useReviewsData';
import { cn } from '@/lib/utils';

interface RatingByLocationTableProps {
  data: LocationRatingData[];
  isLoading: boolean;
  onLocationClick: (locationId: string) => void;
}

export function RatingByLocationTable({ data, isLoading, onLocationClick }: RatingByLocationTableProps) {
  const [search, setSearch] = useState('');

  const filteredData = data.filter((loc) =>
    loc.location_name.toLowerCase().includes(search.toLowerCase())
  );

  // Calculate averages/totals
  const avgRating = data.length > 0 ? data.reduce((sum, l) => sum + l.rating_avg, 0) / data.length : 0;
  const totalRatings = data.reduce((sum, l) => sum + l.total_ratings, 0);
  const avgResponseRate = data.length > 0 ? data.reduce((sum, l) => sum + l.response_rate, 0) / data.length : 0;

  return (
    <Card className="p-5 bg-card border border-border/60 rounded-xl">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-foreground">Rating by location</h3>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by location"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/60">
                <th className="text-left text-xs font-medium text-muted-foreground pb-3 pr-4">Locations</th>
                <th className="text-right text-xs font-medium text-muted-foreground pb-3 pr-4 w-20">Rating</th>
                <th className="text-right text-xs font-medium text-muted-foreground pb-3 pr-4 w-24">Total Ratings</th>
                <th className="text-left text-xs font-medium text-muted-foreground pb-3 pr-4 w-48">Rating Distribution</th>
                <th className="text-right text-xs font-medium text-muted-foreground pb-3 w-28">Response Rate</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((loc) => (
                <tr
                  key={loc.location_id}
                  className="border-b border-border/30 last:border-0 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => onLocationClick(loc.location_id)}
                >
                  <td className="py-3 pr-4">
                    <span className="text-sm font-medium text-foreground">{loc.location_name}</span>
                  </td>
                  <td className="py-3 pr-4 text-right">
                    <span className="text-sm font-medium text-foreground">{loc.rating_avg.toFixed(2)}</span>
                  </td>
                  <td className="py-3 pr-4 text-right">
                    <span className="text-sm text-foreground">{loc.total_ratings}</span>
                  </td>
                  <td className="py-3 pr-4">
                    <div className="flex h-2 rounded-full overflow-hidden bg-muted">
                      <div
                        className="bg-success/70"
                        style={{ width: `${loc.distribution.pos}%` }}
                      />
                      <div
                        className="bg-amber-400"
                        style={{ width: `${loc.distribution.neutral}%` }}
                      />
                      <div
                        className="bg-destructive/70"
                        style={{ width: `${loc.distribution.neg}%` }}
                      />
                    </div>
                  </td>
                  <td className="py-3 text-right">
                    <span className="text-sm text-foreground">{loc.response_rate.toFixed(0)}%</span>
                  </td>
                </tr>
              ))}
              {/* Summary row */}
              <tr className="bg-muted/30 font-medium">
                <td className="py-3 pr-4">
                  <span className="text-sm text-foreground">AVG / SUM</span>
                </td>
                <td className="py-3 pr-4 text-right">
                  <span className="text-sm text-foreground">{avgRating.toFixed(2)}</span>
                </td>
                <td className="py-3 pr-4 text-right">
                  <span className="text-sm text-foreground">{totalRatings}</span>
                </td>
                <td className="py-3 pr-4">
                  <span className="text-xs text-muted-foreground">—</span>
                </td>
                <td className="py-3 text-right">
                  <span className="text-sm text-foreground">{avgResponseRate.toFixed(0)}%</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
