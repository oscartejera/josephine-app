import { useEffect, useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChefHat, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';

export function LandingNavbar() {
  const [scrolled, setScrolled] = useState(false);
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const toggleLang = () => {
    const next = i18n.language === 'es' ? 'en' : 'es';
    i18n.changeLanguage(next);
  };

  return (
    <nav className={cn('landing-navbar', scrolled && 'scrolled')}>
      <div className="landing-navbar-inner">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 text-white no-underline">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center">
            <ChefHat className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight">Josephine</span>
        </Link>

        {/* Right actions */}
        <div className="flex items-center gap-3">
          {/* Language toggle */}
          <button
            onClick={toggleLang}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-[var(--landing-muted)] hover:text-white transition-colors bg-transparent border-none cursor-pointer"
            aria-label="Toggle language"
          >
            <Globe className="w-4 h-4" />
            <span>{i18n.language === 'es' ? 'EN' : 'ES'}</span>
          </button>

          {/* Login */}
          <button
            onClick={() => navigate('/login')}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-transparent border-none cursor-pointer hover:text-[var(--brand-violet-soft)] transition-colors"
          >
            {t('landing.login', 'Login')}
          </button>

          {/* Demo CTA */}
          <button
            onClick={() => navigate('/login')}
            className="px-5 py-2 rounded-lg text-sm font-semibold text-white bg-[var(--brand-violet)] hover:bg-[var(--brand-violet-dark)] transition-all cursor-pointer border-none hover:shadow-[0_4px_20px_rgba(124,58,237,0.4)]"
          >
            {t('landing.tryDemo', 'Try Demo')}
          </button>
        </div>
      </div>
    </nav>
  );
}
