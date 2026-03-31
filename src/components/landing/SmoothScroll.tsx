/**
 * SmoothScroll — Lenis wrapper for landing pages only
 * 
 * Provides Apple/Nory-style smooth scrolling with inertia.
 * Integrates with GSAP ScrollTrigger for animation synchronization.
 */
import { useEffect, useRef, type ReactNode } from 'react';
import Lenis from 'lenis';
import { gsap } from '@/lib/gsap';

interface SmoothScrollProps {
  children: ReactNode;
}

export function SmoothScroll({ children }: SmoothScrollProps) {
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const lenis = new Lenis({
      duration: 1.2,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      touchMultiplier: 2,
      infinite: false,
    });

    lenisRef.current = lenis;

    // Sync with GSAP ScrollTrigger
    lenis.on('scroll', () => {
      // Lenis drives the scroll, GSAP ticker handles raf sync below
    });

    // Use GSAP ticker to drive Lenis
    const tickerCallback = (time: number) => {
      lenis.raf(time * 1000);
    };
    gsap.ticker.add(tickerCallback);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(tickerCallback);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  return <>{children}</>;
}
