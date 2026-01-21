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
import type { WasteLeaderboardEntry } from '@/hooks/useWasteDataNew';

interface WasteLeaderboardProps {
  leaderboard: WasteLeaderboardEntry[];
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
          <Skeleton className="h-[280px] w-full" />
        </CardContent>
      </Card>
    );
  }

  const totalValue = leaderboard.reduce((sum, l) => sum + l.totalValue, 0);

  return (
    <Card className="border-border">
      <CardHeader className="pb-2 px-6 pt-5">
        <CardTitle className="text-sm font-medium text-foreground">Waste Logs Leaderboard</CardTitle>
      </CardHeader>
      <CardContent className="px-6 pb-4">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b-0">
              <TableHead className="text-xs font-medium text-muted-foreground h-8 pl-0">Team Member</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground text-right h-8">Waste Logs</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground h-8">Location</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground text-right h-8 pr-0">Logged waste value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leaderboard.map((item, index) => (
              <TableRow key={`${item.userName}-${index}`} className="hover:bg-muted/30 border-b-0">
                <TableCell className="py-2 pl-0">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-medium">
                        {item.initials}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{item.userName}</span>
                  </div>
                </TableCell>
                <TableCell className="py-2 text-right text-sm">
                  {item.logsCount}
                </TableCell>
                <TableCell className="py-2 text-sm text-muted-foreground">
                  {item.locationName || '-'}
                </TableCell>
                <TableCell className="py-2 text-right text-sm pr-0">
                  {currency}{item.totalValue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow className="bg-transparent hover:bg-transparent border-t border-border">
              <TableCell colSpan={3} className="text-right text-xs text-muted-foreground font-medium py-2 pl-0">
                SUM
              </TableCell>
              <TableCell className="text-right text-sm font-medium py-2 pr-0">
                {currency}{totalValue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </CardContent>
    </Card>
  );
}
