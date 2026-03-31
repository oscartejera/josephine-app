/**
 * SuccessStoryCarousel — Horizontal snap carousel with parallax
 * 
 * Each card: photo background + white overlay with KPI + brand + link.
 * Controls: prev/next arrows + progress indicator.
 */
import { useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import { SectionHeadline } from './SectionHeadline';

interface SuccessStory {
  imageUrl: string;
  kpi: string;
  kpiLabel: string;
  brand: string;
  href: string;
}

interface SuccessStoryCarouselProps {
  stories?: SuccessStory[];
  className?: string;
}

const DEFAULT_STORIES: SuccessStory[] = [
  {
    imageUrl: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80',
    kpi: '50%',
    kpiLabel: 'reduction in unaccounted waste',
    brand: 'La Piazza',
    href: '/success-stories',
  },
  {
    imageUrl: 'https://images.unsplash.com/photo-1552566626-52f8b828add9?w=800&q=80',
    kpi: '3.2x',
    kpiLabel: 'ROI in the first year',
    brand: 'Café Montmartre',
    href: '/success-stories',
  },
  {
    imageUrl: 'https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?w=800&q=80',
    kpi: '20%',
    kpiLabel: 'lower labour costs',
    brand: 'Urban Bites Group',
    href: '/success-stories',
  },
  {
    imageUrl: 'https://images.unsplash.com/photo-1559329007-40df8a9345d8?w=800&q=80',
    kpi: '95%',
    kpiLabel: 'forecast accuracy achieved',
    brand: 'Sakura Ramen',
    href: '/success-stories',
  },
];

export function SuccessStoryCarousel({ stories = DEFAULT_STORIES, className }: SuccessStoryCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(true);
  const { i18n } = useTranslation();
  const isEs = i18n.language === 'es' || i18n.language === 'ca';

  const checkScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setCanPrev(scrollLeft > 10);
    setCanNext(scrollLeft < scrollWidth - clientWidth - 10);
  }, []);

  const scroll = useCallback((dir: 'prev' | 'next') => {
    if (!scrollRef.current) return;
    const amount = 424; // card width + gap
    scrollRef.current.scrollBy({
      left: dir === 'next' ? amount : -amount,
      behavior: 'smooth',
    });
    setTimeout(checkScroll, 400);
  }, [checkScroll]);

  return (
    <section className={className} style={{ padding: '80px 0' }}>
      <div className="l-container">
        <div className="l-flex l-items-center l-justify-between l-mb-32">
          <SectionHeadline
            text={isEs ? 'Casos de éxito' : 'Success stories'}
            variant="section"
          />
          <Link to="/success-stories" className="l-btn-outline" style={{ flexShrink: 0 }}>
            {isEs ? 'Ver todos' : 'Read more case studies'}
          </Link>
        </div>
      </div>

      <div style={{ paddingLeft: 'max(24px, calc((100vw - var(--l-max-width)) / 2 + 24px))' }}>
        <div
          ref={scrollRef}
          className="l-carousel"
          onScroll={checkScroll}
        >
          {stories.map((story, i) => (
            <div key={i} className="l-carousel-item">
              <div
                className="l-card-flat"
                style={{
                  position: 'relative',
                  height: 400,
                  overflow: 'hidden',
                }}
              >
                {/* Background photo */}
                <img
                  src={story.imageUrl}
                  alt={story.brand}
                  loading="lazy"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    position: 'absolute',
                    inset: 0,
                  }}
                />
                {/* Gradient overlay */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(to top, rgba(14,12,19,0.85) 0%, rgba(14,12,19,0.2) 50%, transparent 100%)',
                  }}
                />
                {/* Content overlay */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    padding: 32,
                    color: 'var(--l-text-white)',
                  }}
                >
                  <div style={{
                    fontFamily: 'var(--l-font-serif)',
                    fontWeight: 700,
                    fontSize: 36,
                    lineHeight: 1.1,
                    marginBottom: 4,
                  }}>
                    {story.kpi}
                  </div>
                  <div style={{ fontSize: 15, opacity: 0.85, marginBottom: 12 }}>
                    {story.kpiLabel}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{story.brand}</span>
                    <Link
                      to={story.href}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: 14,
                        fontWeight: 500,
                        color: 'var(--l-accent-lavender)',
                        textDecoration: 'none',
                      }}
                    >
                      {isEs ? 'Leer más' : 'Read more'}
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="l-container" style={{ marginTop: 20 }}>
        <div className="l-carousel-controls">
          <button
            className="l-carousel-arrow"
            onClick={() => scroll('prev')}
            disabled={!canPrev}
            aria-label="Previous"
            style={{ opacity: canPrev ? 1 : 0.3 }}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            className="l-carousel-arrow"
            onClick={() => scroll('next')}
            disabled={!canNext}
            aria-label="Next"
            style={{ opacity: canNext ? 1 : 0.3 }}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </section>
  );
}
