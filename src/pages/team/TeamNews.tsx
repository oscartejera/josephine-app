import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Megaphone,
  Pin,
  Calendar,
  AlertTriangle,
  PartyPopper,
  Info,
  Bell,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';

type AnnouncementType = 'info' | 'important' | 'celebration' | 'schedule';

interface Announcement {
  id: string;
  title: string;
  body: string;
  type: AnnouncementType;
  pinned: boolean;
  created_at: string;
  author_name: string;
}

export default function TeamNews() {
  const { t } = useTranslation();
  const [tab, setTab] = useState('all');
  const { user } = useAuth();

  // Fetch announcements from Supabase
  const { data: announcements = [], isLoading } = useQuery({
    queryKey: ['announcements'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('announcements')
        .select('id, title, body, type, pinned, created_at, author_name')
        .order('pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return (data || []) as Announcement[];
    },
    staleTime: 30_000,
  });

  const getTypeIcon = (type: AnnouncementType) => {
    switch (type) {
      case 'important':
        return <AlertTriangle className="h-4 w-4" />;
      case 'celebration':
        return <PartyPopper className="h-4 w-4" />;
      case 'schedule':
        return <Calendar className="h-4 w-4" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  const getTypeStyle = (type: AnnouncementType) => {
    switch (type) {
      case 'important':
        return {
          bg: 'bg-red-500/10',
          text: 'text-red-600',
          badge: 'bg-red-100 text-red-700',
          border: 'border-l-red-500',
        };
      case 'celebration':
        return {
          bg: 'bg-amber-500/10',
          text: 'text-amber-600',
          badge: 'bg-amber-100 text-amber-700',
          border: 'border-l-amber-500',
        };
      case 'schedule':
        return {
          bg: 'bg-blue-500/10',
          text: 'text-blue-600',
          badge: 'bg-blue-100 text-blue-700',
          border: 'border-l-blue-500',
        };
      default:
        return {
          bg: 'bg-gray-500/10',
          text: 'text-gray-600',
          badge: 'bg-gray-100 text-gray-700',
          border: 'border-l-gray-400',
        };
    }
  };

  const getTypeLabel = (type: AnnouncementType) => {
    switch (type) {
      case 'important':
        return 'Importante';
      case 'celebration':
        return 'Celebración';
      case 'schedule':
        return 'Horarios';
      default:
        return 'Información';
    }
  };

  const filtered =
    tab === 'all'
      ? announcements
      : announcements.filter((a) => a.type === tab);

  const pinned = filtered.filter((a) => a.pinned);
  const rest = filtered.filter((a) => !a.pinned);

  if (isLoading) {
    return (
      <div className="p-4 lg:p-6 max-w-2xl mx-auto flex items-center justify-center min-h-[40vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold">Novedades</h1>
        <p className="text-sm text-muted-foreground">
          Anuncios y noticias del equipo
        </p>
      </div>

      {/* Filter Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="all">Todos</TabsTrigger>
          <TabsTrigger value="important">Importantes</TabsTrigger>
          <TabsTrigger value="schedule">Horarios</TabsTrigger>
          <TabsTrigger value="celebration">Equipo</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Pinned */}
      {pinned.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <Pin className="h-3 w-3" />
            <span>Fijados</span>
          </div>
          {pinned.map((item) => {
            const style = getTypeStyle(item.type);
            return (
              <Card
                key={item.id}
                className={cn('border-l-4', style.border)}
              >
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className={cn('p-1.5 rounded-lg', style.bg, style.text)}>
                        {getTypeIcon(item.type)}
                      </div>
                      <h3 className="font-semibold text-sm">{item.title}</h3>
                    </div>
                    <Pin className="h-3 w-3 text-muted-foreground shrink-0 mt-1" />
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {item.body}
                  </p>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-muted-foreground">
                      {item.author_name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(item.created_at), "d MMM", { locale: es })}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Rest */}
      {rest.length > 0 && (
        <div className="space-y-3">
          {pinned.length > 0 && (
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <Bell className="h-3 w-3" />
              <span>Recientes</span>
            </div>
          )}
          {rest.map((item) => {
            const style = getTypeStyle(item.type);
            return (
              <Card key={item.id}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start gap-2">
                    <div className={cn('p-1.5 rounded-lg shrink-0', style.bg, style.text)}>
                      {getTypeIcon(item.type)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-sm truncate">{item.title}</h3>
                        <span
                          className={cn(
                            'text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0',
                            style.badge
                          )}
                        >
                          {getTypeLabel(item.type)}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {item.body}
                      </p>
                      <div className="flex items-center justify-between pt-2">
                        <span className="text-xs text-muted-foreground">
                          {item.author_name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(item.created_at), "d MMM", { locale: es })}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {filtered.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <Megaphone className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-muted-foreground">
              {announcements.length === 0
                ? 'Tu manager aún no ha publicado novedades'
                : 'No hay novedades en esta categoría'}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
