/**
 * ModuleShowcaseCard — Universal product feature card
 * 
 * Layout: Text LEFT + Widget visual RIGHT (inside colored bg panel)
 * Used on homepage module showcase and product page sections.
 * GSAP: slide-up on scroll + widget scale pop-in.
 */
import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { gsap, ScrollTrigger, useGSAP } from '@/lib/gsap';
import { BadgePill } from './BadgePill';

interface ModuleShowcaseCardProps {
  badge: string;
  badgeColor: 'red' | 'blue' | 'green' | 'yellow' | 'orange' | 'lavender';
  headline: string;
  description?: string;
  ctaText?: string;
  ctaHref?: string;
  widgetBg: string;
  children?: React.ReactNode; // Widget slot
}

export function ModuleShowcaseCard({
  badge,
  badgeColor,
  headline,
  description,
  ctaText = 'Learn more',
  ctaHref,
  widgetBg,
  children,
}: ModuleShowcaseCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!cardRef.current) return;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    // Card slide up — use set+to for safe visibility
    gsap.set(cardRef.current, { autoAlpha: 0, y: 50 });
    gsap.to(cardRef.current, {
      autoAlpha: 1,
      y: 0,
      duration: 0.8,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: cardRef.current,
        start: 'top 90%',
        toggleActions: 'play none none reverse',
      },
    });

    // Widget pop-in with delay
    if (widgetRef.current) {
      gsap.set(widgetRef.current, { scale: 0.9, autoAlpha: 0 });
      gsap.to(widgetRef.current, {
        scale: 1,
        autoAlpha: 1,
        duration: 0.6,
        ease: 'power2.out',
        delay: 0.3,
        scrollTrigger: {
          trigger: cardRef.current,
          start: 'top 90%',
          toggleActions: 'play none none reverse',
        },
      });
    }
  }, { scope: cardRef });

  return (
    <div ref={cardRef} className="l-module-card">
      {/* Text side */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <BadgePill text={badge} color={badgeColor} />
        <h3 className="l-headline-card">{headline}</h3>
        {description && <p className="l-body">{description}</p>}
        {ctaHref && (
          <Link
            to={ctaHref}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              fontWeight: 500,
              fontSize: 15,
              color: 'var(--l-text-dark)',
              textDecoration: 'underline',
              textUnderlineOffset: 4,
            }}
          >
            {ctaText}
            <ArrowRight className="w-4 h-4" />
          </Link>
        )}
      </div>

      {/* Widget side */}
      <div
        ref={widgetRef}
        className="l-module-widget"
        style={{ background: widgetBg }}
      >
        {children}
      </div>
    </div>
  );
}
