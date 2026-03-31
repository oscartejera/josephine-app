/**
 * useFloatingWidget — Subtle yoyo vertical oscillation
 * 
 * Makes elements "float" with a gentle up-down motion.
 * Used by product card widgets, notification pills, hero overlays.
 */
import { useRef } from 'react';
import { gsap, useGSAP } from '@/lib/gsap';

interface FloatingOptions {
  /** Max Y offset in pixels. Default 8 */
  amplitude?: number;
  /** Duration of one cycle in seconds. Default 3 */
  duration?: number;
  /** Random delay before starting (0 to delayMax). Default 0.5 */
  delayMax?: number;
}

export function useFloatingWidget(options: FloatingOptions = {}) {
  const ref = useRef<HTMLElement>(null);
  const { amplitude = 8, duration = 3, delayMax = 0.5 } = options;

  useGSAP(() => {
    if (!ref.current) return;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    gsap.to(ref.current, {
      y: amplitude,
      duration,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: -1,
      delay: Math.random() * delayMax,
    });
  }, { scope: ref });

  return ref;
}
