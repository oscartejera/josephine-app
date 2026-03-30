/**
 * useGaugeAnimation — Animate a gauge/progress arc to a target percentage
 * 
 * Creates a smooth arc animation for COL% gauges, efficiency meters, etc.
 * Uses stroke-dashoffset for SVG or rotation for CSS-based gauges.
 * 
 * Usage:
 *   const { progress, ref } = useGaugeAnimation(29.3, 100);
 *   // progress = animated 0-29.3 value
 */
import { useRef, useState } from 'react';
import { gsap, useGSAP } from '@/lib/gsap';

interface GaugeOptions {
  duration?: number;
  ease?: string;
  delay?: number;
}

export function useGaugeAnimation(
  value: number,
  max: number = 100,
  options: GaugeOptions = {}
) {
  const {
    duration = 1.5,
    ease = 'power3.out',
    delay = 0.3,
  } = options;

  const ref = useRef<HTMLElement>(null);
  const proxy = useRef({ progress: 0 });
  const [progress, setProgress] = useState(0);

  useGSAP(() => {
    const targetProgress = Math.min(value / max, 1) * 100;

    gsap.to(proxy.current, {
      progress: targetProgress,
      duration,
      ease,
      delay,
      snap: { progress: 0.1 },
      onUpdate: () => {
        setProgress(proxy.current.progress);
      },
    });
  }, { dependencies: [value, max] });

  return { progress, ref };
}
