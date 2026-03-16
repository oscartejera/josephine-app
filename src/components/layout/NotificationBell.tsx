import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '@/hooks/useNotifications';
import { Button } from '@/components/ui/button';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bell, Check, CheckCheck, Info, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Notification } from '@/hooks/useNotifications';
import { useTranslation } from 'react-i18next';

const typeIcons: Record<string, typeof Info> = {
    info: Info,
    success: CheckCircle,
    warning: AlertTriangle,
    error: XCircle,
};

const typeColors: Record<string, string> = {
    info: 'text-blue-500 bg-blue-50 dark:bg-blue-950/40',
    success: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40',
    warning: 'text-amber-500 bg-amber-50 dark:bg-amber-950/40',
    error: 'text-red-500 bg-red-50 dark:bg-red-950/40',
};

function formatTimeAgo(dateStr: string): string {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffH = Math.floor(diffMin / 60);
    const diffD = Math.floor(diffH / 24);

    if (diffMin < 1) return 'ahora';
    if (diffMin < 60) return `${diffMin}m`;
    if (diffH < 24) return `${diffH}h`;
    if (diffD < 7) return `${diffD}d`;
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

export function NotificationBell({
  const { t } = useTranslation(); collapsed }: { collapsed?: boolean }) {
    const navigate = useNavigate();
    const { notifications, unreadCount, markAsRead, markAllRead } = useNotifications();
    const [open, setOpen] = useState(false);

    const handleClick = (notif: Notification) => {
        if (!notif.read) markAsRead(notif.id);
        if (notif.link) {
            navigate(notif.link);
            setOpen(false);
        }
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="relative h-9 w-9"
                    aria-label="Notificaciones"
                >
                    <Bell className="h-4 w-4" />
                    {unreadCount > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center animate-in zoom-in-50">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent
                className="w-80 p-0"
                align="end"
                side={collapsed ? 'right' : 'bottom'}
                sideOffset={8}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b">
                    <h4 className="font-semibold text-sm">Notificaciones</h4>
                    {unreadCount > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => markAllRead()}
                        >
                            <CheckCheck className="h-3 w-3 mr-1" />
                            Leer todo
                        </Button>
                    )}
                </div>

                {/* Notification List */}
                <ScrollArea className="max-h-80">
                    {notifications.length === 0 ? (
                        <div className="p-6 text-center text-sm text-muted-foreground">
                            No hay notificaciones
                        </div>
                    ) : (
                        <div className="divide-y">
                            {notifications.map(notif => {
                                const Icon = typeIcons[notif.type] || Info;
                                return (
                                    <button
                                        key={notif.id}
                                        onClick={() => handleClick(notif)}
                                        className={cn(
                                            "w-full text-left px-4 py-3 flex gap-3 hover:bg-muted/50 transition-colors",
                                            !notif.read && "bg-primary/5"
                                        )}
                                    >
                                        <div className={cn(
                                            "h-8 w-8 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                                            typeColors[notif.type]
                                        )}>
                                            <Icon className="h-4 w-4" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2">
                                                <p className={cn(
                                                    "text-sm leading-tight",
                                                    !notif.read ? "font-medium" : "text-muted-foreground"
                                                )}>
                                                    {notif.title}
                                                </p>
                                                <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">
                                                    {formatTimeAgo(notif.created_at)}
                                                </span>
                                            </div>
                                            {notif.message && (
                                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                                    {notif.message}
                                                </p>
                                            )}
                                        </div>
                                        {!notif.read && (
                                            <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-2" />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </ScrollArea>
            </PopoverContent>
        </Popover>
    );
}
