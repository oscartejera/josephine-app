/**
 * LogoMarquee — Premium double-row infinite scroll
 * 
 * Stylized brand logos using distinct typography (not real logos).
 * Row 1 scrolls left, Row 2 scrolls right for depth.
 * Grayscale by default, full opacity on hover.
 */

const BRANDS_ROW_1 = [
  { name: 'Badiani Gelato', font: "'Playfair Display', serif", weight: 700, style: 'italic' },
  { name: 'BLACK SHEEP', font: "'Inter', sans-serif", weight: 800, style: 'normal', tracking: '0.15em' },
  { name: 'Boston Party', font: "'Playfair Display', serif", weight: 400, style: 'italic' },
  { name: 'OAKBERRY', font: "'Inter', sans-serif", weight: 900, style: 'normal', tracking: '0.2em' },
  { name: 'Roasting Plant', font: "'Playfair Display', serif", weight: 700, style: 'normal' },
  { name: 'Camile Thai', font: "'Inter', sans-serif", weight: 600, style: 'normal' },
  { name: 'Tasty Buns', font: "'Playfair Display', serif", weight: 700, style: 'italic' },
  { name: 'LA PIAZZA', font: "'Inter', sans-serif", weight: 800, style: 'normal', tracking: '0.12em' },
];

const BRANDS_ROW_2 = [
  { name: 'SAKURA RAMEN', font: "'Inter', sans-serif", weight: 800, style: 'normal', tracking: '0.15em' },
  { name: 'Urban Bites', font: "'Playfair Display', serif", weight: 700, style: 'italic' },
  { name: 'CAFÉ MONTMARTRE', font: "'Inter', sans-serif", weight: 700, style: 'normal', tracking: '0.08em' },
  { name: 'The Green Fork', font: "'Playfair Display', serif", weight: 400, style: 'italic' },
  { name: 'NOMA BISTRO', font: "'Inter', sans-serif", weight: 900, style: 'normal', tracking: '0.18em' },
  { name: 'Ember & Ash', font: "'Playfair Display', serif", weight: 700, style: 'normal' },
  { name: 'HARVEST TABLE', font: "'Inter', sans-serif", weight: 800, style: 'normal', tracking: '0.12em' },
  { name: 'Côte Brasserie', font: "'Playfair Display', serif", weight: 700, style: 'italic' },
];

interface BrandLogo {
  name: string;
  font: string;
  weight: number;
  style: string;
  tracking?: string;
}

function BrandItem({ brand }: { brand: BrandLogo }) {
  return (
    <span
      style={{
        fontFamily: brand.font,
        fontWeight: brand.weight,
        fontStyle: brand.style,
        letterSpacing: brand.tracking || '0',
        fontSize: 'clamp(16px, 2vw, 22px)',
        color: 'var(--l-text-dark)',
        opacity: 0.35,
        whiteSpace: 'nowrap',
        userSelect: 'none',
        transition: 'opacity 0.3s ease',
        cursor: 'default',
        padding: '0 8px',
      }}
      onMouseEnter={e => { (e.target as HTMLSpanElement).style.opacity = '0.85'; }}
      onMouseLeave={e => { (e.target as HTMLSpanElement).style.opacity = '0.35'; }}
    >
      {brand.name}
    </span>
  );
}

export function LogoMarquee() {
  const row1 = [...BRANDS_ROW_1, ...BRANDS_ROW_1, ...BRANDS_ROW_1];
  const row2 = [...BRANDS_ROW_2, ...BRANDS_ROW_2, ...BRANDS_ROW_2];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Row 1 — scrolls left */}
      <div className="l-marquee-container">
        <div className="l-marquee" style={{ gap: 56 }}>
          {row1.map((brand, i) => (
            <BrandItem key={`r1-${i}`} brand={brand} />
          ))}
        </div>
      </div>
      {/* Row 2 — scrolls right (reverse) */}
      <div className="l-marquee-container">
        <div
          className="l-marquee"
          style={{
            gap: 56,
            animationDirection: 'reverse',
            animationDuration: '45s',
          }}
        >
          {row2.map((brand, i) => (
            <BrandItem key={`r2-${i}`} brand={brand} />
          ))}
        </div>
      </div>
    </div>
  );
}
