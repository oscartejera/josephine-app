/**
 * MetricsSection — "Results you can take to the bank"
 * 
 * 3 animated metric cards with counter tickers.
 * Serif italic headline on cream background.
 */
import { useTranslation } from 'react-i18next';
import { SectionHeadline } from './SectionHeadline';
import { MetricCard } from './MetricCard';

export function MetricsSection() {
  const { i18n } = useTranslation();
  const isEs = i18n.language === 'es' || i18n.language === 'ca';

  return (
    <section className="l-section-cream" style={{ paddingTop: 80, paddingBottom: 80 }}>
      <div className="l-container l-text-center">
        <SectionHeadline
          text={isEs ? 'Resultados que se llevan al banco' : 'Results you can take to the bank'}
          variant="section"
          italic
          align="center"
          maxWidth="700px"
          className="l-mx-auto l-mb-48"
        />

        <div className="l-metrics-grid with-dividers">
          <MetricCard
            value="8.8x"
            numericValue={8.8}
            suffix="x"
            decimals={1}
            label={isEs ? 'ROI medio' : 'average ROI'}
          />
          <MetricCard
            value="15-20%"
            label={isEs ? 'reducción de costes laborales' : 'lower labour costs'}
          />
          <MetricCard
            value="2-5%"
            label={isEs ? 'aumento de EBITDA' : 'increase in EBITDA'}
          />
        </div>
      </div>
    </section>
  );
}
