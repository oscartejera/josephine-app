import { useState, useEffect, useRef, Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { DemoModeProvider } from "@/contexts/DemoModeContext";
import { AppProvider } from "@/contexts/AppContext";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { RouteErrorBoundary } from "@/components/ui/RouteErrorBoundary";
import { InsightErrorBoundary } from "@/components/InsightErrorBoundary";
import { OfflineBanner } from "@/components/OfflineBanner";
import { GlobalErrorBoundary } from "@/components/errors/GlobalErrorBoundary";
import { CookieConsentBanner } from "@/components/gdpr/CookieConsentBanner";
import { markRouteStart, markRouteEnd } from "@/utils/performanceMonitor";

// Auth pages loaded eagerly (first screen the user sees)
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import ResetPassword from "@/pages/ResetPassword";
import NotFound from "@/pages/NotFound";

// Landing pages — lazy loaded (marketing, only for unauthenticated visitors)
const LandingPage = lazy(() => import("@/pages/LandingPage"));
import { LandingLayout } from '@/components/landing/LandingLayout';

// Product pages
const ProductBI = lazy(() => import('@/pages/landing/ProductBI'));
const ProductInventory = lazy(() => import('@/pages/landing/ProductInventory'));
const ProductWorkforce = lazy(() => import('@/pages/landing/ProductWorkforce'));
const ProductPayroll = lazy(() => import('@/pages/landing/ProductPayroll'));
// Solution pages
const SolutionIndependent = lazy(() => import('@/pages/landing/SolutionIndependent'));
const SolutionFranchise = lazy(() => import('@/pages/landing/SolutionFranchise'));
const SolutionMultiLocation = lazy(() => import('@/pages/landing/SolutionMultiLocation'));
const SolutionEnterprise = lazy(() => import('@/pages/landing/SolutionEnterprise'));
// About / Resource pages
const AboutPage = lazy(() => import('@/pages/landing/AboutPage'));
const CareersPage = lazy(() => import('@/pages/landing/CareersPage'));
const PartnerPage = lazy(() => import('@/pages/landing/PartnerPage'));
const SuccessStoriesPage = lazy(() => import('@/pages/landing/SuccessStoriesPage'));
const BlogPage = lazy(() => import('@/pages/landing/BlogPage'));
// Conversion (isolated layout)
const BookAChatPage = lazy(() => import('@/pages/landing/BookAChatPage'));

// Layout components loaded eagerly
import { TeamLayout } from "@/components/team/TeamLayout";

// Pages — lazy loaded for code-splitting
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Insights = lazy(() => import("@/pages/Insights"));
const Sales = lazy(() => import("@/pages/Sales"));
const Labour = lazy(() => import("@/pages/Labour"));
const AdminTools = lazy(() => import("@/pages/AdminTools"));
const DataHealth = lazy(() => import("@/pages/DataHealth"));
const InstantPL = lazy(() => import("@/pages/InstantPL"));
const Reviews = lazy(() => import("@/pages/Reviews"));
const ReviewsAll = lazy(() => import("@/pages/ReviewsAll"));
const Scheduling = lazy(() => import("@/pages/Scheduling"));
const Availability = lazy(() => import("@/pages/Availability"));
const Inventory = lazy(() => import("@/pages/Inventory"));
const InventoryLocation = lazy(() => import("@/pages/InventoryLocation"));
const InventoryLocationReconciliation = lazy(() => import("@/pages/InventoryLocationReconciliation"));
const InventoryReconciliation = lazy(() => import("@/pages/InventoryReconciliation"));
const Waste = lazy(() => import("@/pages/Waste"));
const Procurement = lazy(() => import("@/pages/Procurement"));
const ProcurementCart = lazy(() => import("@/pages/ProcurementCart"));
const ProcurementOrders = lazy(() => import("@/pages/ProcurementOrders"));
const MenuEngineering = lazy(() => import("@/pages/MenuEngineering"));
const CashManagement = lazy(() => import("@/pages/CashManagement"));
const Budgets = lazy(() => import("@/pages/Budgets"));
const Payroll = lazy(() => import("@/pages/Payroll"));
const SettingsPage = lazy(() => import("@/pages/SettingsPage"));
const OnboardingChecklist = lazy(() => import("@/pages/OnboardingChecklist"));
const Integrations = lazy(() => import("@/pages/Integrations"));
const SquareIntegration = lazy(() => import("@/pages/integrations/SquareIntegration"));
const LightspeedIntegration = lazy(() => import("@/pages/integrations/LightspeedIntegration"));
const SquareOAuthCallback = lazy(() => import("@/pages/integrations/SquareOAuthCallback"));
const InventoryItems = lazy(() => import("@/pages/inventory-setup/InventoryItems"));
const RecipesPage = lazy(() => import("@/pages/inventory-setup/RecipesPage"));
const RecipeDetailPage = lazy(() => import("@/pages/inventory-setup/RecipeDetailPage"));
const MenuItemsPage = lazy(() => import("@/pages/inventory-setup/MenuItemsPage"));
const WasteEntryPage = lazy(() => import("@/pages/operations/WasteEntryPage"));
const StockAuditPage = lazy(() => import("@/pages/operations/StockAuditPage"));
const PrepListPage = lazy(() => import("@/pages/operations/PrepListPage"));
const DebugDataCoherence = lazy(() => import("@/pages/DebugDataCoherence"));
const DataImport = lazy(() => import("@/pages/DataImport"));
const Pricing = lazy(() => import("@/pages/Pricing"));
const WorkforceTeam = lazy(() => import("@/pages/WorkforceTeam"));
const WorkforceTimesheet = lazy(() => import("@/pages/WorkforceTimesheet"));
const WorkforceOnboarding = lazy(() => import("@/pages/WorkforceOnboarding"));
const KioskMode = lazy(() => import("@/pages/KioskMode"));
const OnboardingWizardV2 = lazy(() => import("@/pages/OnboardingWizardV2"));
const PrivacyPolicy = lazy(() => import("@/pages/PrivacyPolicy"));
const Support = lazy(() => import("@/pages/Support"));

// Team (Employee Portal) — lazy loaded
const TeamHome = lazy(() => import("@/pages/team/TeamHome"));
const TeamSchedule = lazy(() => import("@/pages/team/TeamSchedule"));
const TeamClock = lazy(() => import("@/pages/team/TeamClock"));
const TeamPay = lazy(() => import("@/pages/team/TeamPay"));
const TeamDirectory = lazy(() => import("@/pages/team/TeamDirectory"));
const TeamNews = lazy(() => import("@/pages/team/TeamNews"));
const TeamProfile = lazy(() => import("@/pages/team/TeamProfile"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,     // 2 min — KPIs/dashboards stay fresh
      gcTime: 15 * 60 * 1000,       // 15 min — cache kept longer for offline resilience
      retry: 2,                      // 2 retries for network resilience
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
      refetchOnWindowFocus: false,   // avoid refetches on tab switch
      refetchOnReconnect: true,      // refetch when back online
    },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, profile } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Hard onboarding guard: user with no group must complete onboarding
  // (Nory-style: can't access dashboard without completing setup)
  if (profile && profile.group_id === null && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}

function ProtectedLayout() {
  const { roles, isOwner, loading } = useAuth();

  // If employee-only, redirect to team portal (they shouldn't see DashboardLayout)
  if (!loading) {
    const isEmployeeOnly = (roles.length > 0 && roles.every(r => r.role_name === 'employee'))
      || (roles.length === 0 && !isOwner);
    if (isEmployeeOnly) {
      return <Navigate to="/team" replace />;
    }
  }

  return (
    <AppProvider>
      <RouteErrorBoundary>
        <DashboardLayout />
      </RouteErrorBoundary>
    </AppProvider>
  );
}

function RoleRedirect() {
  const { roles, isOwner } = useAuth();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (roles.length > 0 || isOwner) {
      setReady(true);
    }
    // Fallback: if roles don't load in 2s, default to dashboard
    const timer = setTimeout(() => setReady(true), 2000);
    return () => clearTimeout(timer);
  }, [roles, isOwner]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Employee-only: redirect to Team Portal
  // If roles loaded and ALL are 'employee', OR if no roles and not owner → treat as employee
  const isEmployeeOnly = (roles.length > 0 && roles.every(r => r.role_name === 'employee'))
    || (roles.length === 0 && !isOwner);
  return <Navigate to={isEmployeeOnly ? '/team' : '/dashboard'} replace />;
}

