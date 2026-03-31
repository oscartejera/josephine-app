/**
 * useMagneticHover — Button follows cursor within radius
 * 
 * Creates a "magnetic" effect where the button subtly attracts
 * toward the cursor when hovering nearby. Premium CTA interaction.
 */
import { useRef, useEffect, useCallback } from 'react';
import { gsap } from '@/lib/gsap';

interface MagneticOptions {
  /** Strength of the magnetic pull (0-1). Default 0.3 */
  strength?: number;
  /** Radius of effect in pixels. Default 100 */
  radius?: number;
}

export function useMagneticHover(options: MagneticOptions = {}) {
  const ref = useRef<HTMLElement>(null);
  const { strength = 0.3, radius = 100 } = options;

  const handleMouse = useCallback((e: MouseEvent) => {
    if (!ref.current) return;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const rect = ref.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < radius) {
      const pull = (1 - dist / radius) * strength;
      gsap.to(ref.current, {
        x: dx * pull,
        y: dy * pull,
        duration: 0.3,
        ease: 'power2.out',
      });
    } else {
      gsap.to(ref.current, {
        x: 0,
        y: 0,
        duration: 0.5,
        ease: 'power2.out',
      });
    }
  }, [strength, radius]);

  const handleLeave = useCallback(() => {
    if (!ref.current) return;
    gsap.to(ref.current, {
      x: 0,
      y: 0,
      duration: 0.5,
      ease: 'power2.out',
    });
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const parent = el.parentElement ?? document;
    parent.addEventListener('mousemove', handleMouse as EventListener);
    el.addEventListener('mouseleave', handleLeave);
    return () => {
      parent.removeEventListener('mousemove', handleMouse as EventListener);
      el.removeEventListener('mouseleave', handleLeave);
    };
  }, [handleMouse, handleLeave]);

  return ref;
}
