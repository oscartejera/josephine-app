/**
 * BlogPage — High-quality operator-focused blog
 * Content inspired by Nory's knowledge hub: actionable insights for restaurant operators.
 */
import { useTranslation } from 'react-i18next';
import { SectionHeadline } from '@/components/landing/SectionHeadline';
import { PreFooterCTA } from '@/components/landing/PreFooterCTA';
import { Clock, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

interface BlogPost {
  slug: string;
  titleEn: string;
  titleEs: string;
  excerptEn: string;
  excerptEs: string;
  categoryEn: string;
  categoryEs: string;
  readMin: number;
  image: string;
  date: string;
  featured?: boolean;
}

const posts: BlogPost[] = [
  {
    slug: 'food-cost-control-guide',
    titleEn: 'The Complete Guide to Food Cost Control in 2026',
    titleEs: 'Guía completa para controlar el coste de alimentos en 2026',
    excerptEn: 'Food cost is the biggest controllable expense in your restaurant. Learn the formula, benchmarks, and 7 proven strategies that top operators use to keep it below 28%. Includes a free food cost calculator template.',
    excerptEs: 'El coste de alimentos es el mayor gasto controlable de tu restaurante. Aprende la fórmula, benchmarks y 7 estrategias probadas que los mejores operadores usan para mantenerlo por debajo del 28%. Incluye plantilla gratuita.',
    categoryEn: 'Cost Management',
    categoryEs: 'Gestión de Costes',
    readMin: 12,
    image: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&q=80',
    date: '2026-03-28',
    featured: true,
  },
  {
    slug: 'recipe-costing-escandallo',
    titleEn: 'Recipe Costing (Escandallo): How to Price Your Menu for Profit',
    titleEs: 'Escandallo: Cómo fijar precios en tu carta para maximizar beneficios',
    excerptEn: 'Most restaurants guess their menu prices. The escandallo method ensures every dish covers its cost and delivers your target margin. Step-by-step guide with real examples from a Mediterranean kitchen.',
    excerptEs: 'La mayoría de restaurantes adivinan los precios de su carta. El método de escandallo asegura que cada plato cubre su coste y entrega tu margen objetivo. Guía paso a paso con ejemplos reales.',
    categoryEn: 'Cost Management',
    categoryEs: 'Gestión de Costes',
    readMin: 8,
    image: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80',
    date: '2026-03-21',
  },
  {
    slug: 'reduce-restaurant-waste',
    titleEn: '5 Data-Driven Strategies to Cut Restaurant Waste by 40%',
    titleEs: '5 estrategias basadas en datos para reducir la merma un 40%',
    excerptEn: 'UK restaurants waste 199,000 tonnes of food annually. We break down the 5 highest-impact interventions: prep optimization, FIFO automation, demand forecasting, portion control, and waste tracking dashboards.',
    excerptEs: 'Los restaurantes desperdician miles de toneladas de comida anualmente. Analizamos las 5 intervenciones de mayor impacto: optimización de prep, FIFO automatizado, previsión de demanda, control de porciones y dashboards de merma.',
    categoryEn: 'Waste Reduction',
    categoryEs: 'Reducción de Merma',
    readMin: 10,
    image: 'https://images.unsplash.com/photo-1567521464027-f127ff144326?w=800&q=80',
    date: '2026-03-14',
  },
  {
    slug: 'labour-scheduling-hospitality',
    titleEn: 'Smart Labour Scheduling: How AI Predicts Exactly How Many Staff You Need',
    titleEs: 'Programación inteligente: cómo la IA predice exactamente cuánto personal necesitas',
    excerptEn: 'Over-staffing kills margins. Under-staffing kills service. AI-powered scheduling analyses weather, events, and historical covers to build the perfect rota — saving 3–5% on labour costs.',
    excerptEs: 'El exceso de personal mata los márgenes. La falta de personal mata el servicio. La programación con IA analiza clima, eventos e histórico de cubiertos para construir la rota perfecta — ahorrando 3–5% en costes laborales.',
    categoryEn: 'Workforce',
    categoryEs: 'Personal',
    readMin: 7,
    image: 'https://images.unsplash.com/photo-1552566626-52f8b828add9?w=800&q=80',
    date: '2026-03-07',
  },
  {
    slug: 'restaurant-kpi-dashboard',
    titleEn: 'The 8 KPIs Every Restaurant Should Track Daily',
    titleEs: 'Los 8 KPIs que todo restaurante debe seguir a diario',
    excerptEn: 'Revenue alone doesn\'t tell the story. From RevPASH to prime cost to customer acquisition cost — here are the 8 metrics that separate profitable restaurants from struggling ones, and how to automate tracking.',
    excerptEs: 'Los ingresos solos no cuentan la historia completa. Desde RevPASH hasta coste primo y CAC — estos son los 8 indicadores que separan los restaurantes rentables de los que luchan, y cómo automatizar su seguimiento.',
    categoryEn: 'Business Intelligence',
    categoryEs: 'Business Intelligence',
    readMin: 9,
    image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80',
    date: '2026-02-28',
  },
  {
    slug: 'multi-location-restaurant-management',
    titleEn: 'Scaling from 1 to 10 Locations: The Operational Playbook',
    titleEs: 'Escalar de 1 a 10 locales: el playbook operativo',
    excerptEn: 'The jump from a single site to multi-location is the hardest transition in hospitality. We cover standardisation, delegation frameworks, tech stack decisions, and the 3 things that break first when you grow.',
    excerptEs: 'El salto de un local a multi-local es la transición más difícil en hostelería. Cubrimos estandarización, frameworks de delegación, decisiones de tech stack y las 3 cosas que fallan primero al crecer.',
    categoryEn: 'Growth',
    categoryEs: 'Crecimiento',
    readMin: 14,
    image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80',
    date: '2026-02-21',
  },
];

export default function BlogPage() {
  const { i18n } = useTranslation();
  const isEs = i18n.language === 'es' || i18n.language === 'ca';

  const featured = posts.find(p => p.featured);
  const rest = posts.filter(p => !p.featured);

  return (
    <>
      {/* HERO */}
      <section className="l-section-dark l-hero">
        <div className="l-container l-text-center" style={{ paddingTop: 140, paddingBottom: 80 }}>
          <SectionHeadline as="h1" variant="hero" text={isEs ? 'Insights para operadores' : 'Operator Insights'} align="center" color="var(--l-accent-lavender)" />
          <p className="l-body-light l-mt-24 l-mx-auto" style={{ maxWidth: 500, textAlign: 'center' }}>
            {isEs ? 'Estrategias probadas, datos de la industria y guías prácticas para restaurantes que quieren mejores márgenes.' : 'Proven strategies, industry data, and actionable guides for restaurants that want better margins.'}
          </p>
        </div>
      </section>

      {/* FEATURED POST */}
      {featured && (
        <section className="l-section-cream" style={{ padding: '80px 24px 0' }}>
          <div className="l-container">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, alignItems: 'center' }}>
              <div style={{ borderRadius: 'var(--l-radius-lg)', overflow: 'hidden' }}>
                <img src={featured.image} alt="" loading="lazy" style={{ width: '100%', aspectRatio: '16/10', objectFit: 'cover' }} />
              </div>
              <div>
                <span style={{
                  display: 'inline-block', padding: '4px 12px', borderRadius: 20,
                  background: 'var(--l-accent-lavender-subtle, rgba(190,177,240,0.15))',
                  color: 'var(--l-accent-violet)', fontSize: 12, fontWeight: 600, marginBottom: 16,
                }}>
                  {isEs ? featured.categoryEs : featured.categoryEn}
                </span>
                <h2 className="l-headline-section" style={{ marginBottom: 16 }}>
                  {isEs ? featured.titleEs : featured.titleEn}
                </h2>
                <p className="l-body" style={{ marginBottom: 20 }}>
                  {isEs ? featured.excerptEs : featured.excerptEn}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div className="l-btn-primary" style={{ cursor: 'pointer' }}>
                    {isEs ? 'Leer artículo' : 'Read article'} <ArrowRight className="w-4 h-4" />
                  </div>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--l-text-muted-dark)' }}>
                    <Clock className="w-3.5 h-3.5" /> {featured.readMin} min
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* POST GRID */}
      <section className="l-section-cream" style={{ padding: '60px 24px 80px' }}>
        <div className="l-container">
          <h2 className="l-headline-small" style={{ marginBottom: 32 }}>
            {isEs ? 'Últimos artículos' : 'Latest articles'}
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
            {rest.map((post) => (
              <article key={post.slug} className="l-card-flat" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <img src={post.image} alt="" loading="lazy" style={{ width: '100%', height: 200, objectFit: 'cover' }} />
                <div style={{ padding: 24, flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <span style={{
                    display: 'inline-block', padding: '3px 10px', borderRadius: 16,
                    background: 'var(--l-accent-lavender-subtle, rgba(190,177,240,0.1))',
                    color: 'var(--l-accent-violet)', fontSize: 11, fontWeight: 600, marginBottom: 12,
                    alignSelf: 'flex-start',
                  }}>
                    {isEs ? post.categoryEs : post.categoryEn}
                  </span>
                  <h3 className="l-headline-small" style={{ fontSize: 18, marginBottom: 10 }}>
                    {isEs ? post.titleEs : post.titleEn}
                  </h3>
                  <p className="l-body" style={{ fontSize: 14, flex: 1, marginBottom: 16 }}>
                    {(isEs ? post.excerptEs : post.excerptEn).slice(0, 140)}…
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--l-text-muted-dark)' }}>
                      <Clock className="w-3 h-3" /> {post.readMin} min
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--l-text-muted-dark)' }}>
                      {new Date(post.date).toLocaleDateString(isEs ? 'es-ES' : 'en-GB', { month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <PreFooterCTA />
    </>
  );
}
