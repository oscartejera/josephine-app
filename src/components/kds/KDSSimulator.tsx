import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { FlaskConical, Loader2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface KDSSimulatorProps {
  locationId: string;
  onComplete: () => void;
}

const SAMPLE_ITEMS = [
  { name: 'Hamburguesa Clásica', price: 12.50, destination: 'kitchen' as const },
  { name: 'Pizza Margherita', price: 14.00, destination: 'kitchen' as const },
  { name: 'Ensalada César', price: 9.50, destination: 'prep' as const },
  { name: 'Nachos con Guacamole', price: 8.00, destination: 'prep' as const },
  { name: 'Mojito', price: 8.50, destination: 'bar' as const },
  { name: 'Cerveza Artesanal', price: 5.00, destination: 'bar' as const },
  { name: 'Gin Tonic Premium', price: 12.00, destination: 'bar' as const },
  { name: 'Risotto de Setas', price: 16.00, destination: 'kitchen' as const },
  { name: 'Tacos de Carnitas', price: 11.00, destination: 'kitchen' as const },
  { name: 'Tiramisú', price: 7.00, destination: 'prep' as const },
];

const SAMPLE_MODIFIERS = [
  { modifier_name: 'Extras', option_name: 'Extra queso', price_delta: 1.50 },
  { modifier_name: 'Extras', option_name: 'Doble carne', price_delta: 3.00 },
  { modifier_name: 'Sin ingredientes', option_name: 'Sin cebolla', price_delta: 0 },
  { modifier_name: 'Sin ingredientes', option_name: 'Sin gluten', price_delta: 0 },
  { modifier_name: 'Punto', option_name: 'Poco hecho', price_delta: 0 },
  { modifier_name: 'Punto', option_name: 'Muy hecho', price_delta: 0 },
];

export function KDSSimulator({ locationId, onComplete }: KDSSimulatorProps) {
  const [loading, setLoading] = useState(false);

  const createTestOrder = async (tableNumber: string, itemCount: number, includeRush: boolean, includeModifiers: boolean) => {
    // Create ticket
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .insert({
        location_id: locationId,
        status: 'open',
        service_type: 'dine_in',
        table_name: tableNumber,
        covers: Math.floor(Math.random() * 4) + 1,
        gross_total: 0,
        net_total: 0,
      })
      .select()
      .single();

    if (ticketError || !ticket) throw ticketError;

    // Select random items
    const selectedItems = [];
    for (let i = 0; i < itemCount; i++) {
      const item = SAMPLE_ITEMS[Math.floor(Math.random() * SAMPLE_ITEMS.length)];
      selectedItems.push({
        ...item,
        quantity: Math.floor(Math.random() * 2) + 1,
        is_rush: includeRush && i === 0, // First item is rush
      });
    }

    // Insert ticket lines
    const { data: lines, error: linesError } = await supabase
      .from('ticket_lines')
      .insert(
        selectedItems.map(item => ({
          ticket_id: ticket.id,
          item_name: item.name,
          quantity: item.quantity,
          unit_price: item.price,
          line_total: item.price * item.quantity,
          destination: item.destination,
          sent_to_kitchen: true,
          sent_at: new Date().toISOString(),
          prep_status: 'pending',
          is_rush: item.is_rush,
        }))
      )
      .select();

    if (linesError || !lines) throw linesError;

    // Add modifiers to some lines
    if (includeModifiers && lines.length > 0) {
      const modifierInserts = [];
      for (let i = 0; i < Math.min(2, lines.length); i++) {
        const mod = SAMPLE_MODIFIERS[Math.floor(Math.random() * SAMPLE_MODIFIERS.length)];
        modifierInserts.push({
          ticket_line_id: lines[i].id,
          modifier_name: mod.modifier_name,
          option_name: mod.option_name,
          price_delta: mod.price_delta,
        });
      }
      await supabase.from('ticket_line_modifiers').insert(modifierInserts);
    }

    // Update ticket total
    const total = selectedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    await supabase
      .from('tickets')
      .update({ gross_total: total, net_total: total * 0.9 })
      .eq('id', ticket.id);

    return ticket;
  };

  const simulateQuick = async () => {
    setLoading(true);
    try {
      await createTestOrder('Mesa 1', 2, false, true);
      toast.success('✅ 1 comanda creada', { description: 'Mesa 1 con 2 items' });
      onComplete();
    } catch (error) {
      console.error('Simulation error:', error);
      toast.error('Error al simular');
    } finally {
      setLoading(false);
    }
  };

  const simulateRush = async () => {
    setLoading(true);
    try {
      await createTestOrder('Mesa RUSH', 3, true, true);
      toast.success('🔥 1 comanda RUSH creada', { description: 'Mesa RUSH con pedido urgente' });
      onComplete();
    } catch (error) {
      console.error('Simulation error:', error);
      toast.error('Error al simular');
    } finally {
      setLoading(false);
    }
  };

  const simulateFull = async () => {
    setLoading(true);
    try {
      const tables = ['Mesa 1', 'Mesa 2', 'Mesa 3', 'Barra 1', 'Terraza 2'];
      
      for (let i = 0; i < 5; i++) {
        const isRush = i === 2; // Third order is rush
        await createTestOrder(tables[i], Math.floor(Math.random() * 3) + 2, isRush, true);
      }
      
      toast.success('🍽️ Servicio simulado', { 
        description: '5 comandas creadas (1 RUSH, con modificadores)' 
      });
      onComplete();
    } catch (error) {
      console.error('Simulation error:', error);
      toast.error('Error al simular');
    } finally {
      setLoading(false);
    }
  };

  const clearAllOrders = async () => {
    setLoading(true);
    try {
      // Get all open tickets for this location
      const { data: tickets } = await supabase
        .from('tickets')
        .select('id')
        .eq('location_id', locationId)
        .eq('status', 'open');

      if (tickets && tickets.length > 0) {
        const ticketIds = tickets.map(t => t.id);
        
        // Get all lines for these tickets
        const { data: lines } = await supabase
          .from('ticket_lines')
          .select('id')
          .in('ticket_id', ticketIds);

        if (lines && lines.length > 0) {
          // Delete modifiers
          await supabase
            .from('ticket_line_modifiers')
            .delete()
            .in('ticket_line_id', lines.map(l => l.id));
        }

        // Delete lines
        await supabase
          .from('ticket_lines')
          .delete()
          .in('ticket_id', ticketIds);

        // Delete tickets
        await supabase
          .from('tickets')
          .delete()
          .in('id', ticketIds);
      }

      toast.success('🗑️ Comandas limpiadas', { description: 'Todas las comandas eliminadas' });
      onComplete();
    } catch (error) {
      console.error('Clear error:', error);
      toast.error('Error al limpiar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          disabled={loading}
          className="gap-2"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FlaskConical className="h-4 w-4" />
          )}
          Simular
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={simulateQuick}>
          <span className="mr-2">📝</span>
          1 Comanda simple
        </DropdownMenuItem>
        <DropdownMenuItem onClick={simulateRush}>
          <span className="mr-2">🔥</span>
          1 Comanda RUSH
        </DropdownMenuItem>
        <DropdownMenuItem onClick={simulateFull}>
          <span className="mr-2">🍽️</span>
          Servicio completo (5 mesas)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={clearAllOrders} className="text-destructive">
          <span className="mr-2">🗑️</span>
          Limpiar todas las comandas
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}