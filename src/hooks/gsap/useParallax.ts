/**
 * useParallax — ScrollTrigger-based parallax effect
 * 
 * Moves an element at a different speed than the scroll (configurable).
 * Used by hero photos, footer kinetic text, and module widgets.
 */
import { useRef } from 'react';
import { gsap, ScrollTrigger, useGSAP } from '@/lib/gsap';

interface ParallaxOptions {
  /** Speed multiplier. 0.5 = moves at half scroll speed. -0.3 = inverse */
  speed?: number;
  /** ScrollTrigger start position */
  start?: string;
  /** ScrollTrigger end position */
  end?: string;
}

export function useParallax(options: ParallaxOptions = {}) {
  const ref = useRef<HTMLElement>(null);
  const { speed = 0.3, start = 'top bottom', end = 'bottom top' } = options;

  useGSAP(() => {
    if (!ref.current) return;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    gsap.to(ref.current, {
      yPercent: speed * 100, // Convert speed to percentage
      ease: 'none',
      scrollTrigger: {
        trigger: ref.current,
        start,
        end,
        scrub: 0.5,
      },
    });
  }, { scope: ref });

  return ref;
}
