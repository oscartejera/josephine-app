import { Keyboard, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Undo2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KDSKeyboardHintsProps {
  className?: string;
  compact?: boolean;
}

export function KDSKeyboardHints({ className, compact = false }: KDSKeyboardHintsProps) {
  if (compact) {
    return (
      <div className={cn("flex items-center gap-3 text-zinc-500", className)}>
        <Keyboard className="h-4 w-4" />
        <span className="text-xs">
          <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-300 font-mono">SPACE</kbd> Bump
          <span className="mx-2">·</span>
          <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-300 font-mono">B</kbd> Todo
          <span className="mx-2">·</span>
          <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-300 font-mono">R</kbd> Recall
        </span>
      </div>
    );
  }

  return (
    <div className={cn("bg-zinc-900 border border-zinc-800 rounded-lg p-4", className)}>
      <div className="flex items-center gap-2 mb-3">
        <Keyboard className="h-5 w-5 text-emerald-400" />
        <span className="text-sm font-medium text-white">Atajos de teclado</span>
      </div>
      
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="flex items-center gap-2">
          <kbd className="px-2 py-1 bg-zinc-800 rounded text-white font-mono text-xs min-w-[60px] text-center">
            SPACE
          </kbd>
          <span className="text-zinc-400">Avanzar item</span>
        </div>
        
        <div className="flex items-center gap-2">
          <kbd className="px-2 py-1 bg-zinc-800 rounded text-white font-mono text-xs min-w-[60px] text-center">
            B
          </kbd>
          <span className="text-zinc-400">Completar comanda</span>
        </div>
        
        <div className="flex items-center gap-2">
          <kbd className="px-2 py-1 bg-zinc-800 rounded text-white font-mono text-xs min-w-[60px] text-center">
            R
          </kbd>
          <span className="text-zinc-400">Recall (deshacer)</span>
        </div>
        
        <div className="flex items-center gap-2">
          <kbd className="px-2 py-1 bg-zinc-800 rounded text-white font-mono text-xs min-w-[60px] text-center">
            ESC
          </kbd>
          <span className="text-zinc-400">Limpiar recall</span>
        </div>
        
        <div className="flex items-center gap-2 col-span-2">
          <div className="flex items-center gap-1">
            <kbd className="p-1 bg-zinc-800 rounded text-white">
              <ArrowLeft className="h-3 w-3" />
            </kbd>
            <kbd className="p-1 bg-zinc-800 rounded text-white">
              <ArrowRight className="h-3 w-3" />
            </kbd>
          </div>
          <span className="text-zinc-400">Navegar comandas</span>
          
          <div className="flex items-center gap-1 ml-4">
            <kbd className="p-1 bg-zinc-800 rounded text-white">
              <ArrowUp className="h-3 w-3" />
            </kbd>
            <kbd className="p-1 bg-zinc-800 rounded text-white">
              <ArrowDown className="h-3 w-3" />
            </kbd>
          </div>
          <span className="text-zinc-400">Navegar items</span>
        </div>
      </div>
    </div>
  );
}
