import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { SectionHeadline } from '@/components/landing/SectionHeadline';
import { PreFooterCTA } from '@/components/landing/PreFooterCTA';

export default function CareersPage() {
  const { i18n } = useTranslation();
  const isEs = i18n.language === 'es' || i18n.language === 'ca';

  const positions = [
    { title: 'Senior Full-Stack Engineer', team: 'Engineering', location: 'Remote EU' },
    { title: 'Product Designer', team: 'Design', location: 'Remote / London' },
    { title: 'Customer Success Manager', team: 'Operations', location: 'London' },
    { title: 'ML Engineer', team: 'AI / Data', location: 'Remote EU' },
    { title: 'Account Executive', team: 'Sales', location: 'Madrid / London' },
  ];

  return (
    <>
      <section className="l-section-dark l-hero">
        <div className="l-container l-text-center" style={{ paddingTop: 140, paddingBottom: 80 }}>
          <SectionHeadline
            as="h1" variant="hero" italic
            text={isEs ? '¿Listo para unirte al equipo?' : 'Ready to join the ranks?'}
            align="center" color="var(--l-accent-lavender)"
          />
          <p className="l-body-light l-mt-24 l-mx-auto" style={{ maxWidth: 550, textAlign: 'center' }}>
            {isEs
              ? 'Estamos construyendo el futuro de la gestión de restaurantes. Únete a un equipo apasionado por la tecnología, la buena comida y los resultados.'
              : "We're building the future of restaurant management. Join a team passionate about technology, great food, and results."
            }
          </p>
        </div>
      </section>

      <section className="l-section-cream" style={{ padding: '80px 24px' }}>
        <div className="l-container" style={{ maxWidth: 800 }}>
          <SectionHeadline text={isEs ? 'Posiciones abiertas' : 'Open positions'} className="l-mb-32" />
          {positions.map((pos, i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '20px 0', borderBottom: '1px solid var(--l-border-light)',
            }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 16, color: 'var(--l-text-dark)' }}>{pos.title}</div>
                <div style={{ fontSize: 14, color: 'var(--l-text-muted-dark)' }}>{pos.team} · {pos.location}</div>
              </div>
              <Link to="/book-a-chat" className="l-btn-outline" style={{ fontSize: 13, padding: '8px 16px' }}>
                {isEs ? 'Aplicar' : 'Apply'}
              </Link>
            </div>
          ))}
        </div>
      </section>

      <PreFooterCTA />
    </>
  );
}
