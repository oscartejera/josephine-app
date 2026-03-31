/**
 * BentoFeatures — Nory-style bento grid on cream background
 * 
 * Card 1 (full-width): "Save your guesses" + notification widgets
 * Card 2 (50%): "Straight-forward integrations" + hub logo grid
 */
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar, AlertTriangle, Zap } from 'lucide-react';
import { gsap, useGSAP } from '@/lib/gsap';
import { useFloatingWidget } from '@/hooks/gsap';

export function BentoFeatures() {
  const { i18n } = useTranslation();
  const isEs = i18n.language === 'es' || i18n.language === 'ca';
  const gridRef = useRef<HTMLDivElement>(null);
  const notif1Ref = useFloatingWidget({ amplitude: 6, duration: 3.5 });
  const notif2Ref = useFloatingWidget({ amplitude: 5, duration: 4 });

  useGSAP(() => {
    if (!gridRef.current) return;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const cards = gridRef.current.querySelectorAll('.l-bento-card');
    gsap.from(cards, {
      y: 40,
      opacity: 0,
      duration: 0.7,
      stagger: 0.15,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: gridRef.current,
        start: 'top 80%',
        toggleActions: 'play none none none',
      },
    });
  }, { scope: gridRef });

  const integrationNames = [
    'Square', 'Xero', 'Stripe', 'Toast', 'Lightspeed',
    'Sage', 'HubSpot', 'Slack', 'Zapier', 'QuickBooks',
  ];

  return (
    <section className="l-section-cream">
      <div className="l-container">
        <div ref={gridRef} className="l-bento-grid">
          {/* Card 1: Full width — AI Recommendations */}
          <div className="l-bento-card full-width" style={{ display: 'grid', gridTemplateColumns: '2fr 3fr', gap: 40, alignItems: 'center' }}>
            <div>
              <h3 className="l-headline-card">
                {isEs ? 'Deja las adivinanzas para la lotería' : 'Save your guesses for the lottery'}
              </h3>
              <p className="l-body l-mt-16">
                {isEs
                  ? 'Las recomendaciones de IA ayudan a tu equipo a tomar decisiones más inteligentes, día tras día.'
                  : 'AI recommendations help your team make smarter decisions, day after day.'
                }
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 24 }}>
              {/* Notification pills */}
              <div
                ref={notif1Ref as React.RefObject<HTMLDivElement>}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '14px 20px',
                  background: 'var(--l-surface-white)',
                  borderRadius: 'var(--l-radius-md)',
                  border: '1px solid var(--l-border-light)',
                  boxShadow: 'var(--l-shadow-card)',
                }}
              >
                <div style={{ width: 36, height: 36, borderRadius: 8, background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Calendar className="w-4 h-4" style={{ color: '#F59E0B' }} />
                </div>
                <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--l-text-dark)' }}>
                  {isEs ? 'Tu horario está por encima del presupuesto' : 'Your schedule is over budget'}
                </span>
              </div>
              <div
                ref={notif2Ref as React.RefObject<HTMLDivElement>}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '14px 20px',
                  background: 'var(--l-surface-white)',
                  borderRadius: 'var(--l-radius-md)',
                  border: '1px solid var(--l-border-light)',
                  boxShadow: 'var(--l-shadow-card)',
                }}
              >
                <div style={{ width: 36, height: 36, borderRadius: 8, background: '#F3E8FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <AlertTriangle className="w-4 h-4" style={{ color: '#8B5CF6' }} />
                </div>
                <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--l-text-dark)' }}>
                  {isEs ? 'Te estás quedando sin pollo' : "You're running low on chicken"}
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Half — Integrations */}
          <div className="l-bento-card">
            <h3 className="l-headline-card">
              {isEs ? 'Integraciones sin complicaciones' : 'Straight-forward integrations'}
            </h3>
            <p className="l-body l-mt-16 l-mb-24">
              {isEs
                ? 'Desde TPV a nóminas y contabilidad, conecta tus herramientas existentes en un ecosistema perfectamente integrado.'
                : 'From POS to payroll & accounts, plug in your existing tools for a seamlessly connected ecosystem.'
              }
            </p>
            {/* Integration logo grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 1fr)',
              gap: 8,
            }}>
              {integrationNames.map((name, i) => (
                <div
                  key={name}
                  style={{
                    background: i === 4 ? 'var(--l-bg-dark)' : 'var(--l-bg-cream)',
                    color: i === 4 ? 'var(--l-text-white)' : 'var(--l-text-muted-dark)',
                    borderRadius: 'var(--l-radius-sm)',
                    padding: '10px 4px',
                    fontSize: 11,
                    fontWeight: i === 4 ? 700 : 500,
                    textAlign: 'center',
                    opacity: i > 7 ? 0.4 : i > 5 ? 0.6 : 1,
                  }}
                >
                  {i === 4 ? 'Josephine' : name}
                </div>
              ))}
            </div>
          </div>

          {/* Card 3: Half — Real-time */}
          <div className="l-bento-card">
            <h3 className="l-headline-card">
              {isEs ? 'Automatización inteligente' : 'Smart automation'}
            </h3>
            <p className="l-body l-mt-16 l-mb-24">
              {isEs
                ? 'Desde pedidos automáticos hasta alertas proactivas, Josephine trabaja por ti 24/7.'
                : 'From automated ordering to proactive alerts, Josephine works for you 24/7.'
              }
            </p>
            <div style={{
              background: 'var(--l-bg-cream)',
              borderRadius: 'var(--l-radius-md)',
              padding: 20,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}>
              <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--l-accent-lavender)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Zap className="w-5 h-5" style={{ color: 'var(--l-text-dark)' }} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--l-text-dark)' }}>
                  {isEs ? 'Pedido automático creado' : 'Auto order created'}
                </div>
                <div style={{ fontSize: 13, color: 'var(--l-text-muted-dark)' }}>
                  {isEs ? '12 artículos · Proveedor: FreshDirect' : '12 items · Supplier: FreshDirect'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
