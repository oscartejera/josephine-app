import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AppProvider } from "@/contexts/AppContext";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

// Pages
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
import MenuEngineering from "@/pages/MenuEngineering";
import Integrations from "@/pages/Integrations";
import Payroll from "@/pages/Payroll";
import SettingsPage from "@/pages/SettingsPage";
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
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      
      <Route element={
        <ProtectedRoute>
          <AppProvider>
            <DashboardLayout />
          </AppProvider>
        </ProtectedRoute>
      }>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/sales" element={<Sales />} />
        <Route path="/labour" element={<Labour />} />
        <Route path="/labour/:locationId" element={<Labour />} />
        <Route path="/labor" element={<Navigate to="/labour" replace />} />
        <Route path="/instant-pl" element={<InstantPL />} />
        <Route path="/insights/reviews" element={<Reviews />} />
        <Route path="/insights/reviews/all" element={<ReviewsAll />} />
        <Route path="/scheduling" element={<Scheduling />} />
        <Route path="/availability" element={<Availability />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/inventory/location/:locationId" element={<InventoryLocation />} />
        <Route path="/inventory/location/:locationId/reconciliation" element={<InventoryLocationReconciliation />} />
        <Route path="/inventory/reconciliation" element={<InventoryReconciliation />} />
        <Route path="/waste" element={<Waste />} />
        <Route path="/procurement" element={<Procurement />} />
        <Route path="/procurement/cart" element={<ProcurementCart />} />
        <Route path="/menu-engineering" element={<MenuEngineering />} />
        <Route path="/integrations" element={<Integrations />} />
        <Route path="/payroll" element={<Payroll />} />
        <Route path="/payroll/:step" element={<Payroll />} />
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
        <AuthProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </AuthProvider>
        <Toaster />
        <Sonner />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
