/**
 * CustomCursor — Premium chef-hat cursor for landing pages
 * 
 * Only renders on desktop (pointer: fine).
 * Uses the Josephine chef hat as cursor, with a soft glow follower.
 * Grows on hover over interactive elements.
 */
import { useEffect, useRef, useState } from 'react';
import { gsap } from '@/lib/gsap';

export function CustomCursor() {
  const hatRef = useRef<HTMLDivElement>(null);
  const followerRef = useRef<HTMLDivElement>(null);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    // Only show on pointer devices (no touch)
    const mql = window.matchMedia('(pointer: fine)');
    setIsDesktop(mql.matches);
    if (!mql.matches) return;

    const hat = hatRef.current;
    const follower = followerRef.current;
    if (!hat || !follower) return;

    const onMove = (e: MouseEvent) => {
      gsap.to(hat, {
        x: e.clientX - 12,
        y: e.clientY - 12,
        duration: 0.08,
        ease: 'power2.out',
      });
      gsap.to(follower, {
        x: e.clientX - 20,
        y: e.clientY - 20,
        duration: 0.3,
        ease: 'power2.out',
      });
    };

    const onEnterInteractive = () => {
      follower.classList.add('hovering');
      gsap.to(hat, { scale: 1.3, duration: 0.2 });
    };

    const onLeaveInteractive = () => {
      follower.classList.remove('hovering');
      gsap.to(hat, { scale: 1, duration: 0.2 });
    };

    window.addEventListener('mousemove', onMove);

    // Attach hover listeners to interactive elements
    const interactiveSelector = 'a, button, .l-btn-primary, .l-btn-ghost, .l-btn-dark, .l-btn-outline, .l-bento-card, .l-module-card';
    const interactives = document.querySelectorAll(interactiveSelector);
    interactives.forEach(el => {
      el.addEventListener('mouseenter', onEnterInteractive);
      el.addEventListener('mouseleave', onLeaveInteractive);
    });

    return () => {
      window.removeEventListener('mousemove', onMove);
      interactives.forEach(el => {
        el.removeEventListener('mouseenter', onEnterInteractive);
        el.removeEventListener('mouseleave', onLeaveInteractive);
      });
    };
  }, [isDesktop]);

  if (!isDesktop) return null;

  return (
    <>
      {/* Chef hat cursor */}
      <div ref={hatRef} className="l-custom-cursor">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--l-accent-lavender)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21a1 1 0 0 0 1-1v-5.35c0-.457.316-.844.727-1.041a4 4 0 0 0-2.646-7.502 6 6 0 0 0-11.162 0A4 4 0 0 0 2.273 14.609C2.684 14.806 3 15.193 3 15.65V20a1 1 0 0 0 1 1z"/>
          <path d="M7.5 17h9"/>
        </svg>
      </div>
      {/* Glow follower */}
      <div ref={followerRef} className="l-cursor-follower" />
    </>
  );
}
