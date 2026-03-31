/**
 * AboutPage — "About Josephine" with team, mission, and values
 */
import { useTranslation } from 'react-i18next';
import { SectionHeadline } from '@/components/landing/SectionHeadline';
import { MetricCard } from '@/components/landing/MetricCard';
import { PreFooterCTA } from '@/components/landing/PreFooterCTA';

const TEAM_PHOTOS = [
  'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=300&q=80',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&q=80',
  'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=300&q=80',
  'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=300&q=80',
];

export default function AboutPage() {
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
            text={isEs ? 'Lideramos la Revolución de la Restauración.' : "We're serving up the Restaurant Revolution."}
            align="center"
            italic
            color="var(--l-accent-lavender)"
          />
          <p className="l-body-light l-mt-24 l-mx-auto" style={{ maxWidth: 600, textAlign: 'center' }}>
            {isEs
              ? 'Creemos que la tecnología debería servir a los restaurantes, no al revés. Por eso construimos herramientas que simplifican lo complejo y amplifican lo humano.'
              : "We believe technology should serve restaurants, not the other way around. That's why we build tools that simplify the complex and amplify the human."
            }
          </p>
        </div>
      </section>

      {/* MISSION */}
      <section className="l-section-cream" style={{ padding: '100px 24px' }}>
        <div className="l-container" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60, alignItems: 'center' }}>
          <div>
            <SectionHeadline text={isEs ? 'Nuestra misión' : 'Our mission'} variant="section" />
            <p className="l-body l-mt-24">
              {isEs
                ? 'Empoderar a cada operador de restaurante con las herramientas de IA que las grandes cadenas dan por sentadas — pero con la sencillez y el precio que un independiente necesita. Queremos que cada restaurante pueda competir y ganar.'
                : 'Empower every restaurant operator with the AI tools that big chains take for granted — but with the simplicity and pricing an independent needs. We want every restaurant to compete and win.'
              }
            </p>
          </div>
          <div style={{ borderRadius: 'var(--l-radius-lg)', overflow: 'hidden' }}>
            <img
              src="https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&q=80"
              alt={isEs ? 'Equipo trabajando' : 'Team at work'}
              loading="lazy"
              style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover' }}
            />
          </div>
        </div>
      </section>

      {/* VALUES */}
      <section className="l-section-cream" style={{ paddingBottom: 80 }}>
        <div className="l-container">
          <div className="l-metrics-grid with-dividers">
            <MetricCard value="40+" label={isEs ? 'miembros del equipo' : 'team members'} />
            <MetricCard value="1" label={isEs ? 'misión: rentabilidad para todos' : 'mission: profitability for all'} />
          </div>
        </div>
      </section>

      {/* TEAM */}
      <section className="l-section-cream" style={{ paddingBottom: 80 }}>
        <div className="l-container l-text-center">
          <SectionHeadline text={isEs ? 'Nuestro equipo' : 'Our team'} align="center" className="l-mb-48" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24 }}>
            {TEAM_PHOTOS.map((url, i) => (
              <div key={i} style={{ borderRadius: 'var(--l-radius-lg)', overflow: 'hidden' }}>
                <img src={url} alt="Team member" loading="lazy" style={{ width: '100%', aspectRatio: '3/4', objectFit: 'cover' }} />
              </div>
            ))}
          </div>
        </div>
      </section>

      <PreFooterCTA />
    </>
  );
}
