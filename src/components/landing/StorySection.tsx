import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { gsap, ScrollTrigger, useGSAP } from '@/lib/gsap';

const storyBlocks = [
  {
    textKey: 'landing.storyBefore',
    defaultText: 'Before dashboards existed, before KPIs or forecasting, there was something more important:',
    highlights: [],
  },
  {
    textKey: 'landing.storyThreeWords',
    defaultText: '',
    highlights: ['control.', 'intuition.', 'flawless execution.'],
    highlightsEs: ['control.', 'intuición.', 'ejecución impecable.'],
  },
  {
    textKey: 'landing.storyNapoleon',
    defaultText: 'While Napoleon conquered territories, Joséphine managed the invisible empire:',
    highlights: [],
  },
  {
    textKey: 'landing.storyDetails',
    defaultText: '',
    details: [
      { en: 'the order of the palace', es: 'el orden del palacio' },
      { en: 'coordinating hundreds of people', es: 'la coordinación de cientos de personas' },
      { en: 'the flawless experience of every guest', es: 'la experiencia impecable de cada invitado' },
      { en: 'resources, timing, every detail', es: 'los recursos, el timing, el detalle' },
    ],
  },
  {
    textKey: 'landing.storyNotAesthetics',
    defaultText: "It wasn't aesthetics. It was high-level operations.",
    highlights: [],
  },
];

export function StorySection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const { t, i18n } = useTranslation();
  const isEs = i18n.language === 'es';

  useGSAP(() => {
    if (!sectionRef.current) return;

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const blocks = sectionRef.current.querySelectorAll('.story-block');

    blocks.forEach((block) => {
      gsap.fromTo(block,
        { opacity: 0, y: 60 },
        {
          opacity: 1,
          y: 0,
          duration: 1,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: block,
            start: 'top 80%',
            end: 'top 30%',
            scrub: 1,
          },
        }
      );
    });

    // Highlight words
    const keywords = sectionRef.current.querySelectorAll('.story-keyword');
    keywords.forEach((kw) => {
      gsap.fromTo(kw,
        { opacity: 0, y: 30, scale: 0.95 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.6,
          scrollTrigger: {
            trigger: kw,
            start: 'top 85%',
            end: 'top 50%',
            scrub: 1,
          },
        }
      );
    });
  }, { scope: sectionRef });

  return (
    <section
      id="story"
      ref={sectionRef}
      style={{ background: 'var(--landing-bg)' }}
    >
      {/* Block 1: Before dashboards */}
      <div className="landing-story-block story-block">
        <p className="landing-quote max-w-[700px]">
          {isEs
            ? 'Antes de que existieran los dashboards, los KPIs o el forecasting, había algo más importante:'
            : 'Before dashboards existed, before KPIs or forecasting, there was something more important:'}
        </p>
      </div>

      {/* Block 2: Three words */}
      <div className="landing-story-block story-block">
        <div className="flex flex-col items-center gap-4">
          {(isEs
            ? ['control.', 'intuición.', 'ejecución impecable.']
            : ['control.', 'intuition.', 'flawless execution.']
          ).map((word, i) => (
            <span
              key={i}
              className="story-keyword landing-hero-text"
              style={{ color: 'var(--brand-violet-soft)', fontSize: 'clamp(32px, 5vw, 64px)' }}
            >
              {word}
            </span>
          ))}
        </div>
      </div>

      {/* Block 3: Napoleon */}
      <div className="landing-story-block story-block">
        <p className="landing-quote max-w-[700px]">
          {isEs
            ? 'Mientras Napoleón conquistaba territorios, Joséphine gestionaba el imperio invisible:'
            : 'While Napoleon conquered territories, Joséphine managed the invisible empire:'}
        </p>
      </div>

      {/* Block 4: Details list */}
      <div className="landing-story-block story-block">
        <div className="flex flex-col items-center gap-3 max-w-[600px]">
          {[
            { en: 'the order of the palace', es: 'el orden del palacio' },
            { en: 'coordinating hundreds of people', es: 'la coordinación de cientos de personas' },
            { en: 'the flawless experience of every guest', es: 'la experiencia impecable de cada invitado' },
            { en: 'resources, timing, every detail', es: 'los recursos, el timing, el detalle' },
          ].map((item, i) => (
            <p key={i} className="story-keyword landing-body text-center" style={{ color: 'var(--landing-muted)', fontSize: '20px' }}>
              → {isEs ? item.es : item.en}
            </p>
          ))}
        </div>
      </div>

      {/* Block 5: Not aesthetics */}
      <div className="landing-story-block story-block">
        <p className="landing-section-title max-w-[700px]" style={{ color: 'var(--landing-text)' }}>
          {isEs
            ? 'No era estética. Era operación de alto nivel.'
            : "It wasn't aesthetics. It was high-level operations."}
        </p>
      </div>
    </section>
  );
}
