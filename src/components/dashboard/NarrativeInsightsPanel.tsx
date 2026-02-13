import { useEffect, useRef } from 'react';
import { Sparkles, RefreshCw, Loader2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAINarratives } from '@/hooks/useAINarratives';
import type { DashboardMetricsForAI } from '@/hooks/useAINarratives';

interface NarrativeInsightsPanelProps {
  metrics: DashboardMetricsForAI | null;
  className?: string;
}

function renderMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n•/g, '<br/>•')
    .replace(/\n- /g, '<br/>• ')
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');
}

export function NarrativeInsightsPanel({ metrics, className }: NarrativeInsightsPanelProps) {
  const { narrative, isLoading, error, generate } = useAINarratives();
  const hasGenerated = useRef(false);

  // Auto-generate on mount when metrics are available
  useEffect(() => {
    if (metrics && !hasGenerated.current && metrics.sales > 0) {
      hasGenerated.current = true;
      generate(metrics);
    }
  }, [metrics, generate]);

  const handleRefresh = () => {
    if (metrics) generate(metrics, true);
  };

  return (
    <Card className={cn('relative overflow-hidden', className)}>
      {/* Gradient accent */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500" />

      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-500" />
            Josephine dice...
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleRefresh}
            disabled={isLoading || !metrics}
          >
            <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {/* Loading - initial */}
        {isLoading && !narrative && (
          <div className="flex items-center gap-3 py-6">
            <Loader2 className="h-5 w-5 animate-spin text-violet-500" />
            <span className="text-sm text-muted-foreground">Analizando tus operaciones...</span>
          </div>
        )}

        {/* Error */}
        {error && !narrative && (
          <div className="flex items-start gap-3 p-3 bg-destructive/10 rounded-lg">
            <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <div>
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="link" size="sm" className="px-0 h-auto text-xs" onClick={handleRefresh}>
                Reintentar
              </Button>
            </div>
          </div>
        )}

        {/* Narrative content */}
        {narrative && (
          <div className="relative">
            <div
              className="text-sm leading-relaxed text-foreground/90"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(narrative) }}
            />
            {isLoading && (
              <span className="inline-block w-1.5 h-4 bg-violet-500 animate-pulse ml-0.5 align-middle" />
            )}
          </div>
        )}

        {/* Empty state - no metrics yet */}
        {!metrics && !isLoading && !error && (
          <p className="text-sm text-muted-foreground py-4">
            Cargando datos del dashboard...
          </p>
        )}
      </CardContent>
    </Card>
  );
}
