/**
 * IntegrationsLandingPage — "/product/integrations" landing page
 * 
 * Shows integration ecosystem — POS, accounting, HR, delivery platforms.
 */
import { useTranslation } from 'react-i18next';
import { SectionHeadline } from '@/components/landing/SectionHeadline';
import { PreFooterCTA } from '@/components/landing/PreFooterCTA';

const INTEGRATIONS = [
  {
    category: 'POS Systems',
    categoryEs: 'Sistemas POS',
    items: ['Square', 'Toast', 'Lightspeed', 'Aloha', 'Revel', 'Clover'],
  },
  {
    category: 'Accounting',
    categoryEs: 'Contabilidad',
    items: ['Xero', 'QuickBooks', 'Sage', 'FreshBooks'],
  },
  {
    category: 'Delivery',
    categoryEs: 'Delivery',
    items: ['Uber Eats', 'Deliveroo', 'Just Eat', 'Glovo'],
  },
  {
    category: 'HR & Payroll',
    categoryEs: 'RRHH y Nóminas',
    items: ['BambooHR', 'Gusto', 'PayFit', 'Personio'],
  },
];

export default function IntegrationsLandingPage() {
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
            text={isEs ? 'Conecta todo tu ecosistema.' : 'Connect your entire ecosystem.'}
            align="center"
            italic
            color="var(--l-accent-lavender)"
          />
          <p className="l-body-light l-mt-24 l-mx-auto" style={{ maxWidth: 600, textAlign: 'center' }}>
            {isEs
              ? 'Josephine se integra con los sistemas que ya usas — POS, contabilidad, delivery y más. Sin fricciones, sin perder datos.'
              : 'Josephine integrates with the systems you already use — POS, accounting, delivery, and more. No friction, no data loss.'
            }
          </p>
        </div>
      </section>

      {/* INTEGRATION GRID */}
      <section className="l-section-cream" style={{ padding: '100px 24px' }}>
        <div className="l-container">
          <SectionHeadline
            text={isEs ? 'Nuestro ecosistema de integraciones' : 'Our integration ecosystem'}
            align="center"
            className="l-mx-auto l-mb-48"
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 32 }}>
            {INTEGRATIONS.map((group) => (
              <div key={group.category} className="l-bento-card">
                <h3 className="l-headline-card" style={{ marginBottom: 16 }}>
                  {isEs ? group.categoryEs : group.category}
                </h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {group.items.map((item) => (
                    <span
                      key={item}
                      style={{
                        background: 'var(--l-surface-white)',
                        border: '1px solid rgba(14, 12, 19, 0.08)',
                        borderRadius: 8,
                        padding: '8px 16px',
                        fontSize: 14,
                        fontWeight: 500,
                        color: 'var(--l-text-dark)',
                      }}
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* API */}
      <section className="l-section-dark" style={{ padding: '100px 24px' }}>
        <div className="l-container" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60, alignItems: 'center' }}>
          <div>
            <SectionHeadline
              text={isEs ? 'API abierta para desarrolladores' : 'Open API for developers'}
              color="var(--l-accent-lavender)"
            />
            <p className="l-body-light l-mt-24" style={{ maxWidth: 480 }}>
              {isEs
                ? 'Nuestra API RESTful te permite construir integraciones personalizadas. Con documentación completa, webhooks y soporte dedicado.'
                : 'Our RESTful API lets you build custom integrations. With full documentation, webhooks, and dedicated support.'
              }
            </p>
          </div>
          <div className="l-bento-card" style={{ background: '#1E1B2E', border: '1px solid rgba(190, 177, 240, 0.15)', padding: 32 }}>
            <pre style={{ color: 'var(--l-accent-lavender)', fontSize: 13, fontFamily: 'monospace', margin: 0, lineHeight: 1.6 }}>
{`GET /api/v1/sales/today
Authorization: Bearer <token>

{
  "total_revenue": 4250.80,
  "covers": 127,
  "avg_ticket": 33.47
}`}
            </pre>
          </div>
        </div>
      </section>

      <PreFooterCTA />
    </>
  );
}
