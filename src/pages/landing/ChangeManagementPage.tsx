/**
 * ChangeManagementPage — "/product/change-management" landing page
 * 
 * How Josephine manages change: onboarding, training, adoption support.
 */
import { useTranslation } from 'react-i18next';
import { SectionHeadline } from '@/components/landing/SectionHeadline';
import { PreFooterCTA } from '@/components/landing/PreFooterCTA';

const STEPS = [
  {
    step: '01',
    title: 'Discovery & Audit',
    titleEs: 'Descubrimiento y Auditoría',
    description: 'We start by understanding your current operations, pain points, and goals. A full operational audit sets the baseline.',
    descriptionEs: 'Empezamos entendiendo tus operaciones actuales, puntos de dolor y objetivos. Una auditoría operativa completa establece la línea base.',
  },
  {
    step: '02',
    title: 'Tailored Onboarding',
    titleEs: 'Onboarding Personalizado',
    description: 'Your dedicated success manager creates a rollout plan designed for your team size, tech maturity, and business rhythm.',
    descriptionEs: 'Tu success manager dedicado crea un plan de implementación diseñado para el tamaño de tu equipo, madurez tecnológica y ritmo de negocio.',
  },
  {
    step: '03',
    title: 'Hands-On Training',
    titleEs: 'Formación Práctica',
    description: 'We train your managers and team on-site or remotely. Practical, hands-on sessions — not just slides.',
    descriptionEs: 'Formamos a tus gerentes y equipo presencialmente o en remoto. Sesiones prácticas — no solo presentaciones.',
  },
  {
    step: '04',
    title: 'Continuous Support',
    titleEs: 'Soporte Continuo',
    description: 'Post-launch support with regular check-ins, performance reviews, and ongoing optimisation guidance.',
    descriptionEs: 'Soporte post-lanzamiento con seguimientos regulares, revisiones de rendimiento y guía de optimización continua.',
  },
];

export default function ChangeManagementPage() {
  const { i18n } = useTranslation();
  const isEs = i18n.language === 'es' || i18n.language === 'ca';

  return (
    <>
      {/* HERO */}
      <section className="l-section-dark l-hero">
        <div className="l-container l-text-center" style={{ paddingTop: 140, paddingBottom: 80 }}>
          <SectionHeadline
            as="h1"
            variant="hero"
            text={isEs ? 'El cambio no tiene que doler.' : "Change doesn't have to hurt."}
            align="center"
            italic
            color="var(--l-accent-lavender)"
          />
          <p className="l-body-light l-mt-24 l-mx-auto" style={{ maxWidth: 600, textAlign: 'center' }}>
            {isEs
              ? 'Adoptar nueva tecnología puede ser intimidante. Nuestro equipo de éxito del cliente te acompaña en cada paso — desde la auditoría inicial hasta la optimización continua.'
              : 'Adopting new technology can be daunting. Our customer success team walks with you every step — from initial audit to ongoing optimisation.'
            }
          </p>
        </div>
      </section>

      {/* PROCESS STEPS */}
      <section className="l-section-cream" style={{ padding: '100px 24px' }}>
        <div className="l-container">
          <SectionHeadline
            text={isEs ? 'Nuestro proceso en 4 pasos' : 'Our 4-step process'}
            align="center"
            className="l-mx-auto l-mb-48"
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 32 }}>
            {STEPS.map((s) => (
              <div key={s.step} className="l-bento-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{
                    fontSize: 32,
                    fontWeight: 700,
                    fontFamily: 'var(--l-font-serif)',
                    color: 'var(--l-accent-violet)',
                    lineHeight: 1,
                  }}>
                    {s.step}
                  </span>
                  <h3 className="l-headline-card">{isEs ? s.titleEs : s.title}</h3>
                </div>
                <p className="l-body">{isEs ? s.descriptionEs : s.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PROMISE */}
      <section className="l-section-dark" style={{ padding: '100px 24px' }}>
        <div className="l-container l-text-center">
          <SectionHeadline
            text={isEs ? 'Nuestra promesa' : 'Our promise'}
            align="center"
            color="var(--l-accent-lavender)"
            className="l-mx-auto l-mb-48"
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 32, maxWidth: 900, margin: '0 auto' }}>
            {[
              { emoji: '🎯', text: isEs ? 'Implementación en menos de 2 semanas' : 'Implementation in under 2 weeks' },
              { emoji: '👥', text: isEs ? 'Success Manager dedicado' : 'Dedicated Success Manager' },
              { emoji: '📈', text: isEs ? 'ROI positivo desde el primer mes' : 'Positive ROI from month one' },
            ].map((item, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 40, marginBottom: 16 }}>{item.emoji}</div>
                <p className="l-body-light">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <PreFooterCTA />
    </>
  );
}
