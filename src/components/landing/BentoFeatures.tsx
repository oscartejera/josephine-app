import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { gsap, useGSAP } from '@/lib/gsap';
import { BarChart3, TrendingUp, Shield, Users, Brain } from 'lucide-react';

export function BentoFeatures() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const { i18n } = useTranslation();
  const isEs = i18n.language === 'es';

  useGSAP(() => {
    if (!sectionRef.current) return;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const cards = sectionRef.current.querySelectorAll('.bento-card');

    gsap.from(cards, {
      y: 50,
      opacity: 0,
      scale: 0.96,
      duration: 0.7,
      stagger: 0.12,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: sectionRef.current,
        start: 'top 70%',
      },
    });
  }, { scope: sectionRef });

  const features = [
    {
      icon: <BarChart3 className="w-6 h-6" />,
      titleEn: 'Control Tower',
      titleEs: 'Torre de Control',
      descEn: 'She adjusts your team before the rush.',
      descEs: 'Ajusta tu equipo antes del rush.',
      gradient: 'from-violet-500/20 to-violet-900/10',
    },
    {
      icon: <TrendingUp className="w-6 h-6" />,
      titleEn: 'Forecast Engine',
      titleEs: 'Motor de Predicción',
      descEn: 'She decides how much to buy tomorrow.',
      descEs: 'Decide cuánto comprar mañana.',
      gradient: 'from-blue-500/20 to-blue-900/10',
    },
    {
      icon: <Brain className="w-6 h-6" />,
      titleEn: 'Margin Guardian',
      titleEs: 'Guardián de Margen',
      descEn: "She detects you're losing margin today.",
      descEs: 'Detecta que estás perdiendo margen hoy.',
      gradient: 'from-emerald-500/20 to-emerald-900/10',
    },
    {
      icon: <Shield className="w-6 h-6" />,
      titleEn: 'Reputation Shield',
      titleEs: 'Escudo de Reputación',
      descEn: "She protects your reputation before it's too late.",
      descEs: 'Protege tu reputación antes de que sea tarde.',
      gradient: 'from-amber-500/20 to-amber-900/10',
    },
  ];

  return (
    <section ref={sectionRef} style={{ background: 'var(--landing-surface)' }}>
      <div className="landing-section">
        {/* Header */}
        <div className="text-center mb-4">
          <p className="landing-body-sm uppercase tracking-[0.2em] mb-4" style={{ color: 'var(--brand-violet-soft)' }}>
            {isEs ? 'No vendemos features' : "We don't sell features"}
          </p>
          <h2 className="landing-section-title mb-4">
            {isEs ? 'Vendemos control.' : 'We sell control.'}
          </h2>
          <p className="landing-body max-w-[500px] mx-auto mb-16">
            {isEs
              ? 'No vendemos datos — vendemos decisiones. No vendemos software — vendemos ejecución.'
              : "We don't sell data — we sell decisions. We don't sell software — we sell execution."}
          </p>
        </div>

        {/* Bento Grid */}
        <div className="landing-bento-grid mb-8">
          {features.map((f, i) => (
            <div key={i} className={`bento-card landing-bento-card bg-gradient-to-br ${f.gradient}`}>
              {/* Icon */}
              <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-6"
                   style={{ color: 'var(--brand-violet-soft)' }}>
                {f.icon}
              </div>

              {/* Title */}
              <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--landing-text)' }}>
                {isEs ? f.titleEs : f.titleEn}
              </h3>

              {/* Description */}
              <p className="text-base" style={{ color: 'var(--landing-muted)' }}>
                {isEs ? f.descEs : f.descEn}
              </p>

              {/* Decorative glow */}
              <div
                className="absolute -bottom-20 -right-20 w-40 h-40 rounded-full opacity-20 blur-3xl pointer-events-none"
                style={{ background: 'var(--brand-violet)' }}
              />
            </div>
          ))}
        </div>

        {/* Full-width card: Workforce */}
        <div className="bento-card landing-bento-card full-width bg-gradient-to-br from-violet-500/10 to-purple-900/10">
          <div className="flex items-start gap-6 flex-wrap">
            <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0"
                 style={{ color: 'var(--brand-violet-soft)' }}>
              <Users className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-[250px]">
              <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--landing-text)' }}>
                {isEs ? 'Comandante de Workforce' : 'Workforce Commander'}
              </h3>
              <p className="text-base" style={{ color: 'var(--landing-muted)' }}>
                {isEs
                  ? 'Coordina equipo, scheduling y payroll. Un sistema. Cero fricción.'
                  : 'Coordinates team, scheduling, and payroll. One system. Zero friction.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
