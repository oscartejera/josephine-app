/**
 * ProductOverviewPage — "/product" landing page
 * 
 * Overview of the entire Josephine platform with links to individual modules.
 */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SectionHeadline } from '@/components/landing/SectionHeadline';
import { PreFooterCTA } from '@/components/landing/PreFooterCTA';
import { BarChart3, Package, Users, Wallet } from 'lucide-react';

const MODULES = [
  {
    icon: BarChart3,
    color: '#BEB1F0',
    title: 'Business Intelligence',
    titleEs: 'Business Intelligence',
    description: 'AI-powered analytics, daily briefings, and multi-location dashboards.',
    descriptionEs: 'Analítica con IA, briefings diarios y dashboards multi-local.',
    href: '/product/business-intelligence',
  },
  {
    icon: Package,
    color: '#22C55E',
    title: 'Inventory',
    titleEs: 'Inventario',
    description: 'Recipe costing, auto-ordering, waste tracking, and supplier management.',
    descriptionEs: 'Costeo de recetas, pedidos automáticos, control de merma y gestión de proveedores.',
    href: '/product/inventory',
  },
  {
    icon: Users,
    color: '#3B82F6',
    title: 'Workforce',
    titleEs: 'Personal',
    description: 'Smart scheduling, digital onboarding, time tracking, and team portal.',
    descriptionEs: 'Horarios inteligentes, onboarding digital, fichajes y portal del empleado.',
    href: '/product/workforce-management',
  },
  {
    icon: Wallet,
    color: '#FBBF24',
    title: 'Payroll',
    titleEs: 'Nóminas',
    description: 'Automated pay runs, compliance built-in, and employee self-service.',
    descriptionEs: 'Nómina automatizada, cumplimiento integrado y autoservicio del empleado.',
    href: '/product/payroll',
  },
];

export default function ProductOverviewPage() {
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
            text={isEs ? 'Todo lo que necesitas. Una sola plataforma.' : 'Everything you need. One platform.'}
            align="center"
            italic
            color="var(--l-accent-lavender)"
          />
          <p className="l-body-light l-mt-24 l-mx-auto" style={{ maxWidth: 600, textAlign: 'center' }}>
            {isEs
              ? 'Josephine integra BI, inventario, personal y nóminas en un solo sistema. Sin integraciones complicadas, sin herramientas dispersas.'
              : 'Josephine brings BI, inventory, workforce, and payroll into one system. No complicated integrations, no scattered tools.'
            }
          </p>
        </div>
      </section>

      {/* MODULES GRID */}
      <section className="l-section-cream" style={{ padding: '100px 24px' }}>
        <div className="l-container">
          <SectionHeadline
            text={isEs ? 'Cuatro módulos. Control total.' : 'Four modules. Total control.'}
            align="center"
            className="l-mx-auto l-mb-48"
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24 }}>
            {MODULES.map((mod) => {
              const Icon = mod.icon;
              return (
                <Link
                  key={mod.href}
                  to={mod.href}
                  className="l-bento-card"
                  style={{ textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column', gap: 16 }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: mod.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon size={20} style={{ color: '#fff' }} />
                    </div>
                    <h3 className="l-headline-card">{isEs ? mod.titleEs : mod.title}</h3>
                  </div>
                  <p className="l-body">{isEs ? mod.descriptionEs : mod.description}</p>
                  <span style={{ color: 'var(--l-accent-violet)', fontWeight: 600, fontSize: 14 }}>
                    {isEs ? 'Saber más →' : 'Learn more →'}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* WHY JOSEPHINE */}
      <section className="l-section-dark" style={{ padding: '100px 24px' }}>
        <div className="l-container l-text-center">
          <SectionHeadline
            text={isEs ? '¿Por qué Josephine?' : 'Why Josephine?'}
            align="center"
            color="var(--l-accent-lavender)"
            className="l-mx-auto l-mb-48"
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 32, maxWidth: 900, margin: '0 auto' }}>
            {[
              { value: '90-95%', label: isEs ? 'precisión de previsión' : 'forecast accuracy' },
              { value: '2-5%', label: isEs ? 'aumento de margen GP' : 'GP margin increase' },
              { value: '15-20%', label: isEs ? 'reducción coste laboral' : 'lower labour costs' },
            ].map((m, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 48, fontWeight: 700, color: 'var(--l-accent-lavender)', fontFamily: 'var(--l-font-serif)' }}>{m.value}</div>
                <div className="l-body-light" style={{ marginTop: 8 }}>{m.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <PreFooterCTA />
    </>
  );
}
