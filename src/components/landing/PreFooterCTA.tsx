/**
 * PreFooterCTA — "Want better margins?" dark section
 * 
 * Final conversion section before footer.
 * Serif headline + body + lifestyle photo + CTA button.
 */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SectionHeadline } from './SectionHeadline';

export function PreFooterCTA() {
  const { i18n } = useTranslation();
  const isEs = i18n.language === 'es' || i18n.language === 'ca';

  return (
    <section className="l-section-dark" style={{ padding: '120px 24px' }}>
      <div className="l-container" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60, alignItems: 'center' }}>
        <div>
          <SectionHeadline
            text={isEs ? '¿Quieres mejores márgenes?' : 'Want better margins?'}
            as="h2"
            variant="hero"
            italic
            color="var(--l-accent-lavender)"
          />
          <p className="l-body-light l-mt-24" style={{ maxWidth: 480 }}>
            {isEs
              ? 'Pregúntanos cómo podemos proteger tus beneficios y ayudarte a crecer. Reserva una demo personalizada con nuestro equipo.'
              : 'Ask us how we can protect your profits and help you grow. Book a personalised demo with our team.'
            }
          </p>
          <div className="l-mt-32">
            <Link to="/book-a-chat" className="l-btn-primary">
              {isEs ? 'Reservar demo' : 'Book a chat'}
            </Link>
          </div>
        </div>
        <div className="l-parallax-img" style={{ borderRadius: 'var(--l-radius-lg)', overflow: 'hidden' }}>
          <img
            src="https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=600&q=80"
            alt={isEs ? 'Equipo de restaurante trabajando' : 'Restaurant team at work'}
            loading="lazy"
            style={{ width: '100%', height: 'auto', display: 'block', aspectRatio: '4/3', objectFit: 'cover' }}
          />
        </div>
      </div>
    </section>
  );
}
