/**
 * useTiltEffect — Mouse-following 3D tilt on cards
 * 
 * Subtle perspective tilt that follows mouse position.
 * Max 3-5 degrees rotation for premium feel without being distracting.
 */
import { useRef, useEffect } from 'react';
import { gsap } from '@/lib/gsap';

interface TiltOptions {
  maxTilt?: number; // max degrees
  speed?: number; // transition speed in seconds
}

export function useTiltEffect(options: TiltOptions = {}) {
  const { maxTilt = 4, speed = 0.4 } = options;
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;

      gsap.to(el, {
        rotateX: -y * maxTilt,
        rotateY: x * maxTilt,
        duration: speed,
        ease: 'power2.out',
        transformPerspective: 1000,
      });
    };

    const onLeave = () => {
      gsap.to(el, {
        rotateX: 0,
        rotateY: 0,
        duration: speed * 1.5,
        ease: 'power2.out',
      });
    };

    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);

    return () => {
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseleave', onLeave);
    };
  }, [maxTilt, speed]);

  return ref;
}
