/**
 * WhyBrandsLove — Simple centered section
 * 
 * "Why restaurant brands love Josephine" headline + body text
 * Cream background, centered layout.
 */
import { useTranslation } from 'react-i18next';
import { SectionHeadline } from './SectionHeadline';

export function WhyBrandsLove() {
  const { i18n } = useTranslation();
  const isEs = i18n.language === 'es' || i18n.language === 'ca';

  return (
    <section className="l-section-cream" style={{ paddingTop: 100, paddingBottom: 60 }}>
      <div className="l-container l-text-center">
        <SectionHeadline
          text={isEs ? 'Por qué las marcas de restauración eligen Josephine' : 'Why restaurant brands love Josephine'}
          align="center"
          maxWidth="700px"
          className="l-mx-auto"
        />
        <p className="l-body l-mt-24 l-mx-auto" style={{ maxWidth: 600, textAlign: 'center' }}>
          {isEs
            ? 'Optimizamos tus operaciones y aceleramos tu crecimiento, ayudándote a abrir más locales y mejorar márgenes. Para que tú puedas enfocarte en lo que realmente importa — buena comida, buenos momentos y buen negocio.'
            : "We streamline your operations and speed up your growth, helping you open more venues and widen margins. Leaving you free to focus on what really matters — good food, good times and good business."
          }
        </p>
      </div>
    </section>
  );
}
