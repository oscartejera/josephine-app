import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { gsap, useGSAP } from '@/lib/gsap';

export function FigureSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const { i18n } = useTranslation();
  const isEs = i18n.language === 'es';

  const capabilities = [
    {
      icon: '👁️',
      en: 'Sees problems before you do',
      es: 'Ve los problemas antes que tú',
    },
    {
      icon: '🔮',
      en: 'Knows what will happen tomorrow',
      es: 'Sabe qué va a pasar mañana',
    },
    {
      icon: '⚡',
      en: 'Coordinates team, costs & service without friction',
      es: 'Coordina equipo, costes y servicio sin fricción',
    },
    {
      icon: '🎯',
      en: 'Turns operational chaos into precision',
      es: 'Convierte caos operativo en precisión',
    },
  ];

  useGSAP(() => {
    if (!sectionRef.current) return;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const items = sectionRef.current.querySelectorAll('.capability-item');
    const quote = sectionRef.current.querySelector('.figure-quote');

    gsap.from(items, {
      x: -30,
      opacity: 0,
      duration: 0.6,
      stagger: 0.15,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: sectionRef.current,
        start: 'top 65%',
      },
    });

    if (quote) {
      gsap.from(quote, {
        y: 20,
        opacity: 0,
        duration: 0.8,
        delay: 0.6,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: quote,
          start: 'top 85%',
        },
      });
    }
  }, { scope: sectionRef });

  return (
    <section
      ref={sectionRef}
      style={{ background: 'linear-gradient(180deg, var(--landing-bg) 0%, var(--landing-surface) 100%)' }}
    >
      <div className="landing-section">
        {/* Title */}
        <div className="text-center mb-4">
          <p className="landing-body-sm uppercase tracking-[0.2em] mb-4" style={{ color: 'var(--brand-violet-soft)' }}>
            {isEs ? 'No es software. Es una figura.' : 'Not software. A figure.'}
          </p>
          <h2 className="landing-section-title mb-16">
            {isEs ? 'Josephine es la que:' : 'Josephine is the one who:'}
          </h2>
        </div>

        {/* Capabilities */}
        <div className="max-w-[640px] mx-auto mb-16">
          {capabilities.map((cap, i) => (
            <div key={i} className="capability-item landing-capability">
              <div className="landing-capability-icon">
                {cap.icon}
              </div>
              <p className="text-lg font-medium" style={{ color: 'var(--landing-text)', paddingTop: '10px' }}>
                {isEs ? cap.es : cap.en}
              </p>
            </div>
          ))}
        </div>

        {/* Quote */}
        <div className="figure-quote text-center max-w-[600px] mx-auto">
          <p className="landing-quote" style={{ color: 'var(--landing-muted)' }}>
            {isEs
              ? '"El COO que todos los restaurantes deberían tener, pero en forma de sistema."'
              : '"The COO every restaurant should have, but as a system."'}
          </p>
        </div>
      </div>
    </section>
  );
}
