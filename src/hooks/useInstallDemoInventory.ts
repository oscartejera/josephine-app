import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface InstallResult {
  installed: boolean;
  items_created: number;
  movements_created: number;
  error?: string;
}

/**
 * Mutation hook that calls the install_demo_inventory_pack RPC to seed
 * demo inventory items and stock movements for a given location.
 *
 * Invalidates inventory-readiness and low-stock-alerts queries on success
 * so the LowStockWidget transitions from demo → live automatically.
 */
export function useInstallDemoInventory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (locationId: string) => {
      type RpcFn = (name: string, params: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
      const rpc: RpcFn = supabase.rpc as unknown as RpcFn;

      const { data, error } = await rpc('install_demo_inventory_pack', {
        p_location_id: locationId,
      });

      if (error) throw new Error(error.message);
      return data as InstallResult;
    },
    onSuccess: (result) => {
      if (result?.installed) {
        toast.success(
          `Demo pack instalado: ${result.items_created} items, ${result.movements_created} movimientos`,
        );
      } else {
        toast.info(result?.error === 'items_already_exist'
          ? 'Ya existen items de inventario'
          : 'El demo pack no se instaló (ya existen datos)');
      }
      // Invalidate so widget re-evaluates readiness and fetches alerts
      queryClient.invalidateQueries({ queryKey: ['inventory-readiness'] });
      queryClient.invalidateQueries({ queryKey: ['low-stock-alerts'] });
    },
    onError: (err: Error) => {
      toast.error('Error al instalar demo pack', { description: err.message });
    },
  });
}
