import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LowStockAlert {
  item_id: string;
  name: string;
  unit: string;
  supplier_id: string | null;
  price: number;
  order_unit: string;
  order_unit_qty: number;
  min_order_qty: number;
  on_hand: number;
  reorder_point: number;
  safety_stock: number;
  avg_daily_usage: number | null;
  forecast_qty: number | null;
  recommended_qty: number;
  urgency: 'critical' | 'high' | 'medium' | 'low';
}

// ---------------------------------------------------------------------------
// Query hook
// ---------------------------------------------------------------------------

export function useLowStockAlerts(locationId: string | null) {
  const enabled = !!locationId && locationId !== 'all';

  return useQuery<LowStockAlert[]>({
    queryKey: ['low-stock-alerts', locationId],
    queryFn: async () => {
      if (!locationId || locationId === 'all') return [];

      type RpcFn = (name: string, params: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
      const rpc: RpcFn = supabase.rpc as unknown as RpcFn;

      const { data, error } = await rpc('rpc_low_stock_alerts', {
        p_location_id: locationId,
        p_days_history: 30,
        p_days_cover: 7,
        p_limit: 20,
      });

      if (error) {
        console.error('rpc_low_stock_alerts error:', error);
        return [];
      }

      return (data as LowStockAlert[]) || [];
    },
    enabled,
    staleTime: 60_000,
  });
}

// ---------------------------------------------------------------------------
// Mutation: create draft PO from selected low-stock items
// ---------------------------------------------------------------------------

export function useCreatePOFromLowStock() {
  const { group } = useApp();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async ({
      locationId,
      items,
    }: {
      locationId: string;
      items: LowStockAlert[];
    }) => {
      if (!group?.id) throw new Error('No group context');

      const payload = items
        .filter(i => i.supplier_id && i.recommended_qty > 0)
        .map(i => ({
          item_id: i.item_id,
          supplier_id: i.supplier_id,
          quantity: i.recommended_qty,
          unit_cost: i.price || 0,
        }));

      if (payload.length === 0) {
        throw new Error('No hay items válidos para crear pedido (falta proveedor o cantidad)');
      }

      type RpcFn = (name: string, params: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
      const rpc: RpcFn = supabase.rpc as unknown as RpcFn;

      const { data, error } = await rpc('rpc_create_po_from_low_stock', {
        p_location_id: locationId,
        p_group_id: group.id,
        p_items: payload,
      });

      if (error) throw new Error(error.message);

      return data as { success: boolean; po_ids: string[]; count: number };
    },
    onSuccess: (result) => {
      const count = result?.count || 0;
      toast.success(`${count} pedido${count !== 1 ? 's' : ''} borrador creado${count !== 1 ? 's' : ''}`, {
        description: 'Revisa y confirma en Compras',
        action: {
          label: 'Ir a Compras',
          onClick: () => navigate('/procurement/orders'),
        },
      });
      queryClient.invalidateQueries({ queryKey: ['low-stock-alerts'] });
    },
    onError: (err: Error) => {
      toast.error('Error al crear pedido', { description: err.message });
    },
  });
}
