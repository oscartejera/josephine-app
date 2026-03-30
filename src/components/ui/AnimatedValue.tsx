/**
 * AnimatedValue — A GSAP-powered counter component
 * 
 * Wraps a numeric value and animates it from 0 to target with easing.
 * Handles currency prefixes, percentages, and plain numbers.
 * 
 * Usage:
 *   <AnimatedValue value={31242} prefix="€" />
 *   <AnimatedValue value={68.0} suffix="%" decimals={1} />
 *   <AnimatedValue value={495} />
 */
import { useRef, useEffect, useState, memo } from 'react';
import { gsap, useGSAP } from '@/lib/gsap';

interface AnimatedValueProps {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  duration?: number;
  className?: string;
}

export const AnimatedValue = memo(function AnimatedValue({
  value,
  prefix = '',
  suffix = '',
  decimals = 0,
  duration = 1.4,
  className,
}: AnimatedValueProps) {
  const spanRef = useRef<HTMLSpanElement>(null);
  const proxy = useRef({ val: 0 });
  const hasAnimated = useRef(false);

  const format = (n: number) => {
    if (decimals > 0) {
      return `${prefix}${n.toFixed(decimals)}${suffix}`;
    }
    return `${prefix}${Math.round(n).toLocaleString('es-ES')}${suffix}`;
  };

  useGSAP(() => {
    if (value === 0 || !spanRef.current) return;

    // Only animate on first meaningful render, not on re-renders
    if (hasAnimated.current) {
      if (spanRef.current) spanRef.current.textContent = format(value);
      return;
    }

    hasAnimated.current = true;
    proxy.current.val = 0;

    // Respect prefers-reduced-motion
    const mm = gsap.matchMedia();
    mm.add(
      {
        normal: '(prefers-reduced-motion: no-preference)',
        reduced: '(prefers-reduced-motion: reduce)',
      },
      (context) => {
        const { reduced } = context.conditions!;
        if (reduced) {
          if (spanRef.current) spanRef.current.textContent = format(value);
          return;
        }

        gsap.to(proxy.current, {
          val: value,
          duration,
          ease: 'power2.out',
          snap: { val: decimals > 0 ? 1 / Math.pow(10, decimals) : 1 },
          onUpdate: () => {
            if (spanRef.current) {
              spanRef.current.textContent = format(proxy.current.val);
            }
          },
        });
      }
    );
  }, { dependencies: [value] });

  return (
    <span ref={spanRef} className={className}>
      {format(0)}
    </span>
  );
});
