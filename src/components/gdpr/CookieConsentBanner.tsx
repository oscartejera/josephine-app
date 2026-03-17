/**
 * CookieConsentBanner — GDPR-compliant cookie consent UI.
 *
 * Shows a non-intrusive bottom banner on first visit.
 * Remembers consent for 6 months. Writes to DB when user is authenticated.
 */

import { useState, useEffect, useCallback } from 'react';
import { Cookie, Settings2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { CookiePreferencesDialog } from './CookiePreferencesDialog';

export interface ConsentPreferences {
  essential: boolean; // always true
  analytics: boolean;
  marketing: boolean;
  timestamp: number;
}

const CONSENT_KEY = 'josephine_consent';
const CONSENT_EXPIRY_DAYS = 180; // 6 months

function getStoredConsent(): ConsentPreferences | null {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ConsentPreferences;
    // Check expiry
    const expiryMs = CONSENT_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
    if (Date.now() - parsed.timestamp > expiryMs) {
      localStorage.removeItem(CONSENT_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function storeConsent(prefs: ConsentPreferences): void {
  localStorage.setItem(CONSENT_KEY, JSON.stringify(prefs));
}

export function CookieConsentBanner() {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);

  useEffect(() => {
    const stored = getStoredConsent();
    if (!stored) {
      // Small delay so the banner doesn't flash on page load
      const timer = setTimeout(() => setVisible(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const saveConsent = useCallback(async (prefs: ConsentPreferences) => {
    storeConsent(prefs);
    setVisible(false);

    // Persist to DB if authenticated
    if (user?.id) {
      const types: Array<{ type: string; granted: boolean }> = [
        { type: 'essential', granted: true },
        { type: 'analytics', granted: prefs.analytics },
        { type: 'marketing', granted: prefs.marketing },
      ];

      for (const t of types) {
        await supabase.from('consent_records').upsert(
          {
            user_id: user.id,
            consent_type: t.type,
            granted: t.granted,
            granted_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,consent_type' }
        ).then(() => {});
      }
    }
  }, [user?.id]);

  const handleAcceptAll = () => {
    saveConsent({ essential: true, analytics: true, marketing: true, timestamp: Date.now() });
  };

  const handleEssentialOnly = () => {
    saveConsent({ essential: true, analytics: false, marketing: false, timestamp: Date.now() });
  };

  const handleSavePreferences = (prefs: ConsentPreferences) => {
    saveConsent(prefs);
    setShowPreferences(false);
  };

  if (!visible) return null;

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 z-[100] p-4 animate-in slide-in-from-bottom-4 duration-500">
        <div className="mx-auto max-w-4xl rounded-xl border border-gray-200 bg-white shadow-2xl p-5">
          <div className="flex items-start gap-4">
            <div className="rounded-full bg-amber-50 p-2.5 shrink-0">
              <Cookie className="h-5 w-5 text-amber-600" />
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-gray-900 mb-1">
                Usamos cookies 🍪
              </h3>
              <p className="text-xs text-gray-500 leading-relaxed">
                Utilizamos cookies esenciales para que la aplicación funcione y cookies opcionales
                para mejorar tu experiencia. Puedes personalizar tus preferencias en cualquier momento.{' '}
                <a href="/privacidad" className="underline hover:text-gray-700">
                  Política de privacidad
                </a>
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowPreferences(true)}
                className="text-xs gap-1.5"
              >
                <Settings2 className="h-3.5 w-3.5" />
                Personalizar
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleEssentialOnly}
                className="text-xs gap-1.5"
              >
                <X className="h-3.5 w-3.5" />
                Solo esenciales
              </Button>
              <Button
                size="sm"
                onClick={handleAcceptAll}
                className="text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700"
              >
                <Check className="h-3.5 w-3.5" />
                Aceptar todo
              </Button>
            </div>
          </div>
        </div>
      </div>

      <CookiePreferencesDialog
        open={showPreferences}
        onOpenChange={setShowPreferences}
        onSave={handleSavePreferences}
      />
    </>
  );
}

/** Utility: check if analytics consent was granted */
export function hasAnalyticsConsent(): boolean {
  const stored = getStoredConsent();
  return stored?.analytics === true;
}

/** Utility: check if marketing consent was granted */
export function hasMarketingConsent(): boolean {
  const stored = getStoredConsent();
  return stored?.marketing === true;
}

/** Utility: get current consent state */
export function getConsent(): ConsentPreferences | null {
  return getStoredConsent();
}
