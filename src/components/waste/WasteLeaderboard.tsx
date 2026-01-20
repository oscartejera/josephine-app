import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { WasteLeaderboard as WasteLeaderboardType } from '@/hooks/useWasteData';

interface WasteLeaderboardProps {
  leaderboard: WasteLeaderboardType[];
  isLoading?: boolean;
  currency?: string;
}

export function WasteLeaderboard({
  leaderboard,
  isLoading = false,
  currency = '€'
}: WasteLeaderboardProps) {
  if (isLoading) {
    return (
      <Card className="border-[hsl(var(--bi-border))]">
        <CardHeader>
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  const totalValue = leaderboard.reduce((sum, l) => sum + l.totalValue, 0);

  return (
    <Card className="border-[hsl(var(--bi-border))]">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Waste Logs Leaderboard</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Team Member</TableHead>
              <TableHead className="text-xs text-right">Waste Logs</TableHead>
              <TableHead className="text-xs">Location</TableHead>
              <TableHead className="text-xs text-right">Logged waste value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leaderboard.map((item, index) => (
              <TableRow key={item.employeeId || index}>
                <TableCell className="py-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                        {item.initials}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">{item.employeeName}</span>
                  </div>
                </TableCell>
                <TableCell className="py-3 text-right text-sm">
                  {item.logsCount}
                </TableCell>
                <TableCell className="py-3 text-sm text-muted-foreground">
                  {item.locationName}
                </TableCell>
                <TableCell className="py-3 text-right text-sm font-medium">
                  {currency}{item.totalValue.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={3} className="font-semibold">Total</TableCell>
              <TableCell className="text-right font-semibold">
                {currency}{totalValue.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </CardContent>
    </Card>
  );
}
