import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { ChevronRight, MoreHorizontal, FileText, CreditCard, RotateCcw, Building2, Phone, Mail, CheckCircle } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface SupplierInfo {
  id: string;
  name: string;
  logo: string;
  contact: string;
  email: string;
  phone: string;
  ordersCount: number;
  invoicesCount: number;
  creditsCount: number;
  lastOrder?: string;
  status: 'active' | 'inactive' | 'pending';
}

const MOCK_SUPPLIERS: SupplierInfo[] = [
  { id: 'macro', name: 'Macro', logo: 'M', contact: 'John Smith', email: 'orders@macro.ie', phone: '+353 1 234 5678', ordersCount: 24, invoicesCount: 18, creditsCount: 2, lastOrder: 'Yesterday', status: 'active' },
  { id: 'sysco', name: 'Sysco Ireland', logo: 'S', contact: 'Sarah Johnson', email: 'sales@sysco.ie', phone: '+353 1 345 6789', ordersCount: 15, invoicesCount: 12, creditsCount: 1, lastOrder: '3 days ago', status: 'active' },
  { id: 'bidfood', name: 'Bidfood', logo: 'B', contact: 'Michael Brown', email: 'orders@bidfood.ie', phone: '+353 1 456 7890', ordersCount: 8, invoicesCount: 6, creditsCount: 0, lastOrder: '1 week ago', status: 'active' },
  { id: 'irish-papers', name: 'Irish Papers', logo: 'IP', contact: 'Emma Wilson', email: 'sales@irishpapers.ie', phone: '+353 1 567 8901', ordersCount: 5, invoicesCount: 4, creditsCount: 0, lastOrder: '2 weeks ago', status: 'active' },
  { id: 'lynas', name: 'Lynas Food Service', logo: 'L', contact: 'David Murphy', email: 'orders@lynas.ie', phone: '+353 1 678 9012', ordersCount: 12, invoicesCount: 10, creditsCount: 1, lastOrder: '4 days ago', status: 'active' },
  { id: 'manor-farm', name: 'Manor Farm', logo: 'MF', contact: 'Lisa O\'Brien', email: 'sales@manorfarm.ie', phone: '+353 1 789 0123', ordersCount: 6, invoicesCount: 5, creditsCount: 0, lastOrder: '5 days ago', status: 'active' },
];

export default function ProcurementOrders() {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<'place-order' | 'orders' | 'invoices' | 'credits'>('orders');
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  // Check if we came from a successful order placement
  useEffect(() => {
    if (location.state?.orderSuccess) {
      setShowSuccessToast(true);
      toast.success('Order sent to supplier!', {
        description: `Order ${location.state.orderId} has been submitted successfully.`,
        duration: 5000,
        icon: <CheckCircle className="h-5 w-5 text-success" />,
      });
      // Clear the state
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const getStatusBadge = (status: SupplierInfo['status']) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-success/10 text-success hover:bg-success/20">Active</Badge>;
      case 'inactive':
        return <Badge variant="secondary">Inactive</Badge>;
      case 'pending':
        return <Badge variant="outline" className="text-warning border-warning">Pending</Badge>;
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Procurement</h1>
          <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
            <span>Insights</span>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground">Suppliers & Orders</span>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Add Supplier</DropdownMenuItem>
              <DropdownMenuItem>Import Invoices</DropdownMenuItem>
              <DropdownMenuItem>Export Data</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList className="grid w-full grid-cols-4 max-w-[500px]">
          <TabsTrigger value="place-order" onClick={() => window.location.href = '/procurement'}>
            Place order
          </TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="credits">Credit notes</TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="mt-6">
          <div className="space-y-4">
            {MOCK_SUPPLIERS.map((supplier) => (
              <Card key={supplier.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
                        <span className="text-lg font-bold text-primary">{supplier.logo}</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-3">
                          <h3 className="text-lg font-semibold text-foreground">{supplier.name}</h3>
                          {getStatusBadge(supplier.status)}
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3.5 w-3.5" />
                            {supplier.contact}
                          </span>
                          <span className="flex items-center gap-1">
                            <Mail className="h-3.5 w-3.5" />
                            {supplier.email}
                          </span>
                          <span className="flex items-center gap-1">
                            <Phone className="h-3.5 w-3.5" />
                            {supplier.phone}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-center px-4">
                        <p className="text-2xl font-bold text-foreground">{supplier.ordersCount}</p>
                        <p className="text-xs text-muted-foreground">Orders</p>
                      </div>
                      <div className="text-center px-4 border-l border-border">
                        <p className="text-2xl font-bold text-foreground">{supplier.invoicesCount}</p>
                        <p className="text-xs text-muted-foreground">Invoices</p>
                      </div>
                      <div className="text-center px-4 border-l border-border">
                        <p className="text-2xl font-bold text-foreground">{supplier.creditsCount}</p>
                        <p className="text-xs text-muted-foreground">Credits</p>
                      </div>
                      <div className="flex gap-2 pl-4 border-l border-border">
                        <Button variant="outline" size="sm">
                          <FileText className="h-4 w-4 mr-2" />
                          View Orders
                        </Button>
                        <Button size="sm" onClick={() => window.location.href = `/procurement?supplier=${supplier.id}`}>
                          <RotateCcw className="h-4 w-4 mr-2" />
                          New Order
                        </Button>
                      </div>
                    </div>
                  </div>
                  {supplier.lastOrder && (
                    <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border">
                      Last order: {supplier.lastOrder}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="invoices" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Invoices
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-center py-8">
                Invoice management coming soon. Connect your accounting software to sync invoices automatically.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="credits" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Credit Notes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-center py-8">
                Credit note tracking coming soon. Request credits for damaged or incorrect deliveries.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
