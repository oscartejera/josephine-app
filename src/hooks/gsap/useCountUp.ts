/**
 * useCountUp — Animate a number from 0 (or previous value) to target value
 * 
 * Creates a premium "counting up" effect for KPI cards, revenue figures, etc.
 * Uses GSAP snap to ensure integers, and formats with locale string.
 * 
 * Usage:
 *   const { ref, displayValue } = useCountUp(28400, { prefix: '€', duration: 1.2 });
 *   return <span ref={ref}>{displayValue}</span>
 */
import { useRef, useState, useCallback } from 'react';
import { gsap, useGSAP } from '@/lib/gsap';

interface CountUpOptions {
  duration?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  ease?: string;
  separator?: string;
}

export function useCountUp(
  targetValue: number,
  options: CountUpOptions = {}
) {
  const {
    duration = 1.2,
    prefix = '',
    suffix = '',
    decimals = 0,
    ease = 'power2.out',
    separator = ',',
  } = options;

  const ref = useRef<HTMLElement>(null);
  const proxy = useRef({ value: 0 });
  const [displayValue, setDisplayValue] = useState(`${prefix}0${suffix}`);

  const formatNumber = useCallback((n: number) => {
    const formatted = decimals > 0
      ? n.toFixed(decimals)
      : Math.round(n).toLocaleString('es-ES');
    return `${prefix}${formatted}${suffix}`;
  }, [prefix, suffix, decimals]);

  useGSAP(() => {
    if (targetValue === 0 || targetValue === proxy.current.value) {
      setDisplayValue(formatNumber(targetValue));
      return;
    }

    gsap.to(proxy.current, {
      value: targetValue,
      duration,
      ease,
      snap: { value: decimals > 0 ? 1 / Math.pow(10, decimals) : 1 },
      onUpdate: () => {
        setDisplayValue(formatNumber(proxy.current.value));
      },
    });
  }, { dependencies: [targetValue] });

  return { ref, displayValue };
}
