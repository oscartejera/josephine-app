/**
 * LogoMarquee — Infinite horizontal scroll of brand logos
 * 
 * Auto-duplicated for seamless loop. Monochrome with hover reveal.
 * CSS-only animation with prefers-reduced-motion fallback.
 */
import { useTranslation } from 'react-i18next';

// Curated Unsplash restaurant/food brand placeholder logos
// In production, replace with actual partner brand logos
const LOGO_URLS = [
  { name: 'Badiani Gelato', url: 'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=120&h=48&fit=crop&q=80' },
  { name: 'Black Sheep Coffee', url: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=120&h=48&fit=crop&q=80' },
  { name: 'Boston Party', url: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=120&h=48&fit=crop&q=80' },
  { name: 'Oakberry', url: 'https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea?w=120&h=48&fit=crop&q=80' },
  { name: 'Roasting Plant', url: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=120&h=48&fit=crop&q=80' },
  { name: 'Camile Thai', url: 'https://images.unsplash.com/photo-1559847844-5315695dadae?w=120&h=48&fit=crop&q=80' },
  { name: 'Tasty Buns', url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=120&h=48&fit=crop&q=80' },
  { name: 'La Piazza', url: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=120&h=48&fit=crop&q=80' },
];

export function LogoMarquee() {
  // Duplicate logos for seamless loop
  const allLogos = [...LOGO_URLS, ...LOGO_URLS];

  return (
    <div className="l-marquee-container">
      <div className="l-marquee">
        {allLogos.map((logo, i) => (
          <div
            key={`${logo.name}-${i}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '12px 24px',
              background: 'var(--l-surface-white)',
              borderRadius: 'var(--l-radius-md)',
              border: '1px solid var(--l-border-light)',
              minWidth: 140,
              height: 60,
            }}
          >
            <span
              style={{
                fontFamily: 'var(--l-font-sans)',
                fontWeight: 700,
                fontSize: 13,
                color: 'var(--l-text-dark)',
                opacity: 0.6,
                whiteSpace: 'nowrap',
                letterSpacing: '0.02em',
              }}
            >
              {logo.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
