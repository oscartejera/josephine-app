/**
 * LandingPage — Josephine homepage (Nory-style Empire Design)
 * 
 * Section order (verified from Nory spec):
 * 1. Hero (dark BG, 2-col, lifestyle photo)
 * 2. Social Proof (cream BG, logo marquee)
 * 3. Why Brands Love (cream BG, headline + body)
 * 4. Bento Features (cream BG, notification widgets + integrations)
 * 5. Metrics (cream BG, 3 KPI counters)
 * 6. Module Showcase (cream BG, 4 stacked product cards)
 * 7. Success Stories (cream BG, horizontal carousel)
 * 8. Pre-Footer CTA (dark BG, "Want better margins?")
 * 
 * Note: MegaMenu + Footer are rendered by LandingLayout wrapper.
 */
import { HeroSection } from '@/components/landing/HeroSection';
import { SocialProofBand } from '@/components/landing/SocialProofBand';
import { WhyBrandsLove } from '@/components/landing/WhyBrandsLove';
import { BentoFeatures } from '@/components/landing/BentoFeatures';
import { MetricsSection } from '@/components/landing/MetricsSection';
import { ModuleShowcase } from '@/components/landing/ModuleShowcase';
import { SuccessStoryCarousel } from '@/components/landing/SuccessStoryCarousel';
import { PreFooterCTA } from '@/components/landing/PreFooterCTA';

export default function LandingPage() {
  return (
    <>
      <HeroSection />
      <SocialProofBand />
      <WhyBrandsLove />
      <BentoFeatures />
      <MetricsSection />
      <ModuleShowcase />
      <SuccessStoryCarousel className="l-section-cream" />
      <PreFooterCTA />
    </>
  );
}
