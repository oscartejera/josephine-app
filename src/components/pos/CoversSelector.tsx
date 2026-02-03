/**
 * Covers Selector
 * Selector numérico de comensales (1-12) táctil
 */

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Users, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CoversSelectorProps {
  open: boolean;
  tableName: string;
  onConfirm: (covers: number) => void;
  onCancel: () => void;
}

export function CoversSelector({
  open,
  tableName,
  onConfirm,
  onCancel,
}: CoversSelectorProps) {
  const [selected, setSelected] = useState(2);

  const handleConfirm = () => {
    onConfirm(selected);
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <Users className="h-6 w-6" />
            {tableName} - ¿Cuántos comensales?
          </DialogTitle>
        </DialogHeader>

        {/* Grid de números */}
        <div className="grid grid-cols-4 gap-3 p-4">
          {Array.from({ length: 12 }, (_, i) => i + 1).map((num) => (
            <Button
              key={num}
              variant={selected === num ? 'default' : 'outline'}
              size="lg"
              className={cn(
                'h-20 text-2xl font-bold relative',
                selected === num && 'ring-2 ring-primary ring-offset-2'
              )}
              onClick={() => setSelected(num)}
            >
              {num}
              {selected === num && (
                <Check className="absolute top-1 right-1 h-4 w-4" />
              )}
            </Button>
          ))}
        </div>

        {/* Selected Display */}
        <div className="bg-primary/10 rounded-lg p-4 text-center">
          <p className="text-sm text-muted-foreground mb-1">Comensales seleccionados:</p>
          <p className="text-4xl font-bold text-primary">{selected}</p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button variant="outline" onClick={onCancel} className="flex-1" size="lg">
            Cancelar
          </Button>
          <Button onClick={handleConfirm} className="flex-1" size="lg">
            Confirmar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
