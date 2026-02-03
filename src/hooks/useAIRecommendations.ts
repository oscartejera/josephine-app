/**
 * useAIRecommendations Hook
 * Carga y gestiona recomendaciones AI (mock data for now)
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AIRecommendation {
  id: string;
  location_id: string;
  type: string;
  title: string;
  description: string;
  impact_estimate: number;
  status: 'pending' | 'approved' | 'rejected';
  expires_at: string;
  created_at: string;
}

export function useAIRecommendations(locationId: string | null) {
  const [recommendations, setRecommendations] = useState<AIRecommendation[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRecommendations = useCallback(async () => {
    if (!locationId || locationId === 'all') {
      setLoading(false);
      return;
    }

    try {
      // Mock recommendations since table doesn't exist yet
      setRecommendations([
        {
          id: '1',
          location_id: locationId,
          type: 'menu',
          title: 'Subir precio Paella 2€',
          description: 'La Paella tiene margen bajo. Subir 2€ aumentaría rentabilidad sin afectar demanda.',
          impact_estimate: 450,
          status: 'pending',
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          created_at: new Date().toISOString(),
        },
        {
          id: '2',
          location_id: locationId,
          type: 'labor',
          title: 'Reducir turno lunes mañana',
          description: 'Los lunes por la mañana tienen baja ocupación. Reducir 1 camarero ahorraría costes.',
          impact_estimate: 280,
          status: 'pending',
          expires_at: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
          created_at: new Date().toISOString(),
        },
      ]);
    } catch (error) {
      console.error('Error loading recommendations:', error);
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    loadRecommendations();
  }, [loadRecommendations]);

  const approveRecommendation = useCallback(async (id: string) => {
    setRecommendations(prev =>
      prev.map(r => r.id === id ? { ...r, status: 'approved' as const } : r)
    );
    toast.success('Recomendación aprobada');
  }, []);

  const rejectRecommendation = useCallback(async (id: string) => {
    setRecommendations(prev =>
      prev.map(r => r.id === id ? { ...r, status: 'rejected' as const } : r)
    );
    toast.success('Recomendación rechazada');
  }, []);

  const generateRecommendations = useCallback(async () => {
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
  }, [locationId, loadRecommendations]);

  return {
    recommendations,
    loading,
    approveRecommendation,
    rejectRecommendation,
    generateRecommendations,
    refetch: loadRecommendations,
  };
}
