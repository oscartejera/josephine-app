/**
 * CustomCursor — Premium dot + follower cursor for landing pages
 * 
 * Only renders on desktop (pointer: fine).
 * Dot follows cursor instantly, follower follows with spring delay.
 * Grows on hover over interactive elements.
 */
import { useEffect, useRef, useState } from 'react';
import { gsap } from '@/lib/gsap';

export function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const followerRef = useRef<HTMLDivElement>(null);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    // Only show on pointer devices (no touch)
    const mql = window.matchMedia('(pointer: fine)');
    setIsDesktop(mql.matches);
    if (!mql.matches) return;

    const dot = dotRef.current;
    const follower = followerRef.current;
    if (!dot || !follower) return;

    const onMove = (e: MouseEvent) => {
      gsap.to(dot, {
        x: e.clientX - 4,
        y: e.clientY - 4,
        duration: 0.1,
        ease: 'power2.out',
      });
      gsap.to(follower, {
        x: e.clientX - 18,
        y: e.clientY - 18,
        duration: 0.35,
        ease: 'power2.out',
      });
    };

    const onEnterInteractive = () => {
      follower.classList.add('hovering');
      gsap.to(dot, { scale: 0.5, duration: 0.2 });
    };

    const onLeaveInteractive = () => {
      follower.classList.remove('hovering');
      gsap.to(dot, { scale: 1, duration: 0.2 });
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
      <div ref={dotRef} className="l-custom-cursor" />
      <div ref={followerRef} className="l-cursor-follower" />
    </>
  );
}
