import { useTranslation } from 'react-i18next';
import { SectionHeadline } from '@/components/landing/SectionHeadline';
import { FAQAccordion } from '@/components/landing/FAQAccordion';
import { PreFooterCTA } from '@/components/landing/PreFooterCTA';

export default function PartnerPage() {
  const { i18n } = useTranslation();
  const isEs = i18n.language === 'es' || i18n.language === 'ca';

  return (
    <>
      <section className="l-section-dark l-hero">
        <div className="l-container l-text-center" style={{ paddingTop: 140, paddingBottom: 80 }}>
          <SectionHeadline
            as="h1" variant="hero" italic
            text={isEs ? 'Crece con alianzas estratégicas.' : 'Grow through strategic partnerships.'}
            align="center" color="var(--l-accent-lavender)"
          />
          <p className="l-body-light l-mt-24 l-mx-auto" style={{ maxWidth: 550, textAlign: 'center' }}>
            {isEs
              ? 'Únete a nuestro programa de partners y ayuda a restaurantes a transformar sus operaciones. Beneficios exclusivos, formación dedicada y comisiones competitivas.'
              : 'Join our partner program and help restaurants transform their operations. Exclusive benefits, dedicated training, and competitive commissions.'
            }
          </p>
        </div>
      </section>

      <section className="l-section-cream" style={{ padding: '80px 24px' }}>
        <div className="l-container" style={{ maxWidth: 800 }}>
          <SectionHeadline text={isEs ? 'Preguntas frecuentes del programa' : 'Program FAQ'} align="center" className="l-mx-auto l-mb-48" />
          <FAQAccordion items={[
            { question: isEs ? '¿Quién puede ser partner?' : 'Who can become a partner?',
              answer: isEs ? 'Consultores de hostelería, distribuidores de POS, firmas de contabilidad y cualquier negocio que trabaje con restaurantes.' : 'Hospitality consultants, POS distributors, accounting firms, and any business that works with restaurants.' },
            { question: isEs ? '¿Cuáles son las comisiones?' : 'What are the commissions?',
              answer: isEs ? 'Ofrecemos comisiones recurrentes competitivas basadas en el tipo de partner y volumen de referidos.' : 'We offer competitive recurring commissions based on partner type and referral volume.' },
          ]} />
        </div>
      </section>

      <PreFooterCTA />
    </>
  );
}
