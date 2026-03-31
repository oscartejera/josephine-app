/**
 * HeroSection — Landing page hero (2-column: text + photo)
 * 
 * Dark background, split layout:
 * - Left (40%): G2 badge, serif italic headline, body, 2 CTAs
 * - Right (60%): Lifestyle restaurant photo with widget overlay
 * 
 * GSAP: SplitText headline reveal, photo scale pop, widget delay pop
 */
import { useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Play, Star } from 'lucide-react';
import { gsap, SplitText, useGSAP } from '@/lib/gsap';

export function HeroSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const subRef = useRef<HTMLParagraphElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const badgeRef = useRef<HTMLDivElement>(null);
  const photoRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const isEs = i18n.language === 'es' || i18n.language === 'ca';

  useGSAP(() => {
    if (!containerRef.current || !headlineRef.current) return;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const split = new SplitText(headlineRef.current, { type: 'words' });

    // Safe set+to pattern — prevents elements staying invisible
    gsap.set(badgeRef.current, { autoAlpha: 0, y: 20 });
    gsap.set(split.words, { autoAlpha: 0, y: 50 });
    gsap.set(subRef.current, { autoAlpha: 0, y: 25 });
    const ctaChildren = ctaRef.current?.children ? Array.from(ctaRef.current.children) : [];
    if (ctaChildren.length) gsap.set(ctaChildren, { autoAlpha: 0, y: 20 });
    gsap.set(photoRef.current, { autoAlpha: 0, scale: 0.95 });
    gsap.set(widgetRef.current, { autoAlpha: 0, y: 20, scale: 0.9 });

    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

    tl.to(badgeRef.current, {
      autoAlpha: 1, y: 0, duration: 0.6,
    })
    .to(split.words, {
      autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.06,
    }, '-=0.3')
    .to(subRef.current, {
      autoAlpha: 1, y: 0, duration: 0.6,
    }, '-=0.3')
    .to(ctaChildren, {
      autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.1,
    }, '-=0.2')
    .to(photoRef.current, {
      autoAlpha: 1, scale: 1, duration: 0.8, ease: 'power2.out',
    }, '-=0.6')
    .to(widgetRef.current, {
      autoAlpha: 1, y: 0, scale: 1, duration: 0.6, ease: 'power2.out',
    }, '-=0.2');

    return () => { split.revert(); };
  }, { scope: containerRef });

  return (
    <section
      ref={containerRef}
      className="l-section-dark l-hero"
    >
      <div className="l-hero-inner">
        {/* Text side */}
        <div className="l-hero-text">
          {/* G2 Badge */}
          <div ref={badgeRef} className="l-badge-dark" style={{ alignSelf: 'flex-start' }}>
            <Star className="w-3.5 h-3.5" style={{ color: '#FBBF24', fill: '#FBBF24' }} />
            <span style={{ fontSize: 13 }}>
              {isEs ? 'Líder en Software de Restauración' : 'Top performer in Restaurant Management'}
            </span>
            <span style={{ fontWeight: 700, fontSize: 13 }}>4.8</span>
          </div>

          {/* Headline */}
          <h1
            ref={headlineRef}
            className="l-headline-hero l-headline-glow"
          >
            {isEs
              ? 'El ingrediente secreto de la rentabilidad.'
              : "Profitability's secret ingredient."
            }
          </h1>

          {/* Body */}
          <p ref={subRef} className="l-body-light" style={{ maxWidth: 500 }}>
            {isEs
              ? 'Optimiza todas tus operaciones. Mejora tus márgenes. Reduce la merma. El sistema de gestión de restaurantes con IA que te da control total de tu negocio, todo en un solo lugar.'
              : 'Streamline your entire operations. Boost your margins. Cut waste. The AI-powered restaurant management system that serves up full control of your business, all in one place.'
            }
          </p>

          {/* CTAs */}
          <div ref={ctaRef} className="l-flex l-gap-16" style={{ flexWrap: 'wrap' }}>
            <Link to="/book-a-chat" className="l-btn-primary">
              {isEs ? 'Reservar demo' : 'Book a chat'}
            </Link>
            <button
              onClick={() => {/* Product tour */}}
              className="l-btn-ghost"
            >
              <Play className="w-4 h-4" />
              {isEs ? 'Ver tour del producto' : 'Watch product tour'}
            </button>
          </div>
        </div>

        {/* Photo side */}
        <div ref={photoRef} className="l-hero-photo">
          <img
            src="https://images.unsplash.com/photo-1600565193348-f74bd3c7ccdf?w=800&q=80"
            alt={isEs ? 'Chef gestionando su restaurante con tablet' : 'Chef managing restaurant with tablet'}
            loading="eager"
          />
          {/* Widget overlay */}
          <div ref={widgetRef} className="l-hero-widget">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22C55E' }} />
              <span style={{ fontWeight: 600, color: 'var(--l-text-dark)' }}>
                {isEs ? 'Inventario' : 'Inventory'}
              </span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--l-text-muted-dark)', lineHeight: 1.4, margin: 0 }}>
              {isEs
                ? '2 recetas de tu menú están por debajo del GP% objetivo del 70%'
                : '2 recipes in your menu are below the GP% target of 70%'
              }
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
