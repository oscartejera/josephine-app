/**
 * useAIRecommendations Hook
 * Carga y gestiona recomendaciones AI
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useAIRecommendations(locationId: string | null) {
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRecommendations();
  }, [locationId]);

  const loadRecommendations = async () => {
    if (!locationId || locationId === 'all') {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('ai_recommendations')
        .select('*')
        .eq('location_id', locationId)
        .in('status', ['pending', 'approved'])
        .gte('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      setRecommendations(data || []);
    } catch (error) {
      console.error('Error loading recommendations:', error);
    } finally {
      setLoading(false);
    }
  };

  const approveRecommendation = async (id: string) => {
    try {
      const { error } = await supabase
        .from('ai_recommendations')
        .update({ status: 'approved' })
        .eq('id', id);

      if (error) throw error;

      toast.success('Recomendación aprobada');
      loadRecommendations();
    } catch (error) {
      toast.error('Error al aprobar');
    }
  };

  const rejectRecommendation = async (id: string) => {
    try {
      const { error } = await supabase
        .from('ai_recommendations')
        .update({ status: 'rejected' })
        .eq('id', id);

      if (error) throw error;

      toast.success('Recomendación rechazada');
      loadRecommendations();
    } catch (error) {
      toast.error('Error al rechazar');
    }
  };

  const generateRecommendations = async () => {
    if (!locationId) return;

    try {
      const { error } = await supabase.functions.invoke('ai-recommendations', {
        body: { locationId },
      });

      if (error) throw error;

      toast.success('Nuevas recomendaciones generadas');
      loadRecommendations();
    } catch (error: any) {
      toast.error('Error: ' + error.message);
    }
  };

  return {
    recommendations,
    loading,
    approveRecommendation,
    rejectRecommendation,
    generateRecommendations,
    refetch: loadRecommendations,
  };
}
