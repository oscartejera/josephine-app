/**
 * LandingLayout — Universal layout wrapper for public landing pages
 * 
 * Renders MegaMenu + page content (Outlet) + LandingFooter + FloatingCTA.
 * Pages with `layout: 'isolated'` (Book a Chat, ROI Calculator) bypass this.
 */
import { Outlet, useLocation, ScrollRestoration } from 'react-router-dom';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import '@/styles/landing.css';
import { landingPagesMeta } from '@/data/landing/landingRoutes';

// Lazy-loaded layout sub-components (will be created in Track B)
// For now, render lightweight placeholders that compile
import { MegaMenu } from './MegaMenu';
import { LandingFooter } from './LandingFooter';
import { FloatingCTA } from './FloatingCTA';
import { SmoothScroll } from './SmoothScroll';
import { CustomCursor } from './CustomCursor';

/**
 * Hook: sets document <title> and <meta description> based on current route
 */
function useLandingSEO() {
  const location = useLocation();
  const { i18n } = useTranslation();
  const isEs = i18n.language === 'es' || i18n.language === 'ca';

  useEffect(() => {
    const meta = landingPagesMeta.find(m => m.path === location.pathname);
    if (meta) {
      document.title = isEs ? meta.titleEs : meta.titleEn;
      const descTag = document.querySelector('meta[name="description"]');
      const desc = isEs ? meta.descriptionEs : meta.descriptionEn;
      if (descTag) {
        descTag.setAttribute('content', desc);
      } else {
        const newMeta = document.createElement('meta');
        newMeta.name = 'description';
        newMeta.content = desc;
        document.head.appendChild(newMeta);
      }
    }
  }, [location.pathname, isEs]);
}

export function LandingLayout() {
  useLandingSEO();

  return (
    <SmoothScroll>
      <div className="landing-page">
        <CustomCursor />
        <MegaMenu />
        <main>
          <Outlet />
        </main>
        <LandingFooter />
        <FloatingCTA />
      </div>
    </SmoothScroll>
  );
}
