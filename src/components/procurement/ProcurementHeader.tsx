import { ChevronRight, Settings, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Supplier } from '@/hooks/useProcurementData';

interface ProcurementHeaderProps {
  suppliers: Supplier[];
  selectedSupplierId: string;
  onSupplierChange: (id: string) => void;
}

export function ProcurementHeader({
  suppliers,
  selectedSupplierId,
  onSupplierChange,
}: ProcurementHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Procurement</h1>
        <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
          <span>Insights</span>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground">Procurement</span>
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        <Select value={selectedSupplierId} onValueChange={onSupplierChange}>
          <SelectTrigger className="w-[140px] bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {suppliers.map(s => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <Button variant="outline" size="sm" className="hidden sm:flex">
          <Settings className="h-4 w-4 mr-2" />
          Settings
        </Button>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>Order History</DropdownMenuItem>
            <DropdownMenuItem>Manage Suppliers</DropdownMenuItem>
            <DropdownMenuItem>Export Data</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
