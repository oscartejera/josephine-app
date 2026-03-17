/**
 * Ask Josephine - AI Assistant for Sales
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Sparkles, Send } from 'lucide-react';
import { toast } from 'sonner';

interface AskJosephineProps {
  salesData: any;
}

export function AskJosephine({ salesData }: AskJosephineProps) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAsk = async () => {
    if (!question.trim()) return;

    setLoading(true);
    
    // Mock AI response based on data
    // In production, would call Claude API with context
    setTimeout(() => {
      const responses: Record<string, string> = {
        'why': `Based on your sales data (€${Math.round(salesData.totals?.sales || 36066).toLocaleString()}), the ${salesData.totals?.variance > 0 ? 'increase' : 'decrease'} is due to ${salesData.totals?.variance > 0 ? 'weekend traffic boost and strong dine-in performance' : 'mid-week lull and weather impact'}.`,
        'forecast': `Forecast for next 7 days shows trending up. Recommend +2 staff for weekend rush.`,
        'recommendation': `Top recommendation: Promote high-margin dishes during dinner service to improve GP%.`,
      };

      const matchedKey = Object.keys(responses).find(key => 
        question.toLowerCase().includes(key)
      );

      setAnswer(matchedKey ? responses[matchedKey] : 
        `Based on current sales of €${Math.round(salesData.totals?.sales || 36066).toLocaleString()} with ${salesData.totals?.variance > 0 ? '+' : ''}${(salesData.totals?.variance || 0.94).toFixed(2)}% variance vs forecast, trends are ${salesData.totals?.variance > 0 ? 'positive' : 'stable'}. Your top channel is Dine-in at ${Math.round(salesData.totals?.channels?.dineIn?.pct || 62)}%.`
      );
      
      setLoading(false);
    }, 1000);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Sparkles className="h-4 w-4 text-purple-500" />
          Ask Josephine
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px]" align="end">
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">Ask about your sales</h4>
            <p className="text-sm text-muted-foreground">
              Get AI insights based on your data
            </p>
          </div>

          <div className="flex gap-2">
            <Input
              placeholder="e.g., Why did sales drop?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
            />
            <Button size="icon" onClick={handleAsk} disabled={loading}>
              {loading ? (
                <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>

          {answer && (
            <div className="bg-purple-50 dark:bg-purple-950/20 rounded-lg p-4 text-sm">
              <div className="flex items-start gap-2">
                <Sparkles className="h-4 w-4 text-purple-500 mt-0.5 shrink-0" />
                <p>{answer}</p>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setQuestion('Why did sales change?');
                handleAsk();
              }}
            >
              Why did sales change?
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setQuestion('Give me recommendations');
                handleAsk();
              }}
            >
              Recommendations
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
