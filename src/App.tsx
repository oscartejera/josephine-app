import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { DemoModeProvider } from "@/contexts/DemoModeContext";
import { AppProvider } from "@/contexts/AppContext";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

// Pages - Nory-style AI Ops only
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import Dashboard from "@/pages/Dashboard";
import Insights from "@/pages/Insights";
import Sales from "@/pages/Sales";
import Labour from "@/pages/Labour";
import AdminTools from "@/pages/AdminTools";
import InstantPL from "@/pages/InstantPL";
import Reviews from "@/pages/Reviews";
import ReviewsAll from "@/pages/ReviewsAll";
import Scheduling from "@/pages/Scheduling";
import Availability from "@/pages/Availability";
import Inventory from "@/pages/Inventory";
import InventoryLocation from "@/pages/InventoryLocation";
import InventoryLocationReconciliation from "@/pages/InventoryLocationReconciliation";
import InventoryReconciliation from "@/pages/InventoryReconciliation";
import Waste from "@/pages/Waste";
import Procurement from "@/pages/Procurement";
import ProcurementCart from "@/pages/ProcurementCart";
import ProcurementOrders from "@/pages/ProcurementOrders";
import MenuEngineering from "@/pages/MenuEngineering";
import CashManagement from "@/pages/CashManagement";
import Budgets from "@/pages/Budgets";
import Payroll from "@/pages/Payroll";
import SettingsPage from "@/pages/SettingsPage";
import Integrations from "@/pages/Integrations";
import SquareIntegration from "@/pages/integrations/SquareIntegration";
import SquareOAuthCallback from "@/pages/integrations/SquareOAuthCallback";
import InventoryItems from "@/pages/inventory-setup/InventoryItems";
import ResetPassword from "@/pages/ResetPassword";
import NotFound from "@/pages/NotFound";
import DebugDataCoherence from "@/pages/DebugDataCoherence";

// Team (Employee Portal)
import { TeamLayout } from "@/components/team/TeamLayout";
import TeamHome from "@/pages/team/TeamHome";
import TeamSchedule from "@/pages/team/TeamSchedule";
import TeamClock from "@/pages/team/TeamClock";
import TeamPay from "@/pages/team/TeamPay";
import TeamDirectory from "@/pages/team/TeamDirectory";
import TeamNews from "@/pages/team/TeamNews";

const queryClient = new QueryClient();

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
      <DashboardLayout />
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
        
        {/* Settings */}
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/admin/tools" element={<AdminTools />} />
        <Route path="/debug/data-coherence" element={<DebugDataCoherence />} />
      </Route>

      {/* Team (Employee Portal) */}
      <Route element={<ProtectedRoute><AppProvider><TeamLayout /></AppProvider></ProtectedRoute>}>
        <Route path="/team" element={<TeamHome />} />
        <Route path="/team/schedule" element={<TeamSchedule />} />
        <Route path="/team/clock" element={<TeamClock />} />
        <Route path="/team/pay" element={<TeamPay />} />
        <Route path="/team/directory" element={<TeamDirectory />} />
        <Route path="/team/news" element={<TeamNews />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
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
