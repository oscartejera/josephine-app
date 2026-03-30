/**
 * useStaggerReveal — Animate children into view with staggered timing
 * 
 * Creates a premium entrance effect where elements appear one after another
 * with a slight y-offset and fade. Perfect for card grids, table rows, lists.
 * 
 * Usage:
 *   const containerRef = useStaggerReveal('.kpi-card', { stagger: 0.08 });
 *   return <div ref={containerRef}>...</div>
 */
import { useRef } from 'react';
import { gsap, useGSAP } from '@/lib/gsap';

interface StaggerRevealOptions {
  stagger?: number;
  duration?: number;
  y?: number;
  ease?: string;
  delay?: number;
}

export function useStaggerReveal(
  selector: string,
  options: StaggerRevealOptions = {}
) {
  const {
    stagger = 0.08,
    duration = 0.5,
    y = 20,
    ease = 'power2.out',
    delay = 0.1,
  } = options;

  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    // Respect prefers-reduced-motion
    const mm = gsap.matchMedia();
    mm.add(
      {
        normal: '(prefers-reduced-motion: no-preference)',
        reduced: '(prefers-reduced-motion: reduce)',
      },
      (context) => {
        const { reduced } = context.conditions!;
        if (reduced) return; // Skip animations for reduced motion

        gsap.from(selector, {
          y,
          autoAlpha: 0,
          duration,
          stagger,
          ease,
          delay,
        });
      }
    );
  }, { scope: containerRef });

  return containerRef;
}
