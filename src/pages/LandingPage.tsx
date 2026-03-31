/**
 * LandingPage — Josephine homepage (Nory-style Empire Design)
 * 
 * Section order:
 * 1. Hero (dark BG, 2-col, lifestyle photo)
 * 2. Social Proof (cream BG, logo marquee)
 * 3. Why Brands Love (cream BG, headline + body)
 * 4. Bento Features (cream BG, notification widgets + integrations)
 * 5. Metrics (cream BG, 3 KPI counters)
 * 6. Module Showcase (cream BG, 4 stacked product cards)
 * 7. Pre-Footer CTA (dark BG, "Want better margins?")
 * 
 * Note: MegaMenu + Footer are rendered by LandingLayout wrapper.
 */
import { HeroSection } from '@/components/landing/HeroSection';
import { SocialProofBand } from '@/components/landing/SocialProofBand';
import { WhyBrandsLove } from '@/components/landing/WhyBrandsLove';
import { BentoFeatures } from '@/components/landing/BentoFeatures';
import { MetricsSection } from '@/components/landing/MetricsSection';
import { ModuleShowcase } from '@/components/landing/ModuleShowcase';
import { PreFooterCTA } from '@/components/landing/PreFooterCTA';

export default function LandingPage() {
  return (
    <>
      <HeroSection />
      <div className="l-gradient-bridge l-gradient-bridge-dark-to-cream" />
      <SocialProofBand />
      <WhyBrandsLove />
      <BentoFeatures />
      <MetricsSection />
      <ModuleShowcase />
      <div className="l-gradient-bridge l-gradient-bridge-cream-to-dark" />
      <PreFooterCTA />
    </>
  );
}
