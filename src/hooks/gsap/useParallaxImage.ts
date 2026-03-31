/**
 * useParallaxImage — Scroll-driven parallax for images
 * 
 * Image moves at different speed than scroll (creates depth).
 * Uses GSAP ScrollTrigger for performance.
 */
import { useRef } from 'react';
import { gsap, useGSAP } from '@/lib/gsap';

interface ParallaxOptions {
  speed?: number; // 0.1 = subtle, 0.3 = strong
}

export function useParallaxImage(options: ParallaxOptions = {}) {
  const { speed = 0.2 } = options;
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!containerRef.current) return;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const img = containerRef.current.querySelector('img');
    if (!img) return;

    gsap.to(img, {
      y: () => containerRef.current!.offsetHeight * speed,
      ease: 'none',
      scrollTrigger: {
        trigger: containerRef.current,
        start: 'top bottom',
        end: 'bottom top',
        scrub: true,
      },
    });
  }, { scope: containerRef });

  return containerRef;
}
