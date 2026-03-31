import { useTranslation } from 'react-i18next';
import { SectionHeadline } from '@/components/landing/SectionHeadline';
import { PreFooterCTA } from '@/components/landing/PreFooterCTA';

export default function BlogPage() {
  const { i18n } = useTranslation();
  const isEs = i18n.language === 'es' || i18n.language === 'ca';

  const posts = [
    { title: isEs ? 'Cómo reducir la merma en un 50%' : 'How to reduce waste by 50%', date: 'Mar 2026', image: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&q=80' },
    { title: isEs ? 'El futuro de la IA en restauración' : 'The future of AI in restaurants', date: 'Feb 2026', image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=400&q=80' },
    { title: isEs ? 'Guía de optimización laboral' : 'Labour optimization guide', date: 'Jan 2026', image: 'https://images.unsplash.com/photo-1552566626-52f8b828add9?w=400&q=80' },
  ];

  return (
    <>
      <section className="l-section-dark l-hero">
        <div className="l-container l-text-center" style={{ paddingTop: 140, paddingBottom: 80 }}>
          <SectionHeadline as="h1" variant="hero" text="Blog" align="center" color="var(--l-accent-lavender)" />
          <p className="l-body-light l-mt-24 l-mx-auto" style={{ maxWidth: 500, textAlign: 'center' }}>
            {isEs ? 'Insights, ideas y novedades del mundo de la restauración.' : 'Insights, ideas, and news from the restaurant world.'}
          </p>
        </div>
      </section>

      <section className="l-section-cream" style={{ padding: '80px 24px' }}>
        <div className="l-container">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
            {posts.map((post, i) => (
              <div key={i} className="l-card-flat" style={{ overflow: 'hidden' }}>
                <img src={post.image} alt="" loading="lazy" style={{ width: '100%', height: 200, objectFit: 'cover' }} />
                <div style={{ padding: 24 }}>
                  <div style={{ fontSize: 13, color: 'var(--l-text-muted-dark)', marginBottom: 8 }}>{post.date}</div>
                  <h3 className="l-headline-small">{post.title}</h3>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <PreFooterCTA />
    </>
  );
}
