import { useTranslation } from 'react-i18next';

const integrations = [
  'Square', 'Lightspeed', 'Toast', 'Revel', 'Clover',
  'Aloha', 'Stripe', 'HubSpot', 'Xero',
];

export function IntegrationsMarquee() {
  const { i18n } = useTranslation();
  const isEs = i18n.language === 'es';

  // Double the array for seamless infinite scroll
  const allItems = [...integrations, ...integrations];

  return (
    <section style={{ background: 'var(--landing-bg)', overflow: 'hidden' }}>
      <div className="landing-section" style={{ paddingTop: '60px', paddingBottom: '60px' }}>
        <p className="text-center landing-body-sm mb-10" style={{ color: 'var(--landing-muted)' }}>
          {isEs
            ? 'Se conecta con las herramientas que ya usas.'
            : 'Works with the tools you already use.'}
        </p>

        <div className="relative overflow-hidden">
          {/* Fade edges */}
          <div className="absolute inset-y-0 left-0 w-20 z-10"
               style={{ background: 'linear-gradient(to right, var(--landing-bg), transparent)' }} />
          <div className="absolute inset-y-0 right-0 w-20 z-10"
               style={{ background: 'linear-gradient(to left, var(--landing-bg), transparent)' }} />

          {/* Marquee */}
          <div className="landing-marquee">
            {allItems.map((name, i) => (
              <div
                key={i}
                className="flex-shrink-0 px-6 py-3 rounded-lg border border-white/10 bg-white/5 text-sm font-medium"
                style={{ color: 'var(--landing-muted)' }}
              >
                {name}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
