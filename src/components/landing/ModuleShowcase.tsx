/**
 * ModuleShowcase — 4 stacked product module cards
 * 
 * Intro (headline + body + CTA) + 4× ModuleShowcaseCard
 * Each card: badge pill + headline + link + colored widget
 */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BarChart3, Package, Users, Wallet } from 'lucide-react';
import { SectionHeadline } from './SectionHeadline';
import { ModuleShowcaseCard } from './ModuleShowcaseCard';

export function ModuleShowcase() {
  const { i18n } = useTranslation();
  const isEs = i18n.language === 'es' || i18n.language === 'ca';

  return (
    <section className="l-section-cream">
      <div className="l-container">
        {/* Intro */}
        <div className="l-text-center l-mb-48">
          <SectionHeadline
            text={isEs
              ? 'Todas las operaciones de tu restaurante. Un sistema unificado.'
              : 'Your entire restaurant operations. One, unified system.'}
            align="center"
            maxWidth="800px"
            className="l-mx-auto"
          />
          <p className="l-body l-mt-24 l-mx-auto" style={{ maxWidth: 600, textAlign: 'center' }}>
            {isEs
              ? 'Desde inventario hasta gestión de personal, nóminas y mucho más — dirige tus operaciones con eficiencia impecable. Convierte pequeñas decisiones en grandes resultados.'
              : 'Across inventory, workforce management, payroll and more — run your operations with flawless efficiency. Turn small decisions into big wins.'
            }
          </p>
          <div className="l-mt-32">
            <Link to="/product" className="l-btn-outline">
              {isEs ? 'Conoce nuestro producto' : 'Learn about our product'}
            </Link>
          </div>
        </div>

        {/* Module Cards */}
        <ModuleShowcaseCard
          badge={isEs ? 'Business Intelligence' : 'Business Intelligence'}
          badgeColor="red"
          headline={isEs
            ? 'Toma mejores decisiones con analítica predictiva IA'
            : 'Make better decisions with AI-predictive analytics'
          }
          ctaText={isEs ? 'Saber más' : 'Learn more'}
          ctaHref="/product/business-intelligence"
          widgetBg="var(--l-bg-maroon)"
        >
          {/* BI Widget */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
            <div style={{ display: 'flex', gap: 12 }}>
              <WidgetKPI icon="✓" value="79%" label={isEs ? 'Precisión' : 'Accuracy'} />
              <WidgetKPI icon="£" value="93,779" label={isEs ? 'Ventas acumuladas' : 'Sales to date'} />
            </div>
            <div style={{
              background: 'rgba(190,177,240,0.1)',
              borderRadius: 'var(--l-radius-md)',
              padding: 16,
              color: 'var(--l-text-white)',
              fontSize: 13,
            }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>
                {isEs ? 'Ventas vs Previsión' : 'Sales vs Forecast'} 1-7 Mar
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 80 }}>
                {[65, 55, 70, 80, 45, 90, 75].map((h, i) => (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: '100%', height: `${h}%`, background: 'var(--l-accent-lavender)', borderRadius: 4, opacity: 0.8 }} />
                    <span style={{ fontSize: 10, opacity: 0.5 }}>{['L','M','X','J','V','S','D'][i]}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ModuleShowcaseCard>

        <ModuleShowcaseCard
          badge={isEs ? 'Inventario' : 'Inventory'}
          badgeColor="blue"
          headline={isEs
            ? 'Impulsa la rentabilidad con inventario gestionado por IA'
            : 'Drive profitability with AI-ordered inventory'
          }
          ctaText={isEs ? 'Saber más' : 'Learn more'}
          ctaHref="/product/inventory"
          widgetBg="var(--l-bg-green)"
        >
          <div style={{ color: 'var(--l-text-white)', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Package className="w-5 h-5" style={{ color: 'var(--l-accent-lime)' }} />
              <span style={{ fontWeight: 600 }}>{isEs ? 'Pedido sugerido' : 'Suggested order'}</span>
            </div>
            {['Tomates cherry', 'Pechuga de pollo', 'Aceite de oliva'].map((item, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', padding: '10px 0',
                borderBottom: '1px solid rgba(255,255,255,0.08)', fontSize: 14,
              }}>
                <span>{isEs ? item : ['Cherry tomatoes', 'Chicken breast', 'Olive oil'][i]}</span>
                <span style={{ color: 'var(--l-accent-lime)' }}>{[3, 8, 2][i]} {isEs ? 'uds' : 'units'}</span>
              </div>
            ))}
          </div>
        </ModuleShowcaseCard>

        <ModuleShowcaseCard
          badge={isEs ? 'Personal' : 'Workforce Management'}
          badgeColor="green"
          headline={isEs
            ? 'Incorpora, gestiona y recompensa a tus equipos sin esfuerzo'
            : 'Onboard, manage & reward your teams seamlessly'
          }
          ctaText={isEs ? 'Saber más' : 'Learn more'}
          ctaHref="/product/workforce-management"
          widgetBg="var(--l-bg-maroon)"
        >
          <div style={{ color: 'var(--l-text-white)', width: '100%', textAlign: 'center' }}>
            <div style={{
              padding: '16px 24px',
              background: 'rgba(190,177,240,0.15)',
              borderRadius: 'var(--l-radius-md)',
              marginBottom: 16,
            }}>
              <Users className="w-6 h-6 l-mx-auto" style={{ color: 'var(--l-accent-lime)', marginBottom: 8 }} />
              <span style={{ fontWeight: 700, fontSize: 18, color: 'var(--l-accent-lime)' }}>
                ✦ {isEs ? 'Crear Horario' : 'Create Schedule'}
              </span>
            </div>
            <div style={{ fontSize: 13, opacity: 0.6 }}>
              {isEs ? 'Lun 7 Abr — Dom 13 Abr' : 'Mon 7 Apr — Sun 13 Apr'}
            </div>
          </div>
        </ModuleShowcaseCard>

        <ModuleShowcaseCard
          badge={isEs ? 'Nóminas' : 'Payroll'}
          badgeColor="yellow"
          headline={isEs
            ? 'Ahorra tiempo y dinero con nóminas sin fricciones'
            : 'Save time and money with frictionless payroll'
          }
          ctaText={isEs ? 'Saber más' : 'Learn more'}
          ctaHref="/product/payroll"
          widgetBg="var(--l-bg-green)"
        >
          <div style={{ color: 'var(--l-text-white)', width: '100%', textAlign: 'center' }}>
            <div style={{
              fontFamily: 'var(--l-font-serif)',
              fontWeight: 700,
              fontStyle: 'italic',
              fontSize: 36,
              color: 'var(--l-accent-lime)',
              marginBottom: 8,
            }}>
              {isEs ? '¡Turnos pagados!' : 'Shifts paid!'}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 16 }}>
              <Wallet className="w-6 h-6" style={{ color: 'var(--l-accent-lime)', opacity: 0.6, transform: 'rotate(-15deg)' }} />
              <Wallet className="w-8 h-8" style={{ color: 'var(--l-accent-lime)', opacity: 0.8 }} />
              <Wallet className="w-6 h-6" style={{ color: 'var(--l-accent-lime)', opacity: 0.6, transform: 'rotate(15deg)' }} />
            </div>
          </div>
        </ModuleShowcaseCard>
      </div>
    </section>
  );
}

/** Small KPI widget card used in BI module showcase */
function WidgetKPI({ icon, value, label }: { icon: string; value: string; label: string }) {
  return (
    <div style={{
      flex: 1,
      background: 'rgba(190,177,240,0.1)',
      borderRadius: 'var(--l-radius-md)',
      padding: 16,
      color: 'var(--l-text-white)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <span style={{ fontSize: 14, color: '#22C55E' }}>{icon}</span>
        <span style={{ fontWeight: 700, fontSize: 22 }}>{value}</span>
      </div>
      <div style={{ fontSize: 12, opacity: 0.6 }}>{label}</div>
    </div>
  );
}
