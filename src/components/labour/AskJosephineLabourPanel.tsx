import { useState, useCallback } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sparkles, Send, Loader2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { LabourKpis, LabourLocationRow } from '@/hooks/useLabourData';

interface AskJosephineLabourPanelProps {
  open: boolean;
  onClose: () => void;
  kpis: LabourKpis | null;
  locations: LabourLocationRow[];
}

const INSIGHTS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/labour_insights`;

async function streamInsights({
  labourData,
  question,
  onDelta,
  onDone,
  onError
}: {
  labourData: any;
  question?: string;
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (error: string) => void;
}) {
  try {
    const resp = await fetch(INSIGHTS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ labourData, question }),
    });

    if (!resp.ok) {
      const errorData = await resp.json().catch(() => ({ error: 'Unknown error' }));
      onError(errorData.error || `Error ${resp.status}`);
      return;
    }

    if (!resp.body) {
      onError("No response body");
      return;
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
        let line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);

        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (line.startsWith(":") || line.trim() === "") continue;
        if (!line.startsWith("data: ")) continue;

        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") break;

        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) onDelta(content);
        } catch {
          buffer = line + "\n" + buffer;
          break;
        }
      }
    }

    // Final flush
    if (buffer.trim()) {
      for (let raw of buffer.split("\n")) {
        if (!raw) continue;
        if (raw.endsWith("\r")) raw = raw.slice(0, -1);
        if (!raw.startsWith("data: ")) continue;
        const jsonStr = raw.slice(6).trim();
        if (jsonStr === "[DONE]") continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) onDelta(content);
        } catch { /* ignore */ }
      }
    }

    onDone();
  } catch (e) {
    onError(e instanceof Error ? e.message : "Connection failed");
  }
}

export function AskJosephineLabourPanel({ open, onClose, kpis, locations }: AskJosephineLabourPanelProps) {
  const [insight, setInsight] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [hasGenerated, setHasGenerated] = useState(false);
  const { toast } = useToast();

  const generateInsights = useCallback(async (customQuestion?: string) => {
    if (!kpis) return;

    setIsLoading(true);
    setError(null);
    setInsight("");
    setHasGenerated(true);

    const labourData = {
      actualSales: kpis.actual_sales,
      forecastSales: kpis.forecast_sales,
      salesDelta: (kpis.sales_delta_pct ?? 0) * 100,
      actualCOL: (kpis.actual_col_pct ?? 0) * 100,
      plannedCOL: (kpis.planned_col_pct ?? 0) * 100,
      colDelta: (kpis.col_delta_pct ?? 0) * 100,
      actualSPLH: kpis.actual_splh ?? 0,
      plannedSPLH: kpis.planned_splh ?? 0,
      splhDelta: (kpis.splh_delta_pct ?? 0) * 100,
      actualOPLH: kpis.actual_oplh ?? 0,
      plannedOPLH: kpis.planned_oplh ?? 0,
      oplhDelta: (kpis.oplh_delta_pct ?? 0) * 100,
      actualHours: kpis.actual_labor_hours,
      plannedHours: kpis.planned_labor_hours,
      hoursDelta: (kpis.hours_delta_pct ?? 0) * 100,
      actualLaborCost: kpis.actual_labor_cost,
      plannedLaborCost: kpis.planned_labor_cost,
      locations: locations.map(l => ({
        name: l.location_name,
        salesActual: l.sales_actual,
        salesProjected: l.sales_projected,
        colActual: (l.col_actual_pct ?? 0) * 100,
        colProjected: (l.col_projected_pct ?? 0) * 100,
        splhActual: l.splh_actual ?? 0,
        splhProjected: l.splh_projected ?? 0,
      }))
    };

    await streamInsights({
      labourData,
      question: customQuestion,
      onDelta: (text) => setInsight(prev => prev + text),
      onDone: () => setIsLoading(false),
      onError: (err) => {
        setError(err);
        setIsLoading(false);
        toast({
          title: "Error",
          description: err,
          variant: "destructive"
        });
      }
    });
  }, [kpis, locations, toast]);

  const handleSubmitQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (question.trim()) {
      generateInsights(question);
      setQuestion("");
    }
  };

  const suggestedQuestions = [
    '¿Por qué el COL% está por encima/debajo del objetivo?',
    '¿Qué locations necesitan ajustes de staffing?',
    '¿Cómo puedo mejorar el SPLH en las peores locations?',
    '¿Cuánto podría ahorrar optimizando turnos?'
  ];

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent className="w-[440px] sm:w-[540px] flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Ask Josephine - Labour
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto mt-4 space-y-4">
          {/* Generate button if not generated yet */}
          {!hasGenerated && !isLoading && (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                Obtén insights sobre COL%, SPLH y recomendaciones de staffing
              </p>
              <Button 
                onClick={() => generateInsights()} 
                className="bg-gradient-primary text-white gap-2"
                disabled={!kpis}
              >
                <Sparkles className="h-4 w-4" />
                Analizar Labour
              </Button>
            </div>
          )}

          {/* Loading state */}
          {isLoading && !insight && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="ml-2 text-muted-foreground">Analizando métricas laborales...</span>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="flex items-center gap-2 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
              <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* AI Response */}
          {insight && (
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <div 
                className="bg-muted/50 rounded-xl p-4 whitespace-pre-wrap"
                dangerouslySetInnerHTML={{ 
                  __html: insight
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                    .replace(/\n/g, '<br/>')
                    .replace(/#{1,3}\s(.*?)(<br\/>|$)/g, '<h4 class="font-semibold mt-3 mb-1">$1</h4>')
                }}
              />
              {isLoading && (
                <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-1" />
              )}
            </div>
          )}

          {/* Suggested Questions */}
          {hasGenerated && !isLoading && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium">Preguntas sugeridas:</p>
              <div className="space-y-1">
                {suggestedQuestions.map((q, i) => (
                  <Button
                    key={i}
                    variant="outline"
                    size="sm"
                    className="w-full justify-start text-left h-auto py-2 text-sm"
                    onClick={() => {
                      setQuestion(q);
                      generateInsights(q);
                    }}
                  >
                    {q}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Question input */}
        <form onSubmit={handleSubmitQuestion} className="flex gap-2 mt-4 pt-4 border-t">
          <Input
            placeholder="Pregunta sobre COL, SPLH, staffing..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            disabled={isLoading || !kpis}
          />
          <Button 
            type="submit" 
            size="icon"
            disabled={isLoading || !question.trim() || !kpis}
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
