/**
 * NotificationCenter — bell icon with dropdown of in-app notifications.
 * Reads from `notifications` table in Supabase.
 * Shows unread count badge, and marks as read when opened.
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import {
    Bell,
    Check,
    CheckCheck,
    MessageSquare,
    Calendar,
    DollarSign,
    Megaphone,
    Clock,
    AlertTriangle,
    Info,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';

interface Notification {
    id: string;
    type: string;
    title: string;
    body: string | null;
    link: string | null;
    read: boolean;
    created_at: string;
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
    announcement: <Megaphone className="h-4 w-4 text-blue-500" />,
    schedule: <Calendar className="h-4 w-4 text-violet-500" />,
    timeoff: <Clock className="h-4 w-4 text-amber-500" />,
    sales: <DollarSign className="h-4 w-4 text-emerald-500" />,
    alert: <AlertTriangle className="h-4 w-4 text-red-500" />,
    info: <Info className="h-4 w-4 text-muted-foreground" />,
    review: <MessageSquare className="h-4 w-4 text-orange-500" />,
};

export function NotificationCenter() {
  const { t } = useTranslation();
    const navigate = useNavigate();
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [open, setOpen] = useState(false);

    // Fetch notifications
    const { data: notifications = [] } = useQuery<Notification[]>({
        queryKey: ['notifications', user?.id],
        queryFn: async () => {
            if (!user?.id) return [];
            const { data, error } = await (supabase as any)
                .from('notifications')
                .select('id, type, title, body, link, read, created_at')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(20);

            if (error) {
                console.error('[NotificationCenter] Error:', error);
                return [];
            }
            return data || [];
        },
        enabled: !!user?.id,
        refetchInterval: 30_000, // Poll every 30s
        staleTime: 10_000,
    });

    const unreadCount = notifications.filter(n => !n.read).length;

    // Mark single notification as read
    const markRead = useMutation({
        mutationFn: async (id: string) => {
            await (supabase as any)
                .from('notifications')
                .update({ read: true })
                .eq('id', id);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
        },
    });

    // Mark all as read
    const markAllRead = useMutation({
        mutationFn: async () => {
            if (!user?.id) return;
            await (supabase as any)
                .from('notifications')
                .update({ read: true })
                .eq('user_id', user.id)
                .eq('read', false);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
        },
    });

    const handleClick = useCallback((notification: Notification) => {
        if (!notification.read) {
            markRead.mutate(notification.id);
        }
        if (notification.link) {
            navigate(notification.link);
            setOpen(false);
        }
    }, [markRead, navigate]);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end" sideOffset={8}>
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b">
                    <h3 className="font-semibold text-sm">Notificaciones</h3>
                    {unreadCount > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs gap-1"
                            onClick={() => markAllRead.mutate()}
                        >
                            <CheckCheck className="h-3 w-3" />
                            Marcar todas
                        </Button>
                    )}
                </div>

                {/* Notification list */}
                <div className="max-h-[400px] overflow-y-auto">
                    {notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                            <Bell className="h-8 w-8 mb-2 opacity-30" />
                            <p className="text-sm">Sin notificaciones</p>
                        </div>
                    ) : (
                        notifications.map(notification => (
                            <button
                                key={notification.id}
                                className={`w-full text-left px-4 py-3 border-b last:border-b-0 transition-colors hover:bg-muted/50 ${!notification.read ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''
                                    }`}
                                onClick={() => handleClick(notification)}
                            >
                                <div className="flex gap-3">
                                    {/* Icon */}
                                    <div className="shrink-0 mt-0.5">
                                        {TYPE_ICONS[notification.type] || TYPE_ICONS.info}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2">
                                            <p className={`text-sm leading-tight ${!notification.read ? 'font-semibold' : ''}`}>
                                                {notification.title}
                                            </p>
                                            {!notification.read && (
                                                <span className="shrink-0 h-2 w-2 rounded-full bg-blue-500 mt-1.5" />
                                            )}
                                        </div>
                                        {notification.body && (
                                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                                {notification.body}
                                            </p>
                                        )}
                                        <p className="text-[10px] text-muted-foreground mt-1">
                                            {formatDistanceToNow(new Date(notification.created_at), {
                                                addSuffix: true,
                                                locale: es,
                                            })}
                                        </p>
                                    </div>
                                </div>
                            </button>
                        ))
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}
