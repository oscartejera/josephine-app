/**
 * ManagerLogbook — Daily operations log component
 * Embedded as a tab in the Workforce Team page
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { format, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { BookOpen, Plus, AlertTriangle, CheckCircle2, Clock, ShieldAlert, Users, Package, Wrench, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

interface LogEntry {
    id: string;
    location_id: string;
    author_id: string;
    shift_date: string;
    category: string;
    content: string;
    severity: string;
    resolved: boolean;
    created_at: string;
}

const CATEGORY_KEYS = ['general', 'incident', 'staffing', 'inventory', 'maintenance', 'customer'] as const;
const CATEGORY_ICONS: Record<string, typeof MessageSquare> = {
    general: MessageSquare, incident: ShieldAlert, staffing: Users,
    inventory: Package, maintenance: Wrench, customer: MessageSquare,
};
const CATEGORY_COLORS: Record<string, string> = {
    general: 'bg-gray-500', incident: 'bg-red-500', staffing: 'bg-blue-500',
    inventory: 'bg-amber-500', maintenance: 'bg-purple-500', customer: 'bg-green-500',
};

const SEVERITY_KEYS = ['info', 'warning', 'critical'] as const;
const SEVERITY_COLORS: Record<string, string> = {
    info: 'text-blue-600 bg-blue-50 border-blue-200',
    warning: 'text-amber-600 bg-amber-50 border-amber-200',
    critical: 'text-red-600 bg-red-50 border-red-200',
};

export function ManagerLogbook({ locationId }: { locationId: string | null }) {
  const { t } = useTranslation();
    const { group } = useApp();
    const { user } = useAuth();
    const [entries, setEntries] = useState<LogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [content, setContent] = useState('');
    const [category, setCategory] = useState('general');
    const [severity, setSeverity] = useState('info');
    const [submitting, setSubmitting] = useState(false);

    const loadEntries = useCallback(async () => {
        if (!group?.id) return;
        setLoading(true);
        try {
            let query = supabase
                .from('manager_logbook')
                .select('*')
                .eq('org_id', group.id)
                .gte('shift_date', format(subDays(new Date(), 7), 'yyyy-MM-dd'))
                .order('created_at', { ascending: false })
                .limit(50);

            if (locationId) {
                query = query.eq('location_id', locationId);
            }

            const { data } = await query;
            setEntries(data || []);
        } catch (err) {
            console.error('Logbook load error:', err);
        } finally {
            setLoading(false);
        }
    }, [group?.id, locationId]);

    useEffect(() => { loadEntries(); }, [loadEntries]);

    const handleSubmit = async () => {
        if (!content.trim() || !group?.id || !locationId || !user?.id) return;
        setSubmitting(true);
        try {
            const { error } = await supabase.from('manager_logbook').insert({
                org_id: group.id,
                location_id: locationId,
                author_id: user.id,
                shift_date: format(new Date(), 'yyyy-MM-dd'),
                category,
                content: content.trim(),
                severity,
            });
            if (error) throw error;
            toast.success(t('logbook.entryAdded'));
            setContent('');
            setShowForm(false);
            loadEntries();
        } catch (err: any) {
            toast.error(t('logbook.saveError'), { description: err.message });
        } finally {
            setSubmitting(false);
        }
    };

    const toggleResolved = async (id: string, current: boolean) => {
        await supabase.from('manager_logbook').update({
            resolved: !current,
            resolved_at: !current ? new Date().toISOString() : null,
        }).eq('id', id);
        loadEntries();
    };

    const unresolvedCount = entries.filter(e => !e.resolved && e.severity !== 'info').length;

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-semibold">{t('logbook.title')}</h3>
                    {unresolvedCount > 0 && (
                        <Badge variant="destructive" className="rounded-full">
                            {unresolvedCount} {t('logbook.pending', { count: unresolvedCount })}
                        </Badge>
                    )}
                </div>
                <Button size="sm" onClick={() => setShowForm(!showForm)}>
                    <Plus className="h-4 w-4 mr-1" />
                    {t('logbook.newEntry')}
                </Button>
            </div>

            {/* Form */}
            {showForm && (
                <Card className="border-primary/20">
                    <CardContent className="pt-4 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <Select value={category} onValueChange={setCategory}>
                                <SelectTrigger>
                                    <SelectValue placeholder={t('logbook.category')} />
                                </SelectTrigger>
                                <SelectContent>
                                    {CATEGORY_KEYS.map(c => (
                                        <SelectItem key={c} value={c}>{t(`logbook.categories.${c}`)}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select value={severity} onValueChange={setSeverity}>
                                <SelectTrigger>
                                    <SelectValue placeholder={t('logbook.severity')} />
                                </SelectTrigger>
                                <SelectContent>
                                    {SEVERITY_KEYS.map(s => (
                                        <SelectItem key={s} value={s}>{t(`logbook.severities.${s}`)}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <Textarea
                            placeholder={t('logbook.placeholder')}
                            value={content}
                            onChange={e => setContent(e.target.value)}
                            rows={3}
                        />
                        <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>{t("common.cancel")}</Button>
                            <Button size="sm" onClick={handleSubmit} disabled={submitting || !content.trim()}>
                                {submitting ? t('common.saving') : t('common.save')}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Entries Timeline */}
            {loading ? (
                <div className="text-center py-8 text-muted-foreground">{t('logbook.loading')}</div>
            ) : entries.length === 0 ? (
                <Card>
                    <CardContent className="py-8 text-center">
                        <BookOpen className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
                        <p className="text-muted-foreground">{t('logbook.noEntries')}</p>
                        <p className="text-sm text-muted-foreground/60">{t('logbook.noEntriesHint')}</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-3">
                    {entries.map(entry => {
                        const catIcon = CATEGORY_ICONS[entry.category] || MessageSquare;
                        const catColor = CATEGORY_COLORS[entry.category] || 'bg-gray-500';
                        const sevColor = SEVERITY_COLORS[entry.severity] || '';
                        const CatIcon = catIcon;
                        return (
                            <Card key={entry.id} className={`transition-all ${entry.resolved ? 'opacity-60' : ''}`}>
                                <CardContent className="py-3 px-4">
                                    <div className="flex items-start gap-3">
                                        <div className={`rounded-full p-1.5 ${catColor} text-white mt-0.5`}>
                                            <CatIcon className="h-3.5 w-3.5" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <Badge variant="outline" className={sevColor}>{t(`logbook.severities.${entry.severity}`)}</Badge>
                                                <span className="text-xs text-muted-foreground">
                                                    {format(new Date(entry.created_at), "d MMM HH:mm", { locale: es })}
                                                </span>
                                                {entry.resolved && (
                                                    <Badge variant="outline" className="text-green-600 bg-green-50">
                                                        <CheckCircle2 className="h-3 w-3 mr-1" />{t('logbook.resolved')}
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="text-sm">{entry.content}</p>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 shrink-0"
                                            onClick={() => toggleResolved(entry.id, entry.resolved)}
                                            title={entry.resolved ? t('logbook.markPending') : t('logbook.markResolved')}
                                        >
                                            {entry.resolved ? <Clock className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
