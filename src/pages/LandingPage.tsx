import '@/styles/landing.css';
import { LandingNavbar } from '@/components/landing/LandingNavbar';
import { HeroSection } from '@/components/landing/HeroSection';
import { StorySection } from '@/components/landing/StorySection';
import { ProblemSection } from '@/components/landing/ProblemSection';
import { FigureSection } from '@/components/landing/FigureSection';
import { BentoFeatures } from '@/components/landing/BentoFeatures';
import { MetricsSection } from '@/components/landing/MetricsSection';
import { IntegrationsMarquee } from '@/components/landing/IntegrationsMarquee';
import { CtaSection } from '@/components/landing/CtaSection';

export default function LandingPage() {
  return (
    <div className="landing-page">
      <LandingNavbar />
      <HeroSection />
      <StorySection />
      <ProblemSection />
      <FigureSection />
      <BentoFeatures />
      <MetricsSection />
      <IntegrationsMarquee />
      <CtaSection />
    </div>
  );
}
