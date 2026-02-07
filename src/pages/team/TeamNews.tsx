import { useState } from 'react';
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

type AnnouncementType = 'info' | 'important' | 'celebration' | 'schedule';

interface Announcement {
  id: string;
  title: string;
  body: string;
  type: AnnouncementType;
  pinned: boolean;
  created_at: string;
  author: string;
}

// Demo announcements - will be replaced with Supabase data
const demoAnnouncements: Announcement[] = [
  {
    id: '1',
    title: 'Horario especial San Valentín',
    body: 'El 14 de febrero abrimos de 12:00 a 01:00. Se necesita personal extra para el turno de noche. Si estás disponible, habla con tu encargado.',
    type: 'schedule',
    pinned: true,
    created_at: new Date().toISOString(),
    author: 'Dirección',
  },
  {
    id: '2',
    title: 'Nuevo menú de temporada',
    body: 'A partir del lunes se incorporan 3 nuevos platos al menú. Habrá una formación el domingo a las 11:00 para todo el equipo de sala y cocina.',
    type: 'info',
    pinned: true,
    created_at: new Date(Date.now() - 86400000).toISOString(),
    author: 'Chef ejecutivo',
  },
  {
    id: '3',
    title: 'Empleado del mes: María López',
    body: 'Felicidades a María por su excelente trabajo este mes. Su dedicación y actitud positiva son un ejemplo para todo el equipo.',
    type: 'celebration',
    pinned: false,
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    author: 'Dirección',
  },
  {
    id: '4',
    title: 'Recordatorio: Higiene y seguridad',
    body: 'Recordad usar siempre el EPI correspondiente en cocina. La próxima inspección de sanidad será la semana que viene.',
    type: 'important',
    pinned: false,
    created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
    author: 'Gerencia',
  },
  {
    id: '5',
    title: 'Cambio de turno disponible',
    body: 'Carlos busca cambio de turno para el viernes 14. Turno de tarde (16:00-23:00) por turno de mañana. Contactad con él directamente.',
    type: 'schedule',
    pinned: false,
    created_at: new Date(Date.now() - 86400000 * 4).toISOString(),
    author: 'Carlos García',
  },
  {
    id: '6',
    title: 'Cena de equipo',
    body: 'El próximo martes después del cierre haremos una cena de equipo para celebrar los buenos resultados del mes. ¡Estáis todos invitados!',
    type: 'celebration',
    pinned: false,
    created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
    author: 'Dirección',
  },
];

export default function TeamNews() {
  const [tab, setTab] = useState('all');

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
      ? demoAnnouncements
      : demoAnnouncements.filter((a) => a.type === tab);

  const pinned = filtered.filter((a) => a.pinned);
  const rest = filtered.filter((a) => !a.pinned);

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
                      {item.author}
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
                          {item.author}
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
            <p className="text-muted-foreground">No hay novedades en esta categoría</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
