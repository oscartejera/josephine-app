/**
 * SocialProofBand — "Trusted by the best" section
 * 
 * Headline + LogoMarquee on cream background.
 * Smooth transition zone from dark hero above.
 */
import { useTranslation } from 'react-i18next';
import { SectionHeadline } from './SectionHeadline';
import { LogoMarquee } from './LogoMarquee';

export function SocialProofBand() {
  const { i18n } = useTranslation();
  const isEs = i18n.language === 'es' || i18n.language === 'ca';

  return (
    <section className="l-section-cream" style={{ paddingTop: 80, paddingBottom: 80 }}>
      <div className="l-container l-text-center">
        <SectionHeadline
          text={isEs ? 'Los mejores confían en nosotros' : 'Trusted by the best in the business'}
          variant="section"
          align="center"
        />
        <div className="l-mt-48">
          <LogoMarquee />
        </div>
      </div>
    </section>
  );
}
