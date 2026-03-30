import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { gsap, SplitText, useGSAP } from '@/lib/gsap';
import { ChefHat } from 'lucide-react';

export function CtaSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const quoteRef = useRef<HTMLQuoteElement>(null);
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const isEs = i18n.language === 'es';

  useGSAP(() => {
    if (!sectionRef.current || !quoteRef.current) return;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const split = new SplitText(quoteRef.current, { type: 'lines' });

    gsap.from(split.lines, {
      y: 30,
      opacity: 0,
      duration: 0.8,
      stagger: 0.15,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: quoteRef.current,
        start: 'top 75%',
      },
    });

    const cta = sectionRef.current.querySelector('.cta-btn');
    const tagline = sectionRef.current.querySelector('.cta-tagline');

    if (cta) {
      gsap.from(cta, {
        y: 20,
        opacity: 0,
        duration: 0.6,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: cta,
          start: 'top 90%',
        },
      });
    }

    if (tagline) {
      gsap.from(tagline, {
        opacity: 0,
        duration: 1,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: tagline,
          start: 'top 95%',
        },
      });
    }

    return () => {
      split.revert();
    };
  }, { scope: sectionRef });

  return (
    <section ref={sectionRef}>
      {/* Gradient CTA area */}
      <div className="landing-cta-section">
        <blockquote ref={quoteRef} className="landing-quote max-w-[700px] mx-auto mb-14">
          {isEs
            ? '"Detrás de cada gran imperio, hubo alguien gestionando los detalles. Detrás de cada gran restaurante, debería estar Josephine."'
            : '"Behind every great empire, there was someone managing the details. Behind every great restaurant, there should be Josephine."'}
        </blockquote>

        <button
          className="cta-btn landing-cta-btn"
          onClick={() => navigate('/login')}
        >
          {isEs ? 'Empieza a gestionar tu imperio.' : 'Start running your empire.'}
        </button>

        <p className="cta-tagline mt-8 text-base" style={{ color: 'rgba(255,255,255,0.6)' }}>
          {isEs ? 'Del caos al control.' : 'From chaos to control.'}
        </p>
      </div>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="max-w-[1200px] mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center">
              <ChefHat className="w-3 h-3 text-white" />
            </div>
            <span className="font-semibold text-sm" style={{ color: 'var(--landing-text)' }}>Josephine AI</span>
          </div>
          <p>© {new Date().getFullYear()} Josephine AI. {isEs ? 'Todos los derechos reservados.' : 'All rights reserved.'}</p>
        </div>
      </footer>
    </section>
  );
}
