import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { MapPin, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import type { LocationBenchmark, BenchmarkResult } from '@/hooks/useWasteBenchmark';

interface WasteBenchmarkProps {
  result: BenchmarkResult;
  isLoading?: boolean;
}

const TREND_CONFIG = {
  improving: { Icon: TrendingDown, color: 'text-emerald-500', label: 'Mejorando' },
  stable:    { Icon: Minus,        color: 'text-muted-foreground', label: 'Estable' },
  worsening: { Icon: TrendingUp,   color: 'text-red-500', label: 'Empeorando' },
};

export function WasteBenchmark({ result, isLoading = false }: WasteBenchmarkProps) {
  if (isLoading) {
    return (
      <Card className="border-border">
        <CardHeader className="pb-2"><Skeleton className="h-5 w-56" /></CardHeader>
        <CardContent><Skeleton className="h-[200px] w-full" /></CardContent>
      </Card>
    );
  }

  const { locations, overallAvgWaste, isAvailable } = result;

  if (!isAvailable) return null; // Don't render if <2 locations

  return (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            Benchmarking entre Locales
          </CardTitle>
          <div className="text-xs text-muted-foreground">
            Media: <span className="font-medium text-foreground">€{overallAvgWaste.toFixed(0)}</span>/local
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-xs font-medium text-muted-foreground h-9">#</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground h-9">Local</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground text-right h-9">Merma total</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground text-right h-9">vs Media</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground h-9">Motivo top</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground text-center h-9">Tendencia</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {locations.map(loc => (
              <BenchmarkRow key={loc.locationId} location={loc} />
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function BenchmarkRow({ location }: { location: LocationBenchmark }) {
  const trendConfig = TREND_CONFIG[location.trend];
  const TrendIcon = trendConfig.Icon;
  const isAboveAvg = location.vsAverage > 5;
  const isBelowAvg = location.vsAverage < -5;

  return (
    <TableRow className="hover:bg-muted/30">
      <TableCell className="py-2.5 text-xs text-muted-foreground w-8">
        {location.rank === 1 ? '🥇' : location.rank === 2 ? '🥈' : `${location.rank}`}
      </TableCell>
      <TableCell className="py-2.5">
        <span className="text-sm font-medium">{location.locationName}</span>
        <span className="text-xs text-muted-foreground ml-1.5">({location.wasteCount} eventos)</span>
      </TableCell>
      <TableCell className="py-2.5 text-right text-sm">
        €{location.totalWaste.toFixed(0)}
      </TableCell>
      <TableCell className="py-2.5 text-right">
        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${
          isBelowAvg ? 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30' :
          isAboveAvg ? 'bg-red-500/15 text-red-700 border-red-500/30' :
          'bg-gray-500/10 text-muted-foreground border-gray-300/30'
        }`}>
          {location.vsAverage > 0 ? '+' : ''}{location.vsAverage.toFixed(0)}%
        </Badge>
      </TableCell>
      <TableCell className="py-2.5 text-xs text-muted-foreground">
        {location.topReasonLabel}
      </TableCell>
      <TableCell className="py-2.5 text-center">
        <div className="flex items-center justify-center gap-1">
          <TrendIcon className={`h-3.5 w-3.5 ${trendConfig.color}`} />
          <span className={`text-[10px] ${trendConfig.color}`}>{trendConfig.label}</span>
        </div>
      </TableCell>
    </TableRow>
  );
}
