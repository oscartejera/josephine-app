import { Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';

interface ScheduleToastProps {
  isVisible: boolean;
  hoursAdded: number;
  onAccept: () => void;
  onUndo: () => void;
}

export function ScheduleToast({ isVisible, hoursAdded, onAccept, onUndo }: ScheduleToastProps) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 50, x: 0 }}
          animate={{ opacity: 1, y: 0, x: 0 }}
          exit={{ opacity: 0, y: 50 }}
          className="fixed bottom-6 right-6 z-50"
        >
          <div className="bg-card border border-border rounded-xl shadow-elevated p-4 w-[380px]">
            <div className="flex gap-4">
              {/* Check icon */}
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[hsl(var(--success))]/10 flex items-center justify-center">
                <Check className="h-5 w-5 text-[hsl(var(--success))]" />
              </div>
              
              {/* Content */}
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-lg">
                  {hoursAdded} hours added
                </h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Adjust your schedule as needed. The more you tweak, the smarter our engine gets.
                </p>
                
                {/* Actions */}
                <div className="flex gap-2 mt-4">
                  <Button
                    onClick={onAccept}
                    className="bg-primary hover:bg-primary/90"
                  >
                    Accept
                  </Button>
                  <Button
                    variant="outline"
                    onClick={onUndo}
                  >
                    Undo
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
