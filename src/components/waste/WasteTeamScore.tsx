import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Tooltip, TooltipContent, TooltipTrigger, TooltipProvider,
} from '@/components/ui/tooltip';
import { Trophy, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import type { TeamMemberScore, TeamScoreResult } from '@/hooks/useWasteTeamScore';

interface WasteTeamScoreProps {
  result: TeamScoreResult;
  isLoading?: boolean;
}

const SCORE_COLORS = {
  high:   'text-emerald-600',
  medium: 'text-amber-600',
  low:    'text-red-600',
};

function scoreColor(score: number) {
  if (score >= 70) return SCORE_COLORS.high;
  if (score >= 40) return SCORE_COLORS.medium;
  return SCORE_COLORS.low;
}

const TREND_ICONS = {
  down:   { Icon: TrendingDown, color: 'text-emerald-500', label: 'Merma bajando ↓' },
  stable: { Icon: Minus,        color: 'text-muted-foreground', label: 'Merma estable' },
  up:     { Icon: TrendingUp,   color: 'text-red-500', label: 'Merma subiendo ↑' },
};

export function WasteTeamScore({ result, isLoading = false }: WasteTeamScoreProps) {
  if (isLoading) {
    return (
      <Card className="border-border">
        <CardHeader className="pb-2"><Skeleton className="h-5 w-48" /></CardHeader>
        <CardContent><Skeleton className="h-[300px] w-full" /></CardContent>
      </Card>
    );
  }

  const { members, teamAvgScore, topPerformer } = result;

  if (members.length === 0) {
    return (
      <Card className="border-border bg-muted/30">
        <CardContent className="py-5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted">
              <Trophy className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Sin datos de equipo</p>
              <p className="text-xs text-muted-foreground">
                Registra mermas con usuario asignado para ver el score del equipo.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <Card className="border-border">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
              <Trophy className="h-4 w-4 text-primary" />
              Score del Equipo
            </CardTitle>
            <div className="text-xs text-muted-foreground">
              Media: <span className={`font-bold ${scoreColor(teamAvgScore)}`}>{teamAvgScore}/100</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Basado en volumen de registros, tendencia, diversidad de motivos y consistencia
          </p>
        </CardHeader>
        <CardContent className="pt-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs font-medium text-muted-foreground h-9">Miembro</TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground text-center h-9">Score</TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground text-center h-9">Nivel</TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground text-center h-9">Trend</TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground text-right h-9">Registros</TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground text-center h-9">Detalles</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member, idx) => (
                <MemberRow key={member.userId} member={member} rank={idx + 1} />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}

function MemberRow({ member, rank }: { member: TeamMemberScore; rank: number }) {
  const trendConfig = TREND_ICONS[member.trend];
  const TrendIcon = trendConfig.Icon;

  return (
    <TableRow className="hover:bg-muted/30">
      <TableCell className="py-2.5">
        <div className="flex items-center gap-2.5">
          <span className="text-xs text-muted-foreground w-4 font-medium">
            {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}`}
          </span>
          <Avatar className="h-7 w-7">
            <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-medium">
              {member.initials}
            </AvatarFallback>
          </Avatar>
          <span className="text-sm font-medium">{member.name}</span>
        </div>
      </TableCell>
      <TableCell className="py-2.5 text-center">
        <div className="flex items-center gap-2 justify-center">
          <span className={`text-sm font-bold ${scoreColor(member.score)}`}>{member.score}</span>
          <Progress value={member.score} className="h-1.5 w-12" />
        </div>
      </TableCell>
      <TableCell className="py-2.5 text-center">
        <span className="text-sm">{member.levelEmoji} {member.level}</span>
      </TableCell>
      <TableCell className="py-2.5 text-center">
        <Tooltip>
          <TooltipTrigger>
            <TrendIcon className={`h-4 w-4 ${trendConfig.color} mx-auto`} />
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">{trendConfig.label}</TooltipContent>
        </Tooltip>
      </TableCell>
      <TableCell className="py-2.5 text-right text-sm">
        {member.logsCount}
        <span className="text-xs text-muted-foreground ml-1">({member.activeDays}d)</span>
      </TableCell>
      <TableCell className="py-2.5 text-center">
        <Tooltip>
          <TooltipTrigger>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 cursor-help">
              Ver
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="left" className="text-xs max-w-[200px]">
            <div className="space-y-1">
              <p>📊 Volumen: {member.volumeScore}/30</p>
              <p>📉 Reducción: {member.reductionScore}/30</p>
              <p>🎯 Diversidad: {member.diversityScore}/20 ({member.uniqueReasons} motivos)</p>
              <p>📅 Consistencia: {member.consistencyScore}/20</p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TableCell>
    </TableRow>
  );
}
