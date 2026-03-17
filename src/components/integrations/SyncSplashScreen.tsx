/**
 * Splash screen shown during sync or disconnect while the app reloads.
 * Displays the Josephine logo with rotating funny AI + restaurant quotes.
 */

import { useState, useEffect } from 'react';
import { ChefHat, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const QUOTES = [
  'La IA dice que tu plato estrella es el que menos vendes... awkward.',
  'Entrenando redes neuronales con recetas de la abuela...',
  t('integrations.splashMsg1'),
  t('integrations.splashMsg2'),
  t('integrations.splashMsg3'),
  'Convirtiendo tickets en insights... sin propina.',
  t('integrations.splashMsg4'),
  t('integrations.splashMsg5'),
  'Buscando patrones en tus pedidos como un detective...',
  t('integrations.splashMsg6'),
  t('integrations.splashMsg7'),
  t('integrations.splashMsg8'),
];

interface SyncSplashScreenProps {
  message?: string;
}

export default function SyncSplashScreen({ message = 'Actualizando datos...' }: SyncSplashScreenProps) {
  const { t } = useTranslation();
  const [quoteIndex, setQuoteIndex] = useState(() => Math.floor(Math.random() * QUOTES.length));

  useEffect(() => {
    const interval = setInterval(() => {
      setQuoteIndex((prev) => (prev + 1) % QUOTES.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-6 animate-fade-in">
        {/* Logo */}
        <div className="w-20 h-20 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-lg">
          <ChefHat className="w-10 h-10 text-primary-foreground" />
        </div>

        <span className="font-display font-bold text-3xl">{t('integrations.SyncSplashScreen.josephine')}</span>

        {/* Spinner */}
        <Loader2 className="w-6 h-6 animate-spin text-primary" />

        {/* Status message */}
        <p className="text-sm text-muted-foreground">{message}</p>

        {/* Rotating quote */}
        <p
          key={quoteIndex}
          className="text-sm text-muted-foreground/70 italic max-w-sm text-center animate-fade-in"
        >
          {QUOTES[quoteIndex]}
        </p>
      </div>
    </div>
  );
}
