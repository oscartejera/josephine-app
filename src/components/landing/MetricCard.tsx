/**
 * MetricCard — Large animated metric display
 * 
 * Shows a big number (counter ticker) with a label below.
 * Uses useCountUp for scroll-triggered number animation.
 */
import { useRef } from 'react';
import { gsap, ScrollTrigger, useGSAP } from '@/lib/gsap';
import { useCountUp } from '@/hooks/gsap';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  /** Display value when no animation (e.g. "8.8x") */
  value: string;
  /** Numeric target for counter animation */
  numericValue?: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
  label: string;
  bg?: string;
  className?: string;
}

export function MetricCard({
  value,
  numericValue,
  suffix = '',
  prefix = '',
  decimals = 0,
  label,
  bg,
  className,
}: MetricCardProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Animated counter
  const { ref: counterRef, displayValue } = useCountUp(numericValue ?? 0, {
    duration: 2,
    suffix,
    prefix,
    decimals,
  });

  // Scroll-triggered fade-in
  useGSAP(() => {
    if (!containerRef.current) return;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    gsap.from(containerRef.current, {
      y: 30,
      opacity: 0,
      duration: 0.6,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: containerRef.current,
        start: 'top 90%',
        toggleActions: 'play none none none',
      },
    });
  }, { scope: containerRef });

  return (
    <div
      ref={containerRef}
      className={cn('l-metric-card', className)}
      style={bg ? { background: bg, borderRadius: 'var(--l-radius-lg)', padding: '48px' } : undefined}
    >
      <div className="l-metric-value">
        {numericValue !== undefined ? (
          <span ref={counterRef}>{displayValue}</span>
        ) : (
          value
        )}
      </div>
      <div className="l-metric-label">{label}</div>
    </div>
  );
}
