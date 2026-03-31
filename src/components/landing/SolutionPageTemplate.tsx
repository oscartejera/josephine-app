/**
 * SolutionPageTemplate — 10-section solutions page template
 * Reuses ProductPageTemplate structure with additional module showcase.
 */
import { useTranslation } from 'react-i18next';
import { SectionHeadline } from '@/components/landing/SectionHeadline';
import { MetricCard } from '@/components/landing/MetricCard';
import { BadgePill } from '@/components/landing/BadgePill';
import { FAQAccordion } from '@/components/landing/FAQAccordion';
import { SuccessStoryCarousel } from '@/components/landing/SuccessStoryCarousel';
import { ModuleShowcase } from '@/components/landing/ModuleShowcase';
import { PreFooterCTA } from '@/components/landing/PreFooterCTA';
import { Link } from 'react-router-dom';

export interface SolutionPageConfig {
  badge: string;
  badgeEs: string;
  heroHeadline: string;
  heroHeadlineEs: string;
  heroBody: string;
  heroBodyEs: string;
  heroImage: string;
  valuePropHeadline: string;
  valuePropHeadlineEs: string;
  valuePropBody: string;
  valuePropBodyEs: string;
  metrics: Array<{ value: string; label: string; labelEs: string; bg?: string }>;
  features: Array<{ title: string; titleEs: string; description: string; descriptionEs: string }>;
  faqs: Array<{ question: string; questionEs: string; answer: string; answerEs: string }>;
}

export function SolutionPageTemplate({ config }: { config: SolutionPageConfig }) {
  const { i18n } = useTranslation();
  const isEs = i18n.language === 'es' || i18n.language === 'ca';

  return (
    <>
      {/* HERO */}
      <section className="l-section-dark l-hero">
        <div className="l-hero-inner">
          <div className="l-hero-text">
            <BadgePill text={isEs ? config.badgeEs : config.badge} color="lavender" variant="dark" />
            <h1 className="l-headline-hero" style={{ color: 'var(--l-accent-lavender)' }}>
              {isEs ? config.heroHeadlineEs : config.heroHeadline}
            </h1>
            <p className="l-body-light" style={{ maxWidth: 480 }}>
              {isEs ? config.heroBodyEs : config.heroBody}
            </p>
            <div className="l-flex l-gap-16" style={{ flexWrap: 'wrap' }}>
              <Link to="/book-a-chat" className="l-btn-primary">{isEs ? 'Reservar demo' : 'Book a chat'}</Link>
              <Link to="/" className="l-btn-ghost">{isEs ? 'Ver tour del producto' : 'Watch product tour'}</Link>
            </div>
          </div>
          <div className="l-hero-photo">
            <img src={config.heroImage} alt="" loading="eager" />
          </div>
        </div>
      </section>

      {/* VALUE PROP + METRICS */}
      <section className="l-section-cream" style={{ padding: '100px 24px' }}>
        <div className="l-container l-text-center">
          <SectionHeadline text={isEs ? config.valuePropHeadlineEs : config.valuePropHeadline} align="center" maxWidth="700px" className="l-mx-auto" />
          <p className="l-body l-mt-24 l-mx-auto" style={{ maxWidth: 600, textAlign: 'center' }}>{isEs ? config.valuePropBodyEs : config.valuePropBody}</p>
          <div className="l-mt-48 l-metrics-grid with-dividers">
            {config.metrics.map((m, i) => (
              <MetricCard key={i} value={m.value} label={isEs ? m.labelEs : m.label} bg={m.bg} />
            ))}
          </div>
        </div>
      </section>

      {/* FEATURE CARDS */}
      <section className="l-section-cream" style={{ paddingTop: 0 }}>
        <div className="l-container">
          <div className="l-bento-grid">
            {config.features.map((f, i) => (
              <div key={i} className={`l-bento-card ${i === 0 ? 'full-width' : ''}`}>
                <h3 className="l-headline-card">{isEs ? f.titleEs : f.title}</h3>
                <p className="l-body l-mt-16">{isEs ? f.descriptionEs : f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* MODULE SHOWCASE */}
      <ModuleShowcase />

      {/* SUCCESS STORIES */}
      <SuccessStoryCarousel className="l-section-cream" />

      {/* FAQ */}
      <section className="l-section-cream" style={{ paddingTop: 80, paddingBottom: 60 }}>
        <div className="l-container" style={{ maxWidth: 800 }}>
          <SectionHeadline text={isEs ? 'Preguntas frecuentes' : 'Frequently asked questions'} align="center" className="l-mx-auto l-mb-48" />
          <FAQAccordion items={config.faqs.map(f => ({ question: isEs ? f.questionEs : f.question, answer: isEs ? f.answerEs : f.answer }))} />
        </div>
      </section>

      <PreFooterCTA />
    </>
  );
}
