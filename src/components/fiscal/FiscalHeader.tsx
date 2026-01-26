import { Receipt, Download, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface FiscalHeaderProps {
  selectedYear: number;
  selectedQuarter: number;
  onYearChange: (year: number) => void;
  onQuarterChange: (quarter: number) => void;
  onExport?: () => void;
  onGenerateModel303?: () => void;
}

export function FiscalHeader({
  selectedYear,
  selectedQuarter,
  onYearChange,
  onQuarterChange,
  onExport,
  onGenerateModel303,
}: FiscalHeaderProps) {
  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1];
  const quarters = [1, 2, 3, 4];

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Receipt className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fiscal</h1>
          <p className="text-sm text-muted-foreground">
            Gestión de IVA y declaraciones fiscales
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={selectedYear.toString()}
          onValueChange={(v) => onYearChange(parseInt(v))}
        >
          <SelectTrigger className="w-[100px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((year) => (
              <SelectItem key={year} value={year.toString()}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={selectedQuarter.toString()}
          onValueChange={(v) => onQuarterChange(parseInt(v))}
        >
          <SelectTrigger className="w-[80px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {quarters.map((q) => (
              <SelectItem key={q} value={q.toString()}>
                T{q}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button variant="outline" size="sm" onClick={onExport}>
          <Download className="mr-2 h-4 w-4" />
          Exportar
        </Button>

        <Button size="sm" onClick={onGenerateModel303}>
          <FileText className="mr-2 h-4 w-4" />
          Modelo 303
        </Button>
      </div>
    </div>
  );
}
