import { useTranslation } from 'react-i18next';
import { SectionHeadline } from '@/components/landing/SectionHeadline';
import { SuccessStoryCarousel } from '@/components/landing/SuccessStoryCarousel';
import { PreFooterCTA } from '@/components/landing/PreFooterCTA';

export default function SuccessStoriesPage() {
  const { i18n } = useTranslation();
  const isEs = i18n.language === 'es' || i18n.language === 'ca';

  return (
    <>
      <section className="l-section-dark l-hero">
        <div className="l-container l-text-center" style={{ paddingTop: 140, paddingBottom: 80 }}>
          <SectionHeadline as="h1" variant="hero" italic text={isEs ? 'Casos de éxito' : 'Success stories'} align="center" color="var(--l-accent-lavender)" />
          <p className="l-body-light l-mt-24 l-mx-auto" style={{ maxWidth: 550, textAlign: 'center' }}>
            {isEs ? 'Descubre cómo restaurantes como el tuyo transforman sus operaciones con Josephine.' : 'See how restaurants like yours transform their operations with Josephine.'}
          </p>
        </div>
      </section>
      <SuccessStoryCarousel className="l-section-cream" />
      <PreFooterCTA />
    </>
  );
}
