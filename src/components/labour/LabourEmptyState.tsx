/**
 * LabourEmptyState - Empty state with Generate Demo Data button
 */

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Database, BarChart3 } from 'lucide-react';
import { seedLabourDemoData } from '@/hooks/useLabourDataNew';
import { toast } from 'sonner';

interface LabourEmptyStateProps {
  onDataSeeded: () => void;
}

export function LabourEmptyState({ onDataSeeded }: LabourEmptyStateProps) {
  const [isSeeding, setIsSeeding] = useState(false);

  const handleSeedData = async () => {
    setIsSeeding(true);
    try {
      const result = await seedLabourDemoData(30);
      if (result.seeded) {
        toast.success(`Demo data generated: ${result.locations} locations, ${result.days} days`);
        onDataSeeded();
      } else {
        toast.error('Failed to seed demo data');
      }
    } catch (error) {
      console.error('Seed error:', error);
      toast.error('Error generating demo data');
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <Card className="border-[hsl(var(--bi-border))] rounded-2xl shadow-sm">
      <CardContent className="flex flex-col items-center justify-center py-16 px-8 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-6">
          <BarChart3 className="h-8 w-8 text-muted-foreground" />
        </div>
        
        <h3 className="text-xl font-semibold mb-2">No Labour Data Available</h3>
        <p className="text-muted-foreground mb-6 max-w-md">
          There's no labour data for the selected date range. Generate demo data to explore the Labour dashboard with realistic metrics.
        </p>
        
        <Button 
          onClick={handleSeedData} 
          disabled={isSeeding}
          size="lg"
          className="gap-2"
        >
          {isSeeding ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Database className="h-4 w-4" />
              Generate Demo Data
            </>
          )}
        </Button>
        
        <p className="text-xs text-muted-foreground mt-4">
          This will create 30 days of realistic POS and forecast data for all locations.
        </p>
      </CardContent>
    </Card>
  );
}
