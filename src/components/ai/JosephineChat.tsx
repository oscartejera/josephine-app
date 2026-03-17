/**
 * JosephineChat — AI Operations Assistant
 * Uses existing OpenAI GPT-4o edge functions to answer ops queries
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { Bot, Send, User, Loader2, Sparkles, TrendingUp, Users, Package, X, Maximize2, Minimize2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    createdAt: Date;
}

const QUICK_PROMPTS = [
    { label: t('ai.ventasHoy'), prompt: '¿Cómo van las ventas de hoy comparadas con la semana pasada?', icon: TrendingUp },
    { label: '👥 Labour cost', prompt: '¿Cuál es el coste de personal actual vs el presupuesto? ¿Estamos dentro del objetivo?', icon: Users },
    { label: '📦 Stock bajo', prompt: t('ai.suggestedIngredients'), icon: Package },
    { label: '✨ Briefing', prompt: 'Dame un resumen ejecutivo del día de hoy: ventas, personal, incidencias, y predicción para mañana.', icon: Sparkles },
];

export function JosephineChat({
  isExpanded = false, onToggleExpand, onClose }: {
    isExpanded?: boolean;
    onToggleExpand?: () => void;
    onClose?: () => void;
}) {
    const { t } = useTranslation();
    const { group, selectedLocationId } = useApp();
    const { user } = useAuth();
    const [messages, setMessages] = useState<Message[]>([{
        id: 'welcome',
        role: 'assistant',
        content: '¡Hola! 👋 Soy **Josephine**, tu asistente de operaciones. Pregúntame sobre ventas, personal, inventario, o pídeme un resumen del día.',
        createdAt: new Date(),
    }]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, [messages]);

    const sendMessage = useCallback(async (text: string) => {
        if (!text.trim() || loading) return;

        const userMsg: Message = {
            id: crypto.randomUUID(),
            role: 'user',
            content: text.trim(),
            createdAt: new Date(),
        };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setLoading(true);

        try {
            // Call the existing dashboard_narratives edge function
            // which already uses GPT-4o with full business context
            const { data: session } = await supabase.auth.getSession();
            const token = session?.session?.access_token;

            // Use sales_insights for data-aware responses, fallback to dashboard_narratives
            const res = await supabase.functions.invoke('sales_insights', {
                body: {
                    question: text.trim(),
                    org_id: group?.id,
                    location_id: selectedLocationId || undefined,
                },
                headers: token ? { Authorization: `Bearer ${token}` } : {},
            });

            const reply = res.data?.insight || res.data?.narrative || res.data?.text
                || t('ai.errorRetry');

            const assistantMsg: Message = {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: reply,
                createdAt: new Date(),
            };
            setMessages(prev => [...prev, assistantMsg]);

            // Save conversation to DB
            if (user?.id && group?.id) {
                try {
                    const { data: conv } = await supabase
                        .from('ai_conversations')
                        .insert({
                            org_id: group.id,
                            user_id: user.id,
                            location_id: selectedLocationId || null,
                            title: text.trim().substring(0, 60),
                        })
                        .select('id')
                        .single();

                    if (conv) {
                        await supabase.from('ai_messages').insert([
                            { conversation_id: conv.id, role: 'user', content: text.trim() },
                            { conversation_id: conv.id, role: 'assistant', content: reply },
                        ]);
                    }
                } catch { /* non-critical */ }
            }
        } catch (err: any) {
            setMessages(prev => [...prev, {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: `⚠️ Error: ${err.message || 'No se pudo conectar con el asistente AI. Verifica que OPENAI_API_KEY esté configurado en Supabase.'}`,
                createdAt: new Date(),
            }]);
        } finally {
            setLoading(false);
            inputRef.current?.focus();
        }
    }, [loading, group?.id, selectedLocationId, user?.id]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        sendMessage(input);
    };

    return (
        <Card className={`flex flex-col ${isExpanded ? 'fixed inset-4 z-50 shadow-2xl' : 'h-[500px]'}`}>
            {/* Header */}
            <CardHeader className="py-3 px-4 border-b flex-shrink-0">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                            <Bot className="h-4 w-4 text-white" />
                        </div>
                        <div>
                            <CardTitle className="text-sm">Josephine AI</CardTitle>
                            <p className="text-[10px] text-muted-foreground">Asistente de operaciones</p>
                        </div>
                    </div>
                    <div className="flex gap-1">
                        {onToggleExpand && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onToggleExpand}>
                                {isExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                            </Button>
                        )}
                        {onClose && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
                                <X className="h-3.5 w-3.5" />
                            </Button>
                        )}
                    </div>
                </div>
            </CardHeader>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4" ref={scrollRef}>
                <div className="space-y-4">
                    {messages.map(msg => (
                        <div
                            key={msg.id}
                            className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                        >
                            <Avatar className="h-7 w-7 flex-shrink-0">
                                <AvatarFallback className={msg.role === 'assistant' ? 'bg-violet-100 text-violet-700' : 'bg-primary/10'}>
                                    {msg.role === 'assistant' ? <Bot className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
                                </AvatarFallback>
                            </Avatar>
                            <div className={`rounded-xl px-3 py-2 text-sm max-w-[80%] ${msg.role === 'user'
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted'
                                }`}>
                                <p className="whitespace-pre-wrap">{msg.content}</p>
                            </div>
                        </div>
                    ))}
                    {loading && (
                        <div className="flex gap-2">
                            <Avatar className="h-7 w-7">
                                <AvatarFallback className="bg-violet-100 text-violet-700">
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                </AvatarFallback>
                            </Avatar>
                            <div className="bg-muted rounded-xl px-3 py-2 text-sm">
                                <span className="text-muted-foreground">Pensando...</span>
                            </div>
                        </div>
                    )}
                </div>
            </ScrollArea>

            {/* Quick prompts */}
            {messages.length <= 2 && (
                <div className="px-4 pb-2 flex gap-2 flex-wrap">
                    {QUICK_PROMPTS.map(qp => (
                        <Button
                            key={qp.label}
                            variant="outline"
                            size="sm"
                            className="text-xs h-7"
                            onClick={() => sendMessage(qp.prompt)}
                            disabled={loading}
                        >
                            {qp.label}
                        </Button>
                    ))}
                </div>
            )}

            {/* Input */}
            <form onSubmit={handleSubmit} className="p-3 border-t flex gap-2 flex-shrink-0">
                <Input
                    ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder="Pregunta algo sobre el negocio..."
                    disabled={loading}
                    className="text-sm"
                />
                <Button type="submit" size="icon" disabled={loading || !input.trim()}>
                    <Send className="h-4 w-4" />
                </Button>
            </form>
        </Card>
    );
}
