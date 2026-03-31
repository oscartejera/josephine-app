/**
 * useSplitTextReveal — GSAP SplitText + stagger reveal on ScrollTrigger
 * 
 * Splits text into words and reveals them bottom-up with stagger.
 * Used by SectionHeadline and all serif headlines across landing pages.
 */
import { useRef } from 'react';
import { gsap, SplitText, ScrollTrigger, useGSAP } from '@/lib/gsap';

interface SplitTextRevealOptions {
  /** Stagger delay between words (seconds) */
  stagger?: number;
  /** Y offset for initial position (px) */
  yOffset?: number;
  /** Duration of each word animation */
  duration?: number;
  /** ScrollTrigger start position */
  start?: string;
  /** Whether to trigger once or replay */
  once?: boolean;
}

export function useSplitTextReveal(
  options: SplitTextRevealOptions = {}
) {
  const ref = useRef<HTMLElement>(null);
  const {
    stagger = 0.05,
    yOffset = 40,
    duration = 0.7,
    start = 'top 85%',
    once = true,
  } = options;

  useGSAP(() => {
    if (!ref.current) return;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const split = new SplitText(ref.current, { type: 'words' });

    gsap.set(split.words, { autoAlpha: 0, y: yOffset });
    gsap.to(split.words, {
      autoAlpha: 1,
      y: 0,
      duration,
      stagger,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: ref.current,
        start,
        toggleActions: once ? 'play none none none' : 'play none none reverse',
      },
    });

    return () => {
      split.revert();
    };
  }, { scope: ref });

  return ref;
}
