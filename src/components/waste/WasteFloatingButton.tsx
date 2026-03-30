/**
 * WasteFloatingButton — Global FAB for waste logging
 *
 * Renders a floating action button (🗑️) in the bottom-right corner
 * of every dashboard page. Opens Quick Log directly — one tap to start.
 *
 * Hidden on:
 * - /insights/waste (has its own Quick Log)
 * - /login, /signup, /onboarding, /team/*, /kiosk/*
 */

import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Trash2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
} from '@/components/ui/sheet';
import { WasteQuickLogContent } from './WasteQuickLogContent';
import { cn } from '@/lib/utils';

// Pages where the FAB should NOT appear
const HIDDEN_PATHS = [
  '/insights/waste',
  '/login',
  '/signup',
  '/reset-password',
  '/onboarding',
  '/kiosk',
];

export function WasteFloatingButton() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  // Hide on excluded paths
  const shouldHide = HIDDEN_PATHS.some(p => pathname.startsWith(p))
    || pathname.startsWith('/team');

  if (shouldHide) return null;

  return (
    <>
      {/* FAB Button */}
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 z-50",
          "w-14 h-14 rounded-2xl",
          "bg-gradient-to-br from-red-500 to-orange-500",
          "text-white shadow-lg shadow-red-500/25",
          "flex items-center justify-center",
          "transition-all duration-300 hover:scale-110 hover:shadow-xl hover:shadow-red-500/30",
          "active:scale-95",
          "group",
        )}
        title="Registrar merma rápida"
        aria-label="Registrar merma"
      >
        <Trash2 className="h-6 w-6 transition-transform group-hover:rotate-12" />
      </button>

      {/* Quick Log Sheet */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl p-0 overflow-hidden">
          <WasteQuickLogContent
            onBack={() => setOpen(false)}
            onSuccess={() => {
              // Stay open for multiple entries — don't close
            }}
          />

          {/* Footer link to full waste page */}
          <div className="absolute bottom-0 left-0 right-0 px-4 py-3 bg-gradient-to-t from-background via-background to-transparent">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground hover:text-foreground gap-2"
              onClick={() => {
                setOpen(false);
                navigate('/insights/waste');
              }}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Ver dashboard completo de merma
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