function OwnerOnlyRoute({ children }: { children: React.ReactNode }) {
  const { isOwner, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!isOwner) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function PageLoader() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  );
}

function SectionLoader({ section }: { section: string }) {
  return (
    <div className="min-h-[40vh] flex flex-col items-center justify-center gap-2">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      <span className="text-sm text-muted-foreground">Cargando {section}…</span>
    </div>
  );
}

/** Tracks route changes and logs timing in dev mode */
function RoutePerformanceTracker() {
  const location = useLocation();
  const prevPath = useRef(location.pathname);

  useEffect(() => {
    if (prevPath.current !== location.pathname) {
      markRouteEnd(location.pathname);
      prevPath.current = location.pathname;
    }
    markRouteStart();
  }, [location.pathname]);

  return null;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <>
      <RoutePerformanceTracker />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={user ? <RoleRedirect /> : <Login />} />
          <Route path="/signup" element={user ? <RoleRedirect /> : <Signup />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          {/* ── Public Landing Pages (LandingLayout with MegaMenu + Footer) ── */}
          <Route element={user ? <RoleRedirect /> : <LandingLayout />}>
            <Route path="/" element={<Suspense fallback={<PageLoader />}><LandingPage /></Suspense>} />
            <Route path="/product/business-intelligence" element={<Suspense fallback={<PageLoader />}><ProductBI /></Suspense>} />
            <Route path="/product/inventory" element={<Suspense fallback={<PageLoader />}><ProductInventory /></Suspense>} />
            <Route path="/product/workforce-management" element={<Suspense fallback={<PageLoader />}><ProductWorkforce /></Suspense>} />
            <Route path="/product/payroll" element={<Suspense fallback={<PageLoader />}><ProductPayroll /></Suspense>} />
            <Route path="/solutions/independent-brands" element={<Suspense fallback={<PageLoader />}><SolutionIndependent /></Suspense>} />
            <Route path="/solutions/franchise-networks" element={<Suspense fallback={<PageLoader />}><SolutionFranchise /></Suspense>} />
            <Route path="/solutions/multi-location-brands" element={<Suspense fallback={<PageLoader />}><SolutionMultiLocation /></Suspense>} />
            <Route path="/solutions/enterprise-groups" element={<Suspense fallback={<PageLoader />}><SolutionEnterprise /></Suspense>} />
            <Route path="/about" element={<Suspense fallback={<PageLoader />}><AboutPage /></Suspense>} />
            <Route path="/careers" element={<Suspense fallback={<PageLoader />}><CareersPage /></Suspense>} />
            <Route path="/partner-program" element={<Suspense fallback={<PageLoader />}><PartnerPage /></Suspense>} />
            <Route path="/success-stories" element={<Suspense fallback={<PageLoader />}><SuccessStoriesPage /></Suspense>} />
            <Route path="/blog" element={<Suspense fallback={<PageLoader />}><BlogPage /></Suspense>} />
          </Route>

          {/* ── Isolated Conversion Pages (no MegaMenu/Footer) ── */}
          <Route path="/book-a-chat" element={<Suspense fallback={<PageLoader />}><BookAChatPage /></Suspense>} />

          <Route element={<ProtectedRoute><ProtectedLayout /></ProtectedRoute>}>
            <Route path="/dashboard" element={<Suspense fallback={<SectionLoader section="Dashboard" />}><Dashboard /></Suspense>} />
            <Route path="/control-tower" element={<Navigate to="/dashboard" replace />} />

            {/* Insights routes — per-section Suspense boundary */}
            <Route path="/insights" element={<Suspense fallback={<SectionLoader section="Insights" />}><Insights /></Suspense>} />
            <Route path="/insights/sales" element={<Suspense fallback={<SectionLoader section="Ventas" />}><InsightErrorBoundary pageName="Ventas"><Sales /></InsightErrorBoundary></Suspense>} />
            <Route path="/insights/labour" element={<Suspense fallback={<SectionLoader section="Personal" />}><InsightErrorBoundary pageName="Personal"><Labour /></InsightErrorBoundary></Suspense>} />
            <Route path="/insights/labour/:locationId" element={<Suspense fallback={<SectionLoader section="Personal" />}><InsightErrorBoundary pageName="Personal"><Labour /></InsightErrorBoundary></Suspense>} />
            <Route path="/insights/instant-pl" element={<Suspense fallback={<SectionLoader section="P&L" />}><InsightErrorBoundary pageName="P&L Instantáneo"><InstantPL /></InsightErrorBoundary></Suspense>} />
            <Route path="/insights/reviews" element={<Suspense fallback={<SectionLoader section="Reseñas" />}><Reviews /></Suspense>} />
            <Route path="/insights/reviews/all" element={<Suspense fallback={<SectionLoader section="Reseñas" />}><ReviewsAll /></Suspense>} />
            <Route path="/insights/inventory" element={<Suspense fallback={<SectionLoader section="Inventario" />}><InsightErrorBoundary pageName="Inventario"><Inventory /></InsightErrorBoundary></Suspense>} />
            <Route path="/insights/inventory/location/:locationId" element={<Suspense fallback={<SectionLoader section="Inventario" />}><InsightErrorBoundary pageName="Inventario"><InventoryLocation /></InsightErrorBoundary></Suspense>} />
            <Route path="/insights/inventory/location/:locationId/reconciliation" element={<Suspense fallback={<SectionLoader section="Inventario" />}><InventoryLocationReconciliation /></Suspense>} />
            <Route path="/insights/inventory/reconciliation" element={<Suspense fallback={<SectionLoader section="Inventario" />}><InventoryReconciliation /></Suspense>} />
            <Route path="/insights/waste" element={<Suspense fallback={<SectionLoader section="Merma" />}><Waste /></Suspense>} />
            <Route path="/insights/menu-engineering" element={<Suspense fallback={<SectionLoader section="Menú" />}><InsightErrorBoundary pageName="Rentabilidad del Menú"><MenuEngineering /></InsightErrorBoundary></Suspense>} />
            <Route path="/insights/cash-management" element={<Suspense fallback={<SectionLoader section="Caja" />}><InsightErrorBoundary pageName="Caja"><CashManagement /></InsightErrorBoundary></Suspense>} />
            <Route path="/insights/budgets" element={<Suspense fallback={<SectionLoader section="Presupuestos" />}><InsightErrorBoundary pageName="Presupuestos"><Budgets /></InsightErrorBoundary></Suspense>} />

            {/* Workforce & Operations — per-section Suspense boundary */}
            <Route path="/workforce/team" element={<Suspense fallback={<SectionLoader section="Equipo" />}><InsightErrorBoundary pageName="Equipo"><WorkforceTeam /></InsightErrorBoundary></Suspense>} />
            <Route path="/workforce/timesheet" element={<Suspense fallback={<SectionLoader section="Fichajes" />}><InsightErrorBoundary pageName="Fichajes"><WorkforceTimesheet /></InsightErrorBoundary></Suspense>} />
            <Route path="/workforce/onboarding" element={<Suspense fallback={<SectionLoader section="Onboarding" />}><InsightErrorBoundary pageName="Onboarding"><WorkforceOnboarding /></InsightErrorBoundary></Suspense>} />
            <Route path="/scheduling" element={<Suspense fallback={<SectionLoader section="Turnos" />}><InsightErrorBoundary pageName="Turnos"><Scheduling /></InsightErrorBoundary></Suspense>} />
            <Route path="/availability" element={<Suspense fallback={<SectionLoader section="Disponibilidad" />}><InsightErrorBoundary pageName="Disponibilidad"><Availability /></InsightErrorBoundary></Suspense>} />
            <Route path="/procurement" element={<Suspense fallback={<SectionLoader section="Compras" />}><InsightErrorBoundary pageName="Compras"><Procurement /></InsightErrorBoundary></Suspense>} />
            <Route path="/procurement/cart" element={<Suspense fallback={<SectionLoader section="Carrito" />}><InsightErrorBoundary pageName="Carrito"><ProcurementCart /></InsightErrorBoundary></Suspense>} />
            <Route path="/procurement/orders" element={<Suspense fallback={<SectionLoader section="Pedidos" />}><InsightErrorBoundary pageName="Pedidos"><ProcurementOrders /></InsightErrorBoundary></Suspense>} />
            <Route path="/payroll/*" element={<Suspense fallback={<SectionLoader section="Nóminas" />}><InsightErrorBoundary pageName="Nóminas"><Payroll /></InsightErrorBoundary></Suspense>} />

            {/* Integrations — Owner-only, per-section Suspense */}
            <Route path="/integrations" element={<Suspense fallback={<SectionLoader section="Integraciones" />}><OwnerOnlyRoute><InsightErrorBoundary pageName="Integraciones"><Integrations /></InsightErrorBoundary></OwnerOnlyRoute></Suspense>} />
            <Route path="/integrations/square" element={<Suspense fallback={<SectionLoader section="Square" />}><OwnerOnlyRoute><InsightErrorBoundary pageName="Square"><SquareIntegration /></InsightErrorBoundary></OwnerOnlyRoute></Suspense>} />
            <Route path="/integrations/square/callback" element={<Suspense fallback={<SectionLoader section="Square" />}><SquareOAuthCallback /></Suspense>} />
            <Route path="/integrations/lightspeed" element={<Suspense fallback={<SectionLoader section="Lightspeed" />}><OwnerOnlyRoute><InsightErrorBoundary pageName="Lightspeed"><LightspeedIntegration /></InsightErrorBoundary></OwnerOnlyRoute></Suspense>} />

            {/* Inventory Setup — per-section Suspense */}
            <Route path="/inventory-setup/items" element={<Suspense fallback={<SectionLoader section="Artículos" />}><InsightErrorBoundary pageName="Artículos"><InventoryItems /></InsightErrorBoundary></Suspense>} />
            <Route path="/inventory-setup/recipes" element={<Suspense fallback={<SectionLoader section="Recetas" />}><InsightErrorBoundary pageName="Recetas"><RecipesPage /></InsightErrorBoundary></Suspense>} />
            <Route path="/inventory-setup/recipes/:id" element={<Suspense fallback={<SectionLoader section="Receta" />}><InsightErrorBoundary pageName="Receta"><RecipeDetailPage /></InsightErrorBoundary></Suspense>} />
            <Route path="/inventory-setup/menu-items" element={<Suspense fallback={<SectionLoader section="Menú" />}><InsightErrorBoundary pageName="Carta del Menú"><MenuItemsPage /></InsightErrorBoundary></Suspense>} />

            {/* Operations — per-section Suspense */}
            <Route path="/operations/waste-entry" element={<Suspense fallback={<SectionLoader section="Merma" />}><InsightErrorBoundary pageName="Registro Merma"><WasteEntryPage /></InsightErrorBoundary></Suspense>} />
            <Route path="/operations/stock-audit" element={<Suspense fallback={<SectionLoader section="Stock" />}><InsightErrorBoundary pageName="Auditoría Stock"><StockAuditPage /></InsightErrorBoundary></Suspense>} />
            <Route path="/operations/prep-list" element={<Suspense fallback={<SectionLoader section="Prep List" />}><InsightErrorBoundary pageName="Prep List"><PrepListPage /></InsightErrorBoundary></Suspense>} />

            {/* Settings — Owner-only, per-section Suspense */}
            <Route path="/settings" element={<Suspense fallback={<SectionLoader section="Ajustes" />}><OwnerOnlyRoute><InsightErrorBoundary pageName="Ajustes"><SettingsPage /></InsightErrorBoundary></OwnerOnlyRoute></Suspense>} />
            <Route path="/admin/tools" element={<Suspense fallback={<SectionLoader section="Admin" />}><OwnerOnlyRoute><InsightErrorBoundary pageName="Admin Tools"><AdminTools /></InsightErrorBoundary></OwnerOnlyRoute></Suspense>} />
            <Route path="/admin/data-health" element={<Suspense fallback={<SectionLoader section="Data Health" />}><OwnerOnlyRoute><InsightErrorBoundary pageName="Data Health"><DataHealth /></InsightErrorBoundary></OwnerOnlyRoute></Suspense>} />
            <Route path="/debug/data-coherence" element={<Suspense fallback={<SectionLoader section="Debug" />}><OwnerOnlyRoute><InsightErrorBoundary pageName="Debug"><DebugDataCoherence /></InsightErrorBoundary></OwnerOnlyRoute></Suspense>} />
            <Route path="/settings/import" element={<Suspense fallback={<SectionLoader section="Importar" />}><OwnerOnlyRoute><InsightErrorBoundary pageName="Importar Datos"><DataImport /></InsightErrorBoundary></OwnerOnlyRoute></Suspense>} />
            <Route path="/settings/billing" element={<Suspense fallback={<SectionLoader section="Facturación" />}><OwnerOnlyRoute><InsightErrorBoundary pageName="Facturación"><Pricing /></InsightErrorBoundary></OwnerOnlyRoute></Suspense>} />
            <Route path="/settings/onboarding" element={<Suspense fallback={<SectionLoader section="Onboarding" />}><OwnerOnlyRoute><InsightErrorBoundary pageName="Onboarding"><OnboardingChecklist /></InsightErrorBoundary></OwnerOnlyRoute></Suspense>} />
            <Route path="/pricing" element={<Navigate to="/settings/billing" replace />} />
          </Route>

          {/* Team (Employee Portal) — per-section Suspense */}
          <Route element={<ProtectedRoute><AppProvider><RouteErrorBoundary><TeamLayout /></RouteErrorBoundary></AppProvider></ProtectedRoute>}>
            <Route path="/team" element={<Suspense fallback={<SectionLoader section="Portal" />}><TeamHome /></Suspense>} />
            <Route path="/team/schedule" element={<Suspense fallback={<SectionLoader section="Horarios" />}><TeamSchedule /></Suspense>} />
            <Route path="/team/clock" element={<Suspense fallback={<SectionLoader section="Fichaje" />}><TeamClock /></Suspense>} />
            <Route path="/team/pay" element={<Suspense fallback={<SectionLoader section="Nómina" />}><TeamPay /></Suspense>} />
            <Route path="/team/profile" element={<Suspense fallback={<SectionLoader section="Perfil" />}><TeamProfile /></Suspense>} />
            <Route path="/team/directory" element={<Suspense fallback={<SectionLoader section="Directorio" />}><TeamDirectory /></Suspense>} />
            <Route path="/team/news" element={<Suspense fallback={<SectionLoader section="Noticias" />}><TeamNews /></Suspense>} />
          </Route>

          {/* Kiosk Mode — fullscreen, no sidebar, auth-protected */}
          <Route
            path="/kiosk/:locationId"
            element={
              <ProtectedRoute>
                <AppProvider>
                  <Suspense fallback={<SectionLoader section="Kiosk" />}>
                    <KioskMode />
                  </Suspense>
                </AppProvider>
              </ProtectedRoute>
            }
          />

          {/* Onboarding Wizard v2 — fullscreen, no sidebar, auth-protected */}
          <Route
            path="/onboarding"
            element={
              <ProtectedRoute>
                <AppProvider>
                  <Suspense fallback={<SectionLoader section="Onboarding" />}>
                    <OnboardingWizardV2 />
                  </Suspense>
                </AppProvider>
              </ProtectedRoute>
            }
          />
          {/* Legal & Support (public) */}
          <Route path="/legal/privacy" element={<Suspense fallback={<SectionLoader section="Privacidad" />}><PrivacyPolicy /></Suspense>} />
          <Route path="/support" element={<Suspense fallback={<SectionLoader section="Soporte" />}><Support /></Suspense>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </>
  );
}

function App() {
  return (
    <GlobalErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AuthProvider>
            <DemoModeProvider>
              <BrowserRouter>
                <OfflineBanner />
                <AppRoutes />
                <CookieConsentBanner />
                <Toaster />
                <Sonner />
              </BrowserRouter>
            </DemoModeProvider>
          </AuthProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </GlobalErrorBoundary>
  );
}

export default App;
