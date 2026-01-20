import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Construction } from 'lucide-react';

export default function BIOrders() {
  return (
    <div className="p-6">
      <Card className="border-bi-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Construction className="h-5 w-5 text-muted-foreground" />
            Orders Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Esta sección está en desarrollo. Próximamente podrás ver análisis detallados de pedidos,
            tiempos de preparación, y métricas operativas.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
