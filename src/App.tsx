import { useState, useEffect, Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { DemoModeProvider } from "@/contexts/DemoModeContext";
import { AppProvider } from "@/contexts/AppContext";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { RouteErrorBoundary } from "@/components/ui/RouteErrorBoundary";

// Auth pages loaded eagerly (first screen the user sees)
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import ResetPassword from "@/pages/ResetPassword";
import NotFound from "@/pages/NotFound";

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
const Integrations = lazy(() => import("@/pages/Integrations"));
const SquareIntegration = lazy(() => import("@/pages/integrations/SquareIntegration"));
const SquareOAuthCallback = lazy(() => import("@/pages/integrations/SquareOAuthCallback"));
const InventoryItems = lazy(() => import("@/pages/inventory-setup/InventoryItems"));
const RecipesPage = lazy(() => import("@/pages/inventory-setup/RecipesPage"));
const RecipeDetailPage = lazy(() => import("@/pages/inventory-setup/RecipeDetailPage"));
const WasteEntryPage = lazy(() => import("@/pages/operations/WasteEntryPage"));
const StockAuditPage = lazy(() => import("@/pages/operations/StockAuditPage"));
const DebugDataCoherence = lazy(() => import("@/pages/DebugDataCoherence"));

// Team (Employee Portal) — lazy loaded
const TeamHome = lazy(() => import("@/pages/team/TeamHome"));
const TeamSchedule = lazy(() => import("@/pages/team/TeamSchedule"));
const TeamClock = lazy(() => import("@/pages/team/TeamClock"));
const TeamPay = lazy(() => import("@/pages/team/TeamPay"));
const TeamDirectory = lazy(() => import("@/pages/team/TeamDirectory"));
const TeamNews = lazy(() => import("@/pages/team/TeamNews"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,     // 5 min — data considered fresh
      gcTime: 10 * 60 * 1000,       // 10 min — cache kept after unmount
      retry: 1,                      // single retry on failure
      refetchOnWindowFocus: false,   // avoid refetches on tab switch
    },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

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

  return <>{children}</>;
}

function ProtectedLayout() {
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

  const isEmployeeOnly = roles.length > 0 && roles.every(r => r.role_name === 'employee');
  return <Navigate to={isEmployeeOnly ? '/team' : '/dashboard'} replace />;
}

function PageLoader() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  );
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
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={user ? <RoleRedirect /> : <Login />} />
        <Route path="/signup" element={user ? <RoleRedirect /> : <Signup />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/" element={user ? <RoleRedirect /> : <Navigate to="/login" replace />} />

        <Route element={<ProtectedRoute><ProtectedLayout /></ProtectedRoute>}>
          <Route path="/dashboard" element={<Dashboard />} />

          {/* Insights routes */}
          <Route path="/insights" element={<Insights />} />
          <Route path="/insights/sales" element={<Sales />} />
          <Route path="/insights/labour" element={<Labour />} />
          <Route path="/insights/labour/:locationId" element={<Labour />} />
          <Route path="/insights/instant-pl" element={<InstantPL />} />
          <Route path="/insights/reviews" element={<Reviews />} />
          <Route path="/insights/reviews/all" element={<ReviewsAll />} />
          <Route path="/insights/inventory" element={<Inventory />} />
          <Route path="/insights/inventory/location/:locationId" element={<InventoryLocation />} />
          <Route path="/insights/inventory/location/:locationId/reconciliation" element={<InventoryLocationReconciliation />} />
          <Route path="/insights/inventory/reconciliation" element={<InventoryReconciliation />} />
          <Route path="/insights/waste" element={<Waste />} />
          <Route path="/insights/menu-engineering" element={<MenuEngineering />} />
          <Route path="/insights/cash-management" element={<CashManagement />} />
          <Route path="/insights/budgets" element={<Budgets />} />

          {/* Workforce & Operations */}
          <Route path="/scheduling" element={<Scheduling />} />
          <Route path="/availability" element={<Availability />} />
          <Route path="/procurement" element={<Procurement />} />
          <Route path="/procurement/cart" element={<ProcurementCart />} />
          <Route path="/procurement/orders" element={<ProcurementOrders />} />
          <Route path="/payroll/*" element={<Payroll />} />

          {/* Integrations */}
          <Route path="/integrations" element={<Integrations />} />
          <Route path="/integrations/square" element={<SquareIntegration />} />
          <Route path="/integrations/square/callback" element={<SquareOAuthCallback />} />

          {/* Inventory Setup */}
          <Route path="/inventory-setup/items" element={<InventoryItems />} />
          <Route path="/inventory-setup/recipes" element={<RecipesPage />} />
          <Route path="/inventory-setup/recipes/:id" element={<RecipeDetailPage />} />

          {/* Operations */}
          <Route path="/operations/waste-entry" element={<WasteEntryPage />} />
          <Route path="/operations/stock-audit" element={<StockAuditPage />} />

          {/* Settings */}
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/admin/tools" element={<AdminTools />} />
          <Route path="/admin/data-health" element={<DataHealth />} />
          <Route path="/debug/data-coherence" element={<DebugDataCoherence />} />
        </Route>

        {/* Team (Employee Portal) */}
        <Route element={<ProtectedRoute><AppProvider><RouteErrorBoundary><TeamLayout /></RouteErrorBoundary></AppProvider></ProtectedRoute>}>
          <Route path="/team" element={<TeamHome />} />
          <Route path="/team/schedule" element={<TeamSchedule />} />
          <Route path="/team/clock" element={<TeamClock />} />
          <Route path="/team/pay" element={<TeamPay />} />
          <Route path="/team/directory" element={<TeamDirectory />} />
          <Route path="/team/news" element={<TeamNews />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <DemoModeProvider>
            <BrowserRouter>
              <AppRoutes />
              <Toaster />
              <Sonner />
            </BrowserRouter>
          </DemoModeProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
