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
import Sales from "@/pages/Sales";
import Labour from "@/pages/Labour";
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
import ResetPassword from "@/pages/ResetPassword";
import NotFound from "@/pages/NotFound";

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
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route path="/signup" element={user ? <Navigate to="/dashboard" replace /> : <Signup />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      
      <Route element={<ProtectedRoute><ProtectedLayout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<Dashboard />} />
        
        {/* Insights routes */}
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
        <Route path="/payroll" element={<Payroll />} />
        <Route path="/payroll/:step" element={<Payroll />} />
        
        {/* Integrations */}
        <Route path="/integrations" element={<Integrations />} />
        <Route path="/integrations/square" element={<SquareIntegration />} />
        
        {/* Settings */}
        <Route path="/settings" element={<SettingsPage />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <DemoModeProvider>
          <AuthProvider>
            <BrowserRouter>
              <AppRoutes />
              <Toaster />
              <Sonner />
            </BrowserRouter>
          </AuthProvider>
        </DemoModeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
