import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { gsap, useGSAP } from '@/lib/gsap';

export function ProblemSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const { i18n } = useTranslation();
  const isEs = i18n.language === 'es';

  const pains = [
    {
      icon: '⚠️',
      en: 'Poor coordination',
      es: 'Mala coordinación',
    },
    {
      icon: '🔮',
      en: 'Lack of foresight',
      es: 'Falta de previsión',
    },
    {
      icon: '🔥',
      en: 'Reactive decisions',
      es: 'Decisiones reactivas',
    },
    {
      icon: '📡',
      en: 'No real-time control',
      es: 'Sin control en tiempo real',
    },
  ];

  useGSAP(() => {
    if (!sectionRef.current) return;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const cards = sectionRef.current.querySelectorAll('.pain-card');
    const birthText = sectionRef.current.querySelector('.birth-text');

    gsap.from(cards, {
      y: 40,
      opacity: 0,
      duration: 0.6,
      stagger: 0.12,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: sectionRef.current,
        start: 'top 70%',
      },
    });

    if (birthText) {
      gsap.from(birthText, {
        scale: 0.9,
        opacity: 0,
        duration: 0.8,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: birthText,
          start: 'top 80%',
        },
      });
    }
  }, { scope: sectionRef });

  return (
    <section ref={sectionRef} style={{ background: 'var(--landing-bg)' }}>
      <div className="landing-section">
        {/* Headline */}
        <div className="text-center mb-16 max-w-[700px] mx-auto">
          <h2 className="landing-section-title mb-4">
            {isEs
              ? 'Un restaurante no falla por la cocina.'
              : "A restaurant doesn't fail because of the kitchen."}
          </h2>
          <p className="landing-body text-xl">
            {isEs
              ? 'Falla por lo mismo que cualquier imperio:'
              : 'It fails for the same reason every empire falls:'}
          </p>
        </div>

        {/* Pain cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-20">
          {pains.map((pain, i) => (
            <div key={i} className="pain-card landing-pain-card">
              <span className="text-3xl mb-3 block">{pain.icon}</span>
              <p className="font-semibold text-[var(--landing-text)]">
                {isEs ? pain.es : pain.en}
              </p>
            </div>
          ))}
        </div>

        {/* Birth statement */}
        <div className="birth-text text-center max-w-[600px] mx-auto">
          <p className="landing-section-title" style={{ color: 'var(--brand-violet-soft)' }}>
            {isEs
              ? 'Y aquí es donde nace Josephine.'
              : 'And this is where Josephine is born.'}
          </p>
        </div>
      </div>
    </section>
  );
}
