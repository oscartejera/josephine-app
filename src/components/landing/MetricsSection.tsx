import { useRef, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { gsap, ScrollTrigger, useGSAP } from '@/lib/gsap';

interface MetricProps {
  value: string;
  label: string;
  suffix?: string;
  prefix?: string;
  numericValue: number;
}

function AnimatedMetric({ value, label, numericValue, suffix = '', prefix = '' }: MetricProps) {
  const ref = useRef<HTMLDivElement>(null);
  const numberRef = useRef<HTMLSpanElement>(null);
  const [displayVal, setDisplayVal] = useState('0');

  useEffect(() => {
    if (!ref.current || !numberRef.current) return;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced) {
      setDisplayVal(value);
      return;
    }

    const obj = { val: 0 };
    const st = ScrollTrigger.create({
      trigger: ref.current,
      start: 'top 80%',
      once: true,
      onEnter: () => {
        gsap.to(obj, {
          val: numericValue,
          duration: 2,
          ease: 'power2.out',
          onUpdate: () => {
            const v = Math.round(obj.val * 10) / 10;
            if (numericValue >= 1000) {
              setDisplayVal(prefix + v.toLocaleString() + suffix);
            } else {
              setDisplayVal(prefix + v + suffix);
            }
          }
        });
      },
    });

    return () => st.kill();
  }, [numericValue, value, suffix, prefix]);

  return (
    <div ref={ref} className="metric-item">
      <span ref={numberRef} className="landing-metric-value">{displayVal}</span>
      <p className="landing-metric-label">{label}</p>
    </div>
  );
}

export function MetricsSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const { i18n } = useTranslation();
  const isEs = i18n.language === 'es';

  const metrics = [
    {
      value: '-32%',
      numericValue: 32,
      prefix: '-',
      suffix: '%',
      labelEn: 'Food Waste Reduction',
      labelEs: 'Reducción de mermas',
    },
    {
      value: '+15%',
      numericValue: 15,
      prefix: '+',
      suffix: '%',
      labelEn: 'Gross Profit Increase',
      labelEs: 'Mejora en margen bruto',
    },
    {
      value: '2.3x',
      numericValue: 2.3,
      prefix: '',
      suffix: 'x',
      labelEn: 'ROI in 6 months',
      labelEs: 'ROI en 6 meses',
    },
    {
      value: '4500+',
      numericValue: 4500,
      prefix: '',
      suffix: '+',
      labelEn: 'AI decisions per day',
      labelEs: 'Decisiones IA al día',
    },
  ];

  useGSAP(() => {
    if (!sectionRef.current) return;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const items = sectionRef.current.querySelectorAll('.metric-item');
    gsap.from(items, {
      y: 30,
      opacity: 0,
      duration: 0.6,
      stagger: 0.1,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: sectionRef.current,
        start: 'top 75%',
      },
    });
  }, { scope: sectionRef });

  return (
    <section ref={sectionRef} style={{ background: 'var(--landing-bg)' }}>
      <div className="landing-section">
        <div className="text-center mb-16">
          <h2 className="landing-section-title">
            {isEs ? 'Resultados que hablan.' : 'Results that speak.'}
          </h2>
        </div>

        <div className="landing-metrics-grid">
          {metrics.map((m, i) => (
            <AnimatedMetric
              key={i}
              value={m.value}
              numericValue={m.numericValue}
              prefix={m.prefix}
              suffix={m.suffix}
              label={isEs ? m.labelEs : m.labelEn}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
