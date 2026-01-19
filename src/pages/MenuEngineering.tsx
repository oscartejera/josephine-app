import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ChefHat, Star, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';

interface MenuItem {
  name: string;
  category: string;
  quantity: number;
  sales: number;
  margin: number;
  classification: 'star' | 'plow_horse' | 'puzzle' | 'dog';
}

export default function MenuEngineering() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    
    // Get ticket lines data
    const { data: lines } = await supabase
      .from('ticket_lines')
      .select('item_name, category_name, quantity, gross_line_total')
      .eq('voided', false)
      .eq('comped', false);
    
    // Aggregate by item
    const itemMap = new Map<string, { name: string; category: string; quantity: number; sales: number }>();
    lines?.forEach(line => {
      const existing = itemMap.get(line.item_name) || { 
        name: line.item_name, 
        category: line.category_name || 'Sin categoría', 
        quantity: 0, 
        sales: 0 
      };
      existing.quantity += Number(line.quantity) || 0;
      existing.sales += Number(line.gross_line_total) || 0;
      itemMap.set(line.item_name, existing);
    });
    
    const aggregated = Array.from(itemMap.values());
    
    // Calculate averages for classification
    const avgQuantity = aggregated.length > 0 
      ? aggregated.reduce((sum, i) => sum + i.quantity, 0) / aggregated.length 
      : 0;
    
    // Add margin (mock) and classify
    const withClassification: MenuItem[] = aggregated.map(item => {
      const margin = 50 + Math.random() * 30; // Mock margin 50-80%
      const highPopularity = item.quantity >= avgQuantity;
      const highMargin = margin >= 65;
      
      let classification: MenuItem['classification'];
      if (highPopularity && highMargin) classification = 'star';
      else if (highPopularity && !highMargin) classification = 'plow_horse';
      else if (!highPopularity && highMargin) classification = 'puzzle';
      else classification = 'dog';
      
      return { ...item, margin, classification };
    });
    
    setItems(withClassification.sort((a, b) => b.sales - a.sales));
    setLoading(false);
  };

  const stars = items.filter(i => i.classification === 'star');
  const plowHorses = items.filter(i => i.classification === 'plow_horse');
  const puzzles = items.filter(i => i.classification === 'puzzle');
  const dogs = items.filter(i => i.classification === 'dog');

  const getClassificationBadge = (classification: MenuItem['classification']) => {
    switch (classification) {
      case 'star':
        return <Badge className="bg-success text-success-foreground">⭐ Star</Badge>;
      case 'plow_horse':
        return <Badge className="bg-info text-info-foreground">🐴 Plow Horse</Badge>;
      case 'puzzle':
        return <Badge className="bg-warning text-warning-foreground">🧩 Puzzle</Badge>;
      case 'dog':
        return <Badge variant="destructive">🐕 Dog</Badge>;
    }
  };

  const recommendations = [
    { icon: Star, text: "Mantener Stars en posiciones destacadas del menú", type: 'success' },
    { icon: TrendingUp, text: "Subir precio de Plow Horses para mejorar margen", type: 'info' },
    { icon: AlertTriangle, text: "Promocionar Puzzles para aumentar popularidad", type: 'warning' },
    { icon: TrendingDown, text: "Considerar eliminar Dogs o reformular receta", type: 'danger' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-display font-bold">Menu Engineering</h1>
        <p className="text-muted-foreground">Análisis de rentabilidad y popularidad del menú</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-success">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Stars</p>
                <p className="text-2xl font-bold">{stars.length}</p>
              </div>
              <Star className="h-8 w-8 text-success" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-info">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Plow Horses</p>
                <p className="text-2xl font-bold">{plowHorses.length}</p>
              </div>
              <ChefHat className="h-8 w-8 text-info" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-warning">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Puzzles</p>
                <p className="text-2xl font-bold">{puzzles.length}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-warning" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Dogs</p>
                <p className="text-2xl font-bold">{dogs.length}</p>
              </div>
              <TrendingDown className="h-8 w-8 text-destructive" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Matrix Visualization */}
        <Card>
          <CardHeader>
            <CardTitle>Matriz Popularidad vs Margen</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative h-[400px] border rounded-lg">
              {/* Quadrant labels */}
              <div className="absolute top-2 left-2 text-xs text-muted-foreground">Bajo Margen</div>
              <div className="absolute top-2 right-2 text-xs text-muted-foreground">Alto Margen</div>
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs text-muted-foreground">Baja Popularidad</div>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-xs text-muted-foreground">Alta Popularidad</div>
              
              {/* Quadrants */}
              <div className="absolute inset-0 grid grid-cols-2 grid-rows-2">
                <div className="bg-info/10 border-r border-b flex items-start justify-start p-2">
                  <span className="text-xs font-medium text-info">🐴 Plow Horses</span>
                </div>
                <div className="bg-success/10 border-b flex items-start justify-end p-2">
                  <span className="text-xs font-medium text-success">⭐ Stars</span>
                </div>
                <div className="bg-destructive/10 border-r flex items-end justify-start p-2">
                  <span className="text-xs font-medium text-destructive">🐕 Dogs</span>
                </div>
                <div className="bg-warning/10 flex items-end justify-end p-2">
                  <span className="text-xs font-medium text-warning">🧩 Puzzles</span>
                </div>
              </div>
              
              {/* Plot items */}
              {items.slice(0, 20).map((item, i) => {
                const maxQty = Math.max(...items.map(i => i.quantity));
                const x = ((item.margin - 50) / 30) * 45 + 5; // 5-50% of width based on margin
                const y = (1 - item.quantity / maxQty) * 45 + 5; // 5-50% of height based on quantity (inverted)
                
                return (
                  <div
                    key={i}
                    className="absolute w-3 h-3 rounded-full bg-primary cursor-pointer hover:scale-150 transition-transform"
                    style={{ left: `${x + (item.margin > 65 ? 45 : 0)}%`, top: `${y + (item.quantity < maxQty / 2 ? 45 : 0)}%` }}
                    title={`${item.name}: ${item.quantity} uds, ${item.margin.toFixed(0)}% margen`}
                  />
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Recommendations */}
        <Card>
          <CardHeader>
            <CardTitle>Acciones Recomendadas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {recommendations.map((rec, i) => (
              <div key={i} className={`p-4 rounded-lg border-l-4 ${
                rec.type === 'success' ? 'border-l-success bg-success/5' :
                rec.type === 'info' ? 'border-l-info bg-info/5' :
                rec.type === 'warning' ? 'border-l-warning bg-warning/5' :
                'border-l-destructive bg-destructive/5'
              }`}>
                <div className="flex items-center gap-3">
                  <rec.icon className={`h-5 w-5 ${
                    rec.type === 'success' ? 'text-success' :
                    rec.type === 'info' ? 'text-info' :
                    rec.type === 'warning' ? 'text-warning' :
                    'text-destructive'
                  }`} />
                  <p className="text-sm font-medium">{rec.text}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Items Table */}
      <Card>
        <CardHeader>
          <CardTitle>Análisis por Producto</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead className="text-right">Unidades</TableHead>
                <TableHead className="text-right">Ventas</TableHead>
                <TableHead className="text-right">Margen Est.</TableHead>
                <TableHead className="text-center">Clasificación</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.slice(0, 20).map((item, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell className="text-muted-foreground">{item.category}</TableCell>
                  <TableCell className="text-right">{item.quantity.toFixed(0)}</TableCell>
                  <TableCell className="text-right">€{item.sales.toFixed(2)}</TableCell>
                  <TableCell className="text-right">{item.margin.toFixed(1)}%</TableCell>
                  <TableCell className="text-center">{getClassificationBadge(item.classification)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
