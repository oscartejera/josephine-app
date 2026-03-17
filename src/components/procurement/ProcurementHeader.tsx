import { ChevronRight, MoreHorizontal } from 'lucide-react';
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
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

interface ProcurementHeaderProps {
  suppliers: Supplier[];
  selectedSupplierId: string;
  onSupplierChange: (id: string) => void;
  settingsSlot?: ReactNode;
}

export function ProcurementHeader({
  
  suppliers,
  selectedSupplierId,
  onSupplierChange,
  settingsSlot,
}: ProcurementHeaderProps) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">{t('procurement.ProcurementHeader.procurement')}</h1>
        <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
          <span>{t('procurement.ProcurementHeader.insights')}</span>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground">{t('procurement.ProcurementHeader.procurement1')}</span>
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
        
        {settingsSlot && <div className="hidden sm:block">{settingsSlot}</div>}
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>{t('procurement.ProcurementHeader.orderHistory')}</DropdownMenuItem>
            <DropdownMenuItem>{t('procurement.ProcurementHeader.manageSuppliers')}</DropdownMenuItem>
            <DropdownMenuItem>{t('procurement.ProcurementHeader.exportData')}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
