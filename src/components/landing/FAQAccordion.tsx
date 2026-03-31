/**
 * FAQAccordion — Expandable Q&A with GSAP height animation
 * 
 * "+" icon rotates to "×" on open. Smooth GSAP height transition.
 * Used on product pages, solutions pages, and homepage.
 */
import { useState, useRef, useCallback } from 'react';
import { gsap, useGSAP } from '@/lib/gsap';
import { cn } from '@/lib/utils';

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQAccordionProps {
  items: FAQItem[];
  className?: string;
}

export function FAQAccordion({ items, className }: FAQAccordionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = useCallback((index: number) => {
    setOpenIndex(prev => prev === index ? null : index);
  }, []);

  return (
    <div className={className}>
      {items.map((item, i) => (
        <FAQItemRow
          key={i}
          item={item}
          isOpen={openIndex === i}
          onToggle={() => toggle(i)}
        />
      ))}
    </div>
  );
}

function FAQItemRow({ item, isOpen, onToggle }: { item: FAQItem; isOpen: boolean; onToggle: () => void }) {
  const answerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!answerRef.current || !innerRef.current) return;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (isOpen) {
      const h = innerRef.current.scrollHeight;
      gsap.to(answerRef.current, {
        height: h,
        duration: prefersReduced ? 0 : 0.4,
        ease: 'power2.out',
      });
    } else {
      gsap.to(answerRef.current, {
        height: 0,
        duration: prefersReduced ? 0 : 0.3,
        ease: 'power2.in',
      });
    }
  }, { dependencies: [isOpen] });

  return (
    <div className={cn('l-faq-item', isOpen && 'open')}>
      <button
        className="l-faq-question"
        onClick={onToggle}
        aria-expanded={isOpen}
      >
        <span>{item.question}</span>
        <span className="l-faq-icon">+</span>
      </button>
      <div ref={answerRef} className="l-faq-answer" aria-hidden={!isOpen}>
        <div ref={innerRef} className="l-faq-answer-inner">
          {item.answer}
        </div>
      </div>
    </div>
  );
}
