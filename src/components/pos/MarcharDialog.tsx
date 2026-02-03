/**
 * Marchar Dialog
 * Opciones para marchar: por curso, seleccionados, o todo
 */

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Flame, Check } from 'lucide-react';

interface MarcharDialogProps {
  open: boolean;
  onClose: () => void;
  onMarcharCourse: (course: number) => void;
  onMarcharSelected: () => void;
  onMarcharAll: () => void;
  selectedCount: number;
  courseCounts: Record<number, number>;
}

export function MarcharDialog({
  open,
  onClose,
  onMarcharCourse,
  onMarcharSelected,
  onMarcharAll,
  selectedCount,
  courseCounts,
}: MarcharDialogProps) {
  const courseLabels: Record<number, string> = {
    0: '🍹 Bebidas',
    1: '🥗 1º Curso',
    2: '🍖 2º Curso',
    3: '🍰 Postres',
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <Flame className="h-6 w-6 text-orange-500" />
            Marchar Pedido
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-4">
          {/* Marchar por curso */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Por Curso:</p>
            {Object.entries(courseCounts).map(([course, count]) => {
              if (count === 0 || parseInt(course) === 0) return null; // Skip drinks
              
              return (
                <Button
                  key={course}
                  variant="outline"
                  className="w-full justify-between h-12"
                  onClick={() => {
                    onMarcharCourse(parseInt(course));
                    onClose();
                  }}
                >
                  <span>{courseLabels[parseInt(course)]}</span>
                  <span className="text-muted-foreground">{count} items</span>
                </Button>
              );
            })}
          </div>

          {/* Marchar seleccionados */}
          {selectedCount > 0 && (
            <>
              <div className="border-t my-2"></div>
              <Button
                variant="outline"
                className="w-full h-12 bg-orange-50 border-orange-200 hover:bg-orange-100"
                onClick={() => {
                  onMarcharSelected();
                  onClose();
                }}
              >
                <Check className="h-4 w-4 mr-2" />
                Marchar Seleccionados ({selectedCount})
              </Button>
            </>
          )}

          {/* Marchar todo */}
          <div className="border-t my-2"></div>
          <Button
            className="w-full h-12 bg-orange-500 hover:bg-orange-600"
            onClick={() => {
              onMarcharAll();
              onClose();
            }}
          >
            <Flame className="h-5 w-5 mr-2" />
            Marchar Todo
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
