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
      <Card className="border-border">
        <CardHeader className="pb-2">
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
    <Card className="border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-foreground">Waste Logs Leaderboard</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-xs font-medium text-muted-foreground h-9">Team Member</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground text-right h-9">Waste Logs</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground h-9">Location</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground text-right h-9">Logged waste value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leaderboard.map((item, index) => (
              <TableRow key={item.employeeId || index} className="hover:bg-muted/30">
                <TableCell className="py-2.5">
                  <div className="flex items-center gap-2.5">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-medium">
                        {item.initials}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{item.employeeName}</span>
                  </div>
                </TableCell>
                <TableCell className="py-2.5 text-right text-sm">
                  {item.logsCount}
                </TableCell>
                <TableCell className="py-2.5 text-sm text-muted-foreground">
                  {item.locationName || '-'}
                </TableCell>
                <TableCell className="py-2.5 text-right text-sm">
                  {currency}{item.totalValue.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow className="bg-transparent hover:bg-transparent">
              <TableCell colSpan={3} className="text-right text-xs text-muted-foreground font-medium py-2.5">
                SUM
              </TableCell>
              <TableCell className="text-right text-sm font-medium py-2.5">
                {currency}{totalValue.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </CardContent>
    </Card>
  );
}
