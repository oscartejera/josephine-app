/**
 * ProductPageTemplate — Universal 7-section product page
 * 
 * Pattern: Hero → Value Prop → Features Grid → Success Stories → Integration → FAQ → CTA
 * Used by all 4 product module pages with different data configs.
 */
import { useTranslation } from 'react-i18next';
import { SectionHeadline } from '@/components/landing/SectionHeadline';
import { MetricCard } from '@/components/landing/MetricCard';
import { BadgePill } from '@/components/landing/BadgePill';
import { FAQAccordion } from '@/components/landing/FAQAccordion';
import { SuccessStoryCarousel } from '@/components/landing/SuccessStoryCarousel';
import { PreFooterCTA } from '@/components/landing/PreFooterCTA';
import { Link } from 'react-router-dom';

export interface ProductPageConfig {
  // Hero
  badge: string;
  badgeEs: string;
  badgeColor: 'red' | 'blue' | 'green' | 'yellow';
  heroHeadline: string;
  heroHeadlineEs: string;
  heroBody: string;
  heroBodyEs: string;
  heroBg: string;
  heroTextColor: string;
  heroImage: string;
  // Value Prop
  valuePropHeadline: string;
  valuePropHeadlineEs: string;
  valuePropBody: string;
  valuePropBodyEs: string;
  metrics: Array<{
    value: string;
    label: string;
    labelEs: string;
    bg?: string;
  }>;
  // Features
  featureHeadline: string;
  featureHeadlineEs: string;
  features: Array<{
    title: string;
    titleEs: string;
    description: string;
    descriptionEs: string;
  }>;
  // FAQs
  faqs: Array<{
    question: string;
    questionEs: string;
    answer: string;
    answerEs: string;
  }>;
}

export function ProductPageTemplate({ config }: { config: ProductPageConfig }) {
  const { i18n } = useTranslation();
  const isEs = i18n.language === 'es' || i18n.language === 'ca';

  // Detect if hero has a light background (body text should be dark)
  const isLightHeroBg = (() => {
    const hex = config.heroBg.replace('#', '');
    if (hex.length < 6) return false;
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return (r * 0.299 + g * 0.587 + b * 0.114) > 150;
  })();
  const heroBodyClass = isLightHeroBg ? 'l-body' : 'l-body-light';
  return (
    <>
      {/* S1: HERO */}
      <section
        style={{
          background: config.heroBg,
          minHeight: '80vh',
          display: 'flex',
          alignItems: 'center',
          padding: '120px 24px 80px',
        }}
      >
        <div className="l-container" style={{ display: 'grid', gridTemplateColumns: '2fr 3fr', gap: 60, alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <BadgePill
              text={isEs ? config.badgeEs : config.badge}
              color={config.badgeColor}
              variant="dark"
            />
            <h1
              className="l-headline-hero"
              style={{ color: config.heroTextColor }}
            >
              {isEs ? config.heroHeadlineEs : config.heroHeadline}
            </h1>
            <p className={heroBodyClass} style={{ maxWidth: 480 }}>
              {isEs ? config.heroBodyEs : config.heroBody}
            </p>
            <div className="l-flex l-gap-16" style={{ flexWrap: 'wrap' }}>
              <Link to="/book-a-chat" className="l-btn-primary">
                {isEs ? 'Reservar demo' : 'Book a chat'}
              </Link>
              <Link to="/" className={isLightHeroBg ? 'l-btn-outline' : 'l-btn-ghost'}>
                {isEs ? 'Ver tour del producto' : 'Watch product tour'}
              </Link>
            </div>
          </div>
          <div style={{ borderRadius: 'var(--l-radius-lg)', overflow: 'hidden', boxShadow: 'var(--l-shadow-hero)' }}>
            <img
              src={config.heroImage}
              alt=""
              loading="eager"
              style={{ width: '100%', height: 'auto', display: 'block', aspectRatio: '4/3', objectFit: 'cover' }}
            />
          </div>
        </div>
      </section>

      {/* S2: VALUE PROP */}
      <section className="l-section-cream" style={{ padding: '100px 24px' }}>
        <div className="l-container l-text-center">
          <SectionHeadline
            text={isEs ? config.valuePropHeadlineEs : config.valuePropHeadline}
            align="center"
            maxWidth="700px"
            className="l-mx-auto"
          />
          <p className="l-body l-mt-24 l-mx-auto" style={{ maxWidth: 600, textAlign: 'center' }}>
            {isEs ? config.valuePropBodyEs : config.valuePropBody}
          </p>
          <div className="l-mt-48" style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            {config.metrics.map((m, i) => (
              <MetricCard
                key={i}
                value={m.value}
                label={isEs ? m.labelEs : m.label}
                bg={m.bg}
              />
            ))}
          </div>
        </div>
      </section>

      {/* S3: FEATURE CARDS */}
      <section className="l-section-cream" style={{ paddingTop: 0 }}>
        <div className="l-container">
          <SectionHeadline
            text={isEs ? config.featureHeadlineEs : config.featureHeadline}
            align="center"
            className="l-mx-auto l-mb-48"
            maxWidth="700px"
          />
          <div className="l-bento-grid">
            {config.features.map((f, i) => (
              <div
                key={i}
                className={`l-bento-card ${i === 0 ? 'full-width' : ''}`}
              >
                <h3 className="l-headline-card">{isEs ? f.titleEs : f.title}</h3>
                <p className="l-body l-mt-16">{isEs ? f.descriptionEs : f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* S4: SUCCESS STORIES */}
      <SuccessStoryCarousel className="l-section-cream" />

      {/* S5: FAQ */}
      <section className="l-section-cream" style={{ paddingTop: 80, paddingBottom: 60 }}>
        <div className="l-container" style={{ maxWidth: 800 }}>
          <SectionHeadline
            text={isEs ? 'Preguntas frecuentes' : 'Frequently asked questions'}
            align="center"
            className="l-mx-auto l-mb-48"
          />
          <FAQAccordion
            items={config.faqs.map(f => ({
              question: isEs ? f.questionEs : f.question,
              answer: isEs ? f.answerEs : f.answer,
            }))}
          />
        </div>
      </section>

      {/* S6: CTA */}
      <PreFooterCTA />
    </>
  );
}
