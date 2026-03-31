/**
 * FloatingCTA — Fixed bottom-right "Book a chat" button
 * 
 * Appears after 300px scroll, with lavender pill style.
 * Links to /book-a-chat conversion page.
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export function FloatingCTA() {
  const [visible, setVisible] = useState(false);
  const { i18n } = useTranslation();
  const isEs = i18n.language === 'es' || i18n.language === 'ca';

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 300);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <Link
      to="/book-a-chat"
      className={cn('l-floating-cta', visible && 'visible')}
      aria-label={isEs ? 'Reservar una demo' : 'Book a chat'}
    >
      {isEs ? 'Reservar demo' : 'Book a chat'}
      <MessageCircle className="w-4 h-4" />
    </Link>
  );
}
