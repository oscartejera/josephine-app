/**
 * SectionHeadline — Serif headline with SplitText reveal animation
 * 
 * Reusable component for all landing page section titles.
 * Auto-animates on scroll using useSplitTextReveal hook.
 */
import { forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { useSplitTextReveal } from '@/hooks/gsap/useSplitTextReveal';

interface SectionHeadlineProps {
  text: string;
  as?: 'h1' | 'h2' | 'h3' | 'h4';
  variant?: 'hero' | 'section' | 'card' | 'small';
  color?: string;
  italic?: boolean;
  align?: 'left' | 'center' | 'right';
  className?: string;
  maxWidth?: string;
}

const variantClasses = {
  hero: 'l-headline-hero',
  section: 'l-headline-section',
  card: 'l-headline-card',
  small: 'l-headline-small',
};

export function SectionHeadline({
  text,
  as: Tag = 'h2',
  variant = 'section',
  color,
  italic = false,
  align = 'left',
  className,
  maxWidth,
}: SectionHeadlineProps) {
  const ref = useSplitTextReveal({
    stagger: variant === 'hero' ? 0.06 : 0.04,
    yOffset: variant === 'hero' ? 50 : 30,
  });

  return (
    <Tag
      ref={ref as React.Ref<HTMLHeadingElement>}
      className={cn(
        variantClasses[variant],
        align === 'center' && 'l-text-center',
        align === 'right' && 'l-text-right',
        className
      )}
      style={{
        color: color || undefined,
        fontStyle: italic ? 'italic' : undefined,
        maxWidth: maxWidth || undefined,
      }}
    >
      {text}
    </Tag>
  );
}
