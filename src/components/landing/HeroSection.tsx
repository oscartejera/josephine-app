import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChefHat, ArrowDown } from 'lucide-react';
import { gsap, SplitText, useGSAP } from '@/lib/gsap';

export function HeroSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const subRef = useRef<HTMLParagraphElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { t } = useTranslation();

  useGSAP(() => {
    if (!containerRef.current || !headlineRef.current) return;

    // Check for reduced motion
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

    // Split headline into words
    const split = new SplitText(headlineRef.current, { type: 'words' });

    tl.from(logoRef.current, {
      scale: 0.5,
      opacity: 0,
      filter: 'blur(20px)',
      duration: 0.8,
      ease: 'power2.out',
    })
    .from(split.words, {
      y: 50,
      opacity: 0,
      duration: 0.7,
      stagger: 0.08,
      ease: 'power3.out',
    }, '-=0.3')
    .from(subRef.current, {
      y: 25,
      opacity: 0,
      duration: 0.6,
    }, '-=0.3')
    .from(ctaRef.current?.children ? Array.from(ctaRef.current.children) : [], {
      y: 20,
      opacity: 0,
      duration: 0.5,
      stagger: 0.1,
    }, '-=0.2')
    .from(scrollRef.current, {
      opacity: 0,
      duration: 0.5,
    }, '-=0.1');

    return () => {
      split.revert();
    };
  }, { scope: containerRef });

  return (
    <section
      ref={containerRef}
      className="relative min-h-screen flex flex-col items-center justify-center px-6 text-center"
      style={{ background: 'var(--landing-bg)' }}
    >
      {/* Logo */}
      <div
        ref={logoRef}
        className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center mb-8 shadow-[0_0_60px_rgba(124,58,237,0.3)]"
      >
        <ChefHat className="w-8 h-8 text-white" />
      </div>

      {/* Headline */}
      <h1
        ref={headlineRef}
        className="landing-hero-text max-w-[900px] mb-6"
      >
        {t('landing.heroTitle', 'Run your restaurant like an empire.')}
      </h1>

      {/* Subtitle */}
      <p
        ref={subRef}
        className="landing-body text-lg max-w-[600px] mb-10"
      >
        {t('landing.heroSubtitle', "Your restaurant's COO, powered by AI.")}
      </p>

      {/* CTAs */}
      <div ref={ctaRef} className="flex flex-wrap items-center justify-center gap-4">
        <button
          onClick={() => navigate('/login')}
          className="landing-btn-primary"
        >
          {t('landing.heroCta', 'Try Demo Free')}
        </button>
        <a
          href="#story"
          className="landing-btn-ghost"
        >
          {t('landing.heroSecondary', 'Discover the story')}
          <ArrowDown className="w-4 h-4" />
        </a>
      </div>

      {/* Scroll indicator */}
      <div ref={scrollRef} className="landing-scroll-indicator">
        <ArrowDown className="w-5 h-5" />
      </div>
    </section>
  );
}
