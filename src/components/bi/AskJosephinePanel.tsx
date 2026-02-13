import { useState, useCallback } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sparkles, Send, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BISalesData } from '@/hooks/useBISalesData';
import { useToast } from '@/hooks/use-toast';

interface AskJosephinePanelProps {
  open: boolean;
  onClose: () => void;
  data: BISalesData | undefined;
}

const INSIGHTS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sales_insights`;

async function streamInsights({
  salesData,
  question,
  onDelta,
  onDone,
  onError
}: {
  salesData: Record<string, unknown>;
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
      body: JSON.stringify({ salesData, question }),
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

export function AskJosephinePanel({ open, onClose, data }: AskJosephinePanelProps) {
  const [insight, setInsight] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [hasGenerated, setHasGenerated] = useState(false);
  const { toast } = useToast();

  const generateInsights = useCallback(async (customQuestion?: string) => {
    if (!data) return;

    setIsLoading(true);
    setError(null);
    setInsight("");
    setHasGenerated(true);

    const salesData = {
      salesToDate: data.kpis.salesToDate,
      salesToDateDelta: data.kpis.salesToDateDelta,
      avgCheckSize: data.kpis.avgCheckSize,
      avgCheckSizeDelta: data.kpis.avgCheckSizeDelta,
      dwellTime: data.kpis.dwellTime,
      channels: data.channels.map(c => ({
        channel: c.channel,
        sales: c.sales,
        salesDelta: c.salesDelta
      })),
      categories: data.categories.slice(0, 5),
      topProducts: data.products.slice(0, 5)
    };

    await streamInsights({
      salesData,
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
  }, [data, toast]);

  const handleSubmitQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (question.trim()) {
      generateInsights(question);
      setQuestion("");
    }
  };

  const suggestedQuestions = [
    '¿Por qué las ventas están por encima/debajo del forecast?',
    '¿Cuáles son los principales drivers de ventas?',
    '¿Qué productos están underperforming?',
    '¿Cómo podemos mejorar el ticket medio?'
  ];

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent className="w-[440px] sm:w-[540px] flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Ask Josephine
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto mt-4 space-y-4">
          {/* Generate button if not generated yet */}
          {!hasGenerated && !isLoading && (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                Obtén insights automáticos sobre el rendimiento de ventas
              </p>
              <Button 
                onClick={() => generateInsights()} 
                className="bg-gradient-primary text-white gap-2"
                disabled={!data}
              >
                <Sparkles className="h-4 w-4" />
                Generar Insights
              </Button>
            </div>
          )}

          {/* Loading state */}
          {isLoading && !insight && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="ml-2 text-muted-foreground">Analizando datos...</span>
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
            placeholder="Pregunta algo sobre tus ventas..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            disabled={isLoading || !data}
          />
          <Button 
            type="submit" 
            size="icon"
            disabled={isLoading || !question.trim() || !data}
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
