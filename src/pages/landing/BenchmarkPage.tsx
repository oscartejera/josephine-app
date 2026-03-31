/**
 * BenchmarkPage — Interactive restaurant benchmarking tool
 * Allows operators to compare their KPIs against industry averages.
 */
import { useTranslation } from 'react-i18next';
import { SectionHeadline } from '@/components/landing/SectionHeadline';
import { PreFooterCTA } from '@/components/landing/PreFooterCTA';
import { TrendingUp, Target, Percent, DollarSign, Users, ShoppingCart } from 'lucide-react';

const benchmarks = [
  {
    icon: DollarSign,
    labelEn: 'Food Cost',
    labelEs: 'Coste de Alimentos',
    industry: '28–32%',
    optimal: '<28%',
    descEn: 'Percentage of revenue spent on ingredients and raw materials.',
    descEs: 'Porcentaje de ingresos gastado en ingredientes y materias primas.',
  },
  {
    icon: Users,
    labelEn: 'Labour Cost',
    labelEs: 'Coste Laboral',
    industry: '25–35%',
    optimal: '<25%',
    descEn: 'Total labour costs including benefits as a share of revenue.',
    descEs: 'Costes laborales totales incluyendo beneficios como porcentaje de ingresos.',
  },
  {
    icon: Percent,
    labelEn: 'Prime Cost',
    labelEs: 'Coste Primo',
    industry: '55–65%',
    optimal: '<55%',
    descEn: 'Food cost + labour cost combined. The single most important metric.',
    descEs: 'Coste de alimentos + coste laboral combinado. La métrica más importante.',
  },
  {
    icon: ShoppingCart,
    labelEn: 'Waste Rate',
    labelEs: 'Tasa de Merma',
    industry: '4–10%',
    optimal: '<4%',
    descEn: 'Percentage of purchased food that ends up as waste.',
    descEs: 'Porcentaje de alimentos comprados que terminan como merma.',
  },
  {
    icon: Target,
    labelEn: 'Gross Margin',
    labelEs: 'Margen Bruto',
    industry: '60–70%',
    optimal: '>70%',
    descEn: 'Revenue minus COGS, before operating expenses.',
    descEs: 'Ingresos menos coste de mercancías, antes de gastos operativos.',
  },
  {
    icon: TrendingUp,
    labelEn: 'RevPASH',
    labelEs: 'RevPASH',
    industry: '€5–€15',
    optimal: '>€15',
    descEn: 'Revenue per available seat hour — measures space efficiency.',
    descEs: 'Ingresos por asiento disponible por hora — mide la eficiencia del espacio.',
  },
];

export default function BenchmarkPage() {
  const { i18n } = useTranslation();
  const isEs = i18n.language === 'es' || i18n.language === 'ca';

  return (
    <>
      {/* HERO */}
      <section className="l-section-dark l-hero">
        <div className="l-container l-text-center" style={{ paddingTop: 140, paddingBottom: 80 }}>
          <SectionHeadline
            as="h1"
            variant="hero"
            text={isEs ? 'Compara tu restaurante con la industria.' : 'Benchmark your restaurant against the industry.'}
            align="center"
            italic
            color="var(--l-accent-lavender)"
          />
          <p className="l-body-light l-mt-24 l-mx-auto" style={{ maxWidth: 560, textAlign: 'center' }}>
            {isEs
              ? '¿Están tus márgenes donde deberían? Compara tus KPIs con los estándares de la industria y descubre oportunidades de mejora.'
              : 'Are your margins where they should be? Compare your KPIs against industry standards and discover improvement opportunities.'}
          </p>
        </div>
      </section>

      {/* BENCHMARKS GRID */}
      <section className="l-section-cream" style={{ padding: '80px 24px' }}>
        <div className="l-container">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 24 }}>
            {benchmarks.map((b, i) => {
              const Icon = b.icon;
              return (
                <div key={i} className="l-card-flat" style={{ padding: 32 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 12,
                      background: 'var(--l-accent-lavender-subtle, rgba(190,177,240,0.12))',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Icon className="w-5 h-5" style={{ color: 'var(--l-accent-lavender)' }} />
                    </div>
                    <h3 className="l-headline-small" style={{ margin: 0 }}>
                      {isEs ? b.labelEs : b.labelEn}
                    </h3>
                  </div>
                  <p className="l-body" style={{ marginBottom: 20, fontSize: 14 }}>
                    {isEs ? b.descEs : b.descEn}
                  </p>
                  <div style={{ display: 'flex', gap: 24 }}>
                    <div>
                      <div style={{ fontSize: 12, color: 'var(--l-text-muted-dark)', marginBottom: 4 }}>
                        {isEs ? 'Media industria' : 'Industry avg'}
                      </div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--l-text-dark)' }}>
                        {b.industry}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: 'var(--l-text-muted-dark)', marginBottom: 4 }}>
                        {isEs ? 'Objetivo óptimo' : 'Optimal target'}
                      </div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: '#22c55e' }}>
                        {b.optimal}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <PreFooterCTA />
    </>
  );
}
