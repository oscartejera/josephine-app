import { Bell, X, Check, CheckCheck, Trash2, DollarSign, Package, Trash, ShoppingCart, AlertTriangle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useNotificationStore, NotificationType } from '@/stores/notificationStore';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const typeConfig: Record<NotificationType, { icon: typeof Bell; color: string; bgColor: string }> = {
  sale: { icon: DollarSign, color: 'text-success', bgColor: 'bg-success/10' },
  inventory: { icon: Package, color: 'text-info', bgColor: 'bg-info/10' },
  waste: { icon: Trash, color: 'text-warning', bgColor: 'bg-warning/10' },
  order: { icon: ShoppingCart, color: 'text-primary', bgColor: 'bg-primary/10' },
  alert: { icon: AlertTriangle, color: 'text-destructive', bgColor: 'bg-destructive/10' },
  info: { icon: Info, color: 'text-muted-foreground', bgColor: 'bg-muted' },
};

export function NotificationCenter() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearNotification, clearAll } = useNotificationStore();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[380px] p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            <h3 className="font-semibold">Notificaciones</h3>
            {unreadCount > 0 && (
              <Badge variant="secondary">{unreadCount} nuevas</Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" onClick={markAllAsRead} className="h-8 px-2">
                <CheckCheck className="h-4 w-4 mr-1" />
                <span className="text-xs">Marcar leídas</span>
              </Button>
            )}
            {notifications.length > 0 && (
              <Button variant="ghost" size="icon" onClick={clearAll} className="h-8 w-8">
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        <ScrollArea className="h-[400px]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Bell className="h-12 w-12 mb-3 opacity-20" />
              <p className="text-sm">No hay notificaciones</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => {
                const config = typeConfig[notification.type];
                const Icon = config.icon;

                return (
                  <div
                    key={notification.id}
                    className={cn(
                      "p-4 hover:bg-muted/50 transition-colors cursor-pointer group",
                      !notification.read && "bg-muted/30"
                    )}
                    onClick={() => markAsRead(notification.id)}
                  >
                    <div className="flex gap-3">
                      <div className={cn("p-2 rounded-full shrink-0", config.bgColor)}>
                        <Icon className={cn("h-4 w-4", config.color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className={cn(
                              "text-sm font-medium truncate",
                              !notification.read && "text-foreground",
                              notification.read && "text-muted-foreground"
                            )}>
                              {notification.title}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                              {notification.message}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {!notification.read && (
                              <div className="h-2 w-2 rounded-full bg-primary" />
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => {
                                e.stopPropagation();
                                clearNotification(notification.id);
                              }}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(notification.timestamp, { addSuffix: true, locale: es })}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
