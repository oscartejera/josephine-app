/**
 * LandingFooter — Universal footer with sitemap + kinetic text
 * 
 * Structure:
 * - Row 1: Logo + 4 columns (Home, Product, Modules, About)
 * - Row 2: 4 columns (Get in touch, Resources, Follow us, Solutions)
 * - Legal bar: Copyright + Terms + Privacy + Cookies
 * - Kinetic text: "No profit lost." massive lavender, inverse parallax
 */
import { Link } from 'react-router-dom';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ChefHat } from 'lucide-react';
import { gsap, ScrollTrigger, useGSAP } from '@/lib/gsap';
import { footerLinks } from '@/data/landing/landingRoutes';

export function LandingFooter() {
  const { i18n } = useTranslation();
  const isEs = i18n.language === 'es' || i18n.language === 'ca';
  const kineticRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLElement>(null);

  // Inverse parallax on kinetic text (moves at 0.3x scroll speed)
  useGSAP(() => {
    if (!kineticRef.current) return;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    gsap.to(kineticRef.current, {
      yPercent: -30,
      ease: 'none',
      scrollTrigger: {
        trigger: footerRef.current,
        start: 'top bottom',
        end: 'bottom top',
        scrub: 0.5,
      },
    });
  }, { scope: footerRef });

  const year = new Date().getFullYear();

  return (
    <footer ref={footerRef} className="l-footer">
      {/* Row 1: Main sitemap */}
      <div className="l-footer-grid">
        {/* Logo column */}
        <div>
          <Link to="/" className="l-navbar-logo" style={{ color: 'var(--l-text-white)', marginBottom: 16 }}>
            <div className="l-navbar-logo-icon">
              <ChefHat className="w-4 h-4 text-white" />
            </div>
            <span>Josephine</span>
          </Link>
        </div>

        {/* Link columns */}
        {footerLinks.main.map((col) => (
          <div key={col.heading}>
            <div className="l-footer-heading">{isEs ? col.headingEs : col.heading}</div>
            {col.links.map((link) => (
              <Link key={link.href} to={link.href} className="l-footer-link">
                {isEs ? link.labelEs : link.label}
              </Link>
            ))}
          </div>
        ))}
      </div>

      {/* Row 2: Secondary links */}
      <div className="l-footer-grid-secondary">
        {footerLinks.secondary.map((col) => (
          <div key={col.heading}>
            <div className="l-footer-heading">{isEs ? col.headingEs : col.heading}</div>
            {col.links.map((link) => {
              const isExternal = link.href.startsWith('http');
              if (isExternal) {
                return (
                  <a
                    key={link.href}
                    href={link.href}
                    className="l-footer-link"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {isEs ? link.labelEs : link.label}
                  </a>
                );
              }
              return (
                <Link key={link.href} to={link.href} className="l-footer-link">
                  {isEs ? link.labelEs : link.label}
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      {/* Legal bar */}
      <div className="l-footer-legal">
        <span>© {year} Josephine AI. {isEs ? 'Todos los derechos reservados.' : 'All Rights Reserved.'}</span>
        <div style={{ display: 'flex', gap: 24 }}>
          <Link to="/legal/privacy">
            {isEs ? 'Privacidad' : 'Terms and Privacy'}
          </Link>
          <Link to="/legal/privacy">
            {isEs ? 'Términos y Condiciones' : 'Terms and Conditions'}
          </Link>
          <button
            onClick={() => {/* Cookie preferences modal */}}
            style={{ background: 'none', border: 'none', cursor: 'pointer', font: 'inherit' }}
          >
            {isEs ? 'Preferencias de Cookies' : 'Cookie Preferences'}
          </button>
        </div>
      </div>

      {/* Kinetic text banner */}
      <div className="l-footer-kinetic">
        <div ref={kineticRef} className="l-footer-kinetic-text">
          {isEs ? 'Sin perder un euro.' : 'No profit lost.'}
        </div>
      </div>
    </footer>
  );
}
