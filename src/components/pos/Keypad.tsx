/**
 * POS Keypad
 * Teclado numérico + DTO% / DTO€ / PREC / CLR / CAN
 */

import { Button } from '@/components/ui/button';
import { Percent, Euro, DollarSign, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KeypadProps {
  value: string;
  onChange: (value: string) => void;
  onAction: (action: 'DTO%' | 'DTO€' | 'PREC' | 'CLR' | 'CAN') => void;
  disabled?: boolean;
}

export function Keypad({ value, onChange, onAction, disabled }: KeypadProps) {
  const handleDigit = (digit: string) => {
    if (disabled) return;
    onChange(value + digit);
  };

  const handleClear = () => {
    onChange('');
  };

  const handleBackspace = () => {
    onChange(value.slice(0, -1));
  };

  return (
    <div className="grid grid-cols-4 gap-2">
      {/* Números 7-9 + DTO% */}
      <Button variant="outline" size="lg" onClick={() => handleDigit('7')} disabled={disabled}>
        7
      </Button>
      <Button variant="outline" size="lg" onClick={() => handleDigit('8')} disabled={disabled}>
        8
      </Button>
      <Button variant="outline" size="lg" onClick={() => handleDigit('9')} disabled={disabled}>
        9
      </Button>
      <Button 
        variant="secondary" 
        size="lg" 
        onClick={() => onAction('DTO%')}
        disabled={disabled}
        className="bg-amber-500 hover:bg-amber-600 text-white font-bold"
      >
        <Percent className="h-4 w-4 mr-1" />
        DTO%
      </Button>

      {/* Números 4-6 + DTO€ */}
      <Button variant="outline" size="lg" onClick={() => handleDigit('4')} disabled={disabled}>
        4
      </Button>
      <Button variant="outline" size="lg" onClick={() => handleDigit('5')} disabled={disabled}>
        5
      </Button>
      <Button variant="outline" size="lg" onClick={() => handleDigit('6')} disabled={disabled}>
        6
      </Button>
      <Button 
        variant="secondary" 
        size="lg" 
        onClick={() => onAction('DTO€')}
        disabled={disabled}
        className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
      >
        <Euro className="h-4 w-4 mr-1" />
        DTO€
      </Button>

      {/* Números 1-3 + CAN */}
      <Button variant="outline" size="lg" onClick={() => handleDigit('1')} disabled={disabled}>
        1
      </Button>
      <Button variant="outline" size="lg" onClick={() => handleDigit('2')} disabled={disabled}>
        2
      </Button>
      <Button variant="outline" size="lg" onClick={() => handleDigit('3')} disabled={disabled}>
        3
      </Button>
      <Button 
        variant="destructive" 
        size="lg" 
        onClick={() => onAction('CAN')}
        disabled={disabled}
        className="font-bold"
      >
        CAN
      </Button>

      {/* 0 + . + CLR + PREC */}
      <Button variant="outline" size="lg" onClick={() => handleDigit('0')} disabled={disabled}>
        0
      </Button>
      <Button variant="outline" size="lg" onClick={() => handleDigit('.')} disabled={disabled}>
        .
      </Button>
      <Button 
        variant="outline" 
        size="lg" 
        onClick={handleClear}
        disabled={disabled}
      >
        CLR
      </Button>
      <Button 
        variant="secondary" 
        size="lg" 
        onClick={() => onAction('PREC')}
        disabled={disabled}
        className="bg-blue-600 hover:bg-blue-700 text-white font-bold"
      >
        <DollarSign className="h-4 w-4 mr-1" />
        PREC
      </Button>
    </div>
  );
}
