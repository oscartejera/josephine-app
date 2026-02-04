import { useState, useRef, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sparkles, Send, Loader2, User, Bot, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface SalesData {
  salesToDate: number;
  salesToDateDelta: number;
  avgCheckSize: number;
  avgCheckSizeDelta: number;
  dwellTime: number | null;
  channels: {
    channel: string;
    sales: number;
    salesDelta: number;
  }[];
  categories: {
    category: string;
    amount: number;
    ratio: number;
  }[];
  topProducts: {
    name: string;
    value: number;
    percentage: number;
  }[];
}

interface AskJosephineSalesDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  salesData: SalesData;
}

const SALES_INSIGHTS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sales_insights`;

const suggestedQuestions = [
  "¿Por qué bajaron las ventas el miércoles?",
  "¿Qué canal está teniendo mejor desempeño?",
  "Dame recomendaciones para aumentar ventas",
  "¿Cómo está el ticket promedio comparado con forecast?"
];

export function AskJosephineSalesDrawer({
  open,
  onOpenChange,
  salesData
}: AskJosephineSalesDrawerProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Initial analysis when drawer opens with no messages
  useEffect(() => {
    if (open && messages.length === 0) {
      sendInitialAnalysis();
    }
  }, [open]);

  const sendInitialAnalysis = async () => {
    const initialQuestion = "Analiza mi situación actual de ventas y dame un resumen ejecutivo con los puntos clave y recomendaciones.";
    await streamChat(initialQuestion, true);
  };

  const streamChat = async (question: string, isInitial = false) => {
    setIsStreaming(true);
    setError(null);

    // Add user message to UI (unless it's the initial auto-analysis)
    if (!isInitial) {
      const userMessage: Message = { role: 'user', content: question };
      setMessages(prev => [...prev, userMessage]);
    }

    let assistantContent = '';

    try {
      const response = await fetch(SALES_INSIGHTS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          salesData,
          question
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please wait a moment and try again.');
        }
        if (response.status === 402) {
          throw new Error('AI credits exhausted. Please add credits to continue.');
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to get AI response');
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      // Add empty assistant message that we'll update
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process line-by-line
        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantContent += content;
              setMessages(prev => {
                const updated = [...prev];
                if (updated[updated.length - 1]?.role === 'assistant') {
                  updated[updated.length - 1] = { role: 'assistant', content: assistantContent };
                }
                return updated;
              });
            }
          } catch {
            // Incomplete JSON, put it back
            buffer = line + '\n' + buffer;
            break;
          }
        }
      }

      // Final flush
      if (buffer.trim()) {
        for (let raw of buffer.split('\n')) {
          if (!raw) continue;
          if (raw.endsWith('\r')) raw = raw.slice(0, -1);
          if (raw.startsWith(':') || raw.trim() === '') continue;
          if (!raw.startsWith('data: ')) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantContent += content;
              setMessages(prev => {
                const updated = [...prev];
                if (updated[updated.length - 1]?.role === 'assistant') {
                  updated[updated.length - 1] = { role: 'assistant', content: assistantContent };
                }
                return updated;
              });
            }
          } catch { /* ignore */ }
        }
      }
    } catch (err) {
      console.error('Stream error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: errorMessage
      });
      // Remove the empty assistant message if there was an error
      if (assistantContent === '') {
        setMessages(prev => prev.filter(m => m.content !== ''));
      }
    } finally {
      setIsStreaming(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;

    const question = input.trim();
    setInput('');
    
    await streamChat(question);
  };

  const handleSuggestedQuestion = async (question: string) => {
    if (isStreaming) return;
    await streamChat(question);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatContent = (content: string) => {
    // Simple markdown-like formatting
    return content
      .split('\n')
      .map((line, i) => {
        // Headers
        if (line.startsWith('### ')) {
          return <h4 key={i} className="font-semibold text-sm mt-3 mb-1">{line.slice(4)}</h4>;
        }
        if (line.startsWith('## ')) {
          return <h3 key={i} className="font-semibold text-base mt-4 mb-2">{line.slice(3)}</h3>;
        }
        if (line.startsWith('# ')) {
          return <h2 key={i} className="font-bold text-lg mt-4 mb-2">{line.slice(2)}</h2>;
        }
        // Bold text
        const boldFormatted = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        // List items
        if (line.startsWith('- ') || line.startsWith('* ')) {
          return (
            <li 
              key={i} 
              className="ml-4 list-disc"
              dangerouslySetInnerHTML={{ __html: boldFormatted.slice(2) }}
            />
          );
        }
        if (/^\d+\.\s/.test(line)) {
          return (
            <li 
              key={i} 
              className="ml-4 list-decimal"
              dangerouslySetInnerHTML={{ __html: boldFormatted.replace(/^\d+\.\s/, '') }}
            />
          );
        }
        // Regular paragraph
        if (line.trim()) {
          return (
            <p 
              key={i} 
              className="mb-2"
              dangerouslySetInnerHTML={{ __html: boldFormatted }}
            />
          );
        }
        return <br key={i} />;
      });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[450px] sm:w-[540px] flex flex-col p-0">
        <SheetHeader className="px-6 py-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Ask Josephine
          </SheetTitle>
        </SheetHeader>

        {/* Messages area */}
        <ScrollArea className="flex-1 px-4" ref={scrollRef}>
          <div className="py-4 space-y-4">
            {messages.length === 0 && !isStreaming && (
              <div className="text-center py-8">
                <Sparkles className="h-12 w-12 mx-auto mb-4 text-primary/30" />
                <p className="text-muted-foreground mb-6">
                  Hola! Soy Josephine, tu asistente de ventas. 
                  Puedo analizar tus datos de ventas y ayudarte a entender el rendimiento de tu negocio.
                </p>
                <div className="space-y-2">
                  {suggestedQuestions.map((q, i) => (
                    <Button
                      key={i}
                      variant="outline"
                      size="sm"
                      className="w-full text-left justify-start h-auto py-2 px-3 text-sm"
                      onClick={() => handleSuggestedQuestion(q)}
                    >
                      {q}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  "flex gap-3",
                  msg.role === 'user' ? "justify-end" : "justify-start"
                )}
              >
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                )}
                <div
                  className={cn(
                    "rounded-lg px-4 py-3 max-w-[85%]",
                    msg.role === 'user'
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  )}
                >
                  {msg.role === 'assistant' ? (
                    <div className="text-sm prose prose-sm dark:prose-invert max-w-none">
                      {formatContent(msg.content)}
                      {isStreaming && i === messages.length - 1 && (
                        <span className="inline-block w-1.5 h-4 bg-primary/50 animate-pulse ml-0.5" />
                      )}
                    </div>
                  ) : (
                    <p className="text-sm">{msg.content}</p>
                  )}
                </div>
                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                    <User className="h-4 w-4 text-primary-foreground" />
                  </div>
                )}
              </div>
            ))}

            {isStreaming && messages.length === 0 && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <div className="bg-muted rounded-lg px-4 py-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analizando tus ventas...
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-4 py-3">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input area */}
        <div className="border-t p-4">
          {messages.length > 0 && !isStreaming && (
            <div className="flex flex-wrap gap-2 mb-3">
              {suggestedQuestions.slice(0, 2).map((q, i) => (
                <Button
                  key={i}
                  variant="outline"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => handleSuggestedQuestion(q)}
                >
                  {q}
                </Button>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribe tu pregunta..."
              className="min-h-[44px] max-h-32 resize-none"
              disabled={isStreaming}
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isStreaming}
              size="icon"
              className="h-11 w-11 flex-shrink-0"
            >
              {isStreaming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
