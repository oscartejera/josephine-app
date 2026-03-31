/**
 * MegaMenu — Premium navbar with dropdown panels
 * 
 * Structure: Logo | Nav items (Product+, Solutions+, About+, Success Stories, Resources+) | Login | Book a chat
 * Dropdown: cream panel with columns of items + success story card
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChefHat, ChevronDown, X, Globe, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { megaMenuItems, megaMenuSuccessStory, type LandingMegaMenuItem } from '@/data/landing/landingRoutes';
import { MegaMenuPanel } from './MegaMenuPanel';

export function MegaMenu() {
  const [scrolled, setScrolled] = useState(false);
  const [activePanel, setActivePanel] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const isEs = i18n.language === 'es' || i18n.language === 'ca';

  // Close panel on route change
  useEffect(() => {
    setActivePanel(null);
    setMobileOpen(false);
  }, [location.pathname]);

  // Scroll detection
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close on click outside
  useEffect(() => {
    if (!activePanel) return;
    const handler = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setActivePanel(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [activePanel]);

  // Close on Escape
  useEffect(() => {
    if (!activePanel) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActivePanel(null);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [activePanel]);

  const togglePanel = useCallback((key: string) => {
    setActivePanel(prev => prev === key ? null : key);
  }, []);

  const toggleLang = () => {
    const next = i18n.language === 'es' ? 'en' : 'es';
    i18n.changeLanguage(next);
  };

  return (
    <nav ref={navRef} className={cn('l-navbar', scrolled && 'scrolled')} role="navigation" aria-label="Main navigation">
      <div className="l-navbar-inner">
        {/* Logo */}
        <Link to="/" className="l-navbar-logo" aria-label="Josephine Home">
          <div className="l-navbar-logo-icon">
            <ChefHat className="w-4 h-4 text-white" />
          </div>
          <span>Josephine</span>
        </Link>

        {/* Desktop Nav */}
        <ul className="l-navbar-nav" role="menubar" style={{ display: 'var(--desktop-nav-display, flex)' }}>
          {megaMenuItems.map((item) => {
            if (item.href && !item.sections) {
              // Simple link (Success Stories)
              return (
                <li key={item.key} role="none">
                  <Link
                    to={item.href}
                    className={cn('l-navbar-item', location.pathname === item.href && 'active')}
                    role="menuitem"
                  >
                    {isEs ? item.labelEs : item.label}
                  </Link>
                </li>
              );
            }

            // Dropdown item
            const isOpen = activePanel === item.key;
            return (
              <li key={item.key} role="none">
                <button
                  className={cn('l-navbar-item', isOpen && 'active')}
                  onClick={() => togglePanel(item.key)}
                  aria-expanded={isOpen}
                  aria-haspopup="true"
                  role="menuitem"
                >
                  {isEs ? item.labelEs : item.label}
                  {isOpen ? (
                    <X className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        {/* Right Actions */}
        <div className="l-navbar-actions">
          {/* Language toggle */}
          <button
            onClick={toggleLang}
            className="l-navbar-item"
            aria-label="Toggle language"
            style={{ padding: '8px 12px' }}
          >
            <Globe className="w-4 h-4" />
            <span style={{ fontSize: 13 }}>{i18n.language === 'es' ? 'EN' : 'ES'}</span>
          </button>

          {/* Login */}
          <button
            onClick={() => navigate('/login')}
            className="l-navbar-item"
            style={{ padding: '8px 16px' }}
          >
            {isEs ? 'Acceder' : 'Login'}
          </button>

          {/* Book a chat CTA */}
          <Link to="/book-a-chat" className="l-btn-primary" style={{ padding: '10px 20px', fontSize: 14 }}>
            {isEs ? 'Reservar demo' : 'Book a chat'}
          </Link>

          {/* Mobile hamburger */}
          <button
            className="l-navbar-item"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
            style={{
              display: 'none', // Hidden on desktop, shown via CSS media query
              padding: '8px',
            }}
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Dropdown Panels */}
      {megaMenuItems.map((item) => {
        if (!item.sections) return null;
        return (
          <MegaMenuPanel
            key={item.key}
            item={item}
            isOpen={activePanel === item.key}
            isEs={isEs}
            successStory={megaMenuSuccessStory}
            onClose={() => setActivePanel(null)}
          />
        );
      })}
    </nav>
  );
}
