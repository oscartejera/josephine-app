/**
 * Kitchen Ticket Formatter for 80mm Thermal Printers (ESC/POS)
 * Generates ESC/POS commands optimized for Star, Epson, and compatible thermal printers
 */

export interface KitchenTicketItem {
  name: string;
  qty: number;
  modifiers?: string[];
  notes?: string;
  rush?: boolean;
}

export interface KitchenTicketData {
  destination: 'kitchen' | 'bar' | 'prep';
  tableName: string;
  tableNumber?: string;
  serverName?: string;
  ticketId: string;
  timestamp: Date;
  items: KitchenTicketItem[];
  ticketNotes?: string;
}

// ESC/POS Command Constants
const ESC = '\x1B';
const GS = '\x1D';
const LF = '\x0A';

// Printer commands
const COMMANDS = {
  INIT: ESC + '@',                    // Initialize printer
  BOLD_ON: ESC + 'E\x01',             // Bold on
  BOLD_OFF: ESC + 'E\x00',            // Bold off
  DOUBLE_HEIGHT: GS + '!\x10',        // Double height
  DOUBLE_WIDTH: GS + '!\x20',         // Double width
  DOUBLE_SIZE: GS + '!\x30',          // Double height + width
  NORMAL_SIZE: GS + '!\x00',          // Normal size
  UNDERLINE_ON: ESC + '-\x01',        // Underline on
  UNDERLINE_OFF: ESC + '-\x00',       // Underline off
  CENTER: ESC + 'a\x01',              // Center align
  LEFT: ESC + 'a\x00',                // Left align
  RIGHT: ESC + 'a\x02',               // Right align
  CUT: GS + 'V\x00',                  // Full cut
  PARTIAL_CUT: GS + 'V\x01',          // Partial cut
  FEED_LINES: (n: number) => ESC + 'd' + String.fromCharCode(n), // Feed n lines
  BEEP: ESC + 'B\x03\x02',            // Beep 3 times
};

// Paper width: 80mm = ~48 characters at standard font
const PAPER_WIDTH = 48;

/**
 * Repeat a character n times
 */
function repeat(char: string, count: number): string {
  return char.repeat(count);
}

/**
 * Center text within paper width
 */
function centerText(text: string, width: number = PAPER_WIDTH): string {
  if (text.length >= width) return text.slice(0, width);
  const padding = Math.floor((width - text.length) / 2);
  return repeat(' ', padding) + text;
}

/**
 * Format time in HH:MM format
 */
function formatTime(date: Date): string {
  return date.toLocaleTimeString('es-ES', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false 
  });
}

/**
 * Format date in DD/MM format
 */
function formatDate(date: Date): string {
  return date.toLocaleDateString('es-ES', { 
    day: '2-digit', 
    month: '2-digit' 
  });
}

/**
 * Get destination display name in Spanish
 */
function getDestinationName(dest: 'kitchen' | 'bar' | 'prep'): string {
  switch (dest) {
    case 'kitchen': return 'COCINA';
    case 'bar': return 'BAR';
    case 'prep': return 'PREPARACIÓN';
  }
}

/**
 * Truncate text to fit width with ellipsis
 */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 1) + '…';
}

/**
 * Generate ESC/POS commands for a kitchen ticket
 * Returns a string that can be sent directly to a thermal printer
 */
export function generateKitchenTicketESCPOS(data: KitchenTicketData): string {
  let ticket = '';
  
  // Initialize printer
  ticket += COMMANDS.INIT;
  
  // Header with destination - large and bold
  ticket += COMMANDS.CENTER;
  ticket += COMMANDS.DOUBLE_SIZE;
  ticket += COMMANDS.BOLD_ON;
  ticket += `█ ${getDestinationName(data.destination)} █${LF}`;
  ticket += COMMANDS.NORMAL_SIZE;
  ticket += COMMANDS.BOLD_OFF;
  ticket += repeat('═', PAPER_WIDTH) + LF;
  
  // Table and time info
  ticket += COMMANDS.LEFT;
  ticket += COMMANDS.DOUBLE_HEIGHT;
  ticket += COMMANDS.BOLD_ON;
  const tableText = `Mesa: ${data.tableName}`;
  const timeText = `${formatTime(data.timestamp)}`;
  const spacing = PAPER_WIDTH - tableText.length - timeText.length;
  ticket += tableText + repeat(' ', Math.max(1, spacing)) + timeText + LF;
  ticket += COMMANDS.NORMAL_SIZE;
  ticket += COMMANDS.BOLD_OFF;
  
  // Server name if available
  if (data.serverName) {
    ticket += `Camarero: ${data.serverName}${LF}`;
  }
  
  // Date
  ticket += `Fecha: ${formatDate(data.timestamp)}${LF}`;
  
  ticket += repeat('─', PAPER_WIDTH) + LF;
  ticket += LF;
  
  // Items section
  for (const item of data.items) {
    // Item name with quantity - bold and slightly larger
    ticket += COMMANDS.DOUBLE_HEIGHT;
    ticket += COMMANDS.BOLD_ON;
    
    // Rush indicator
    if (item.rush) {
      ticket += '⚡ ';
    }
    
    ticket += `${item.qty}x ${truncate(item.name, PAPER_WIDTH - 5)}${LF}`;
    ticket += COMMANDS.NORMAL_SIZE;
    ticket += COMMANDS.BOLD_OFF;
    
    // Modifiers - indented
    if (item.modifiers && item.modifiers.length > 0) {
      for (const mod of item.modifiers) {
        // Parse modifier type from text
        const modLower = mod.toLowerCase();
        let prefix = '  +';
        if (modLower.includes('sin') || modLower.includes('quitar')) {
          prefix = '  ✗';
        } else if (modLower.includes('cambiar') || modLower.includes('sustituir')) {
          prefix = '  ↔';
        }
        ticket += `${prefix} ${truncate(mod, PAPER_WIDTH - 4)}${LF}`;
      }
    }
    
    // Notes - indented and in different style
    if (item.notes) {
      ticket += COMMANDS.UNDERLINE_ON;
      ticket += `  Nota: ${truncate(item.notes, PAPER_WIDTH - 8)}${LF}`;
      ticket += COMMANDS.UNDERLINE_OFF;
    }
    
    ticket += LF;
  }
  
  // Rush items warning
  const hasRush = data.items.some(i => i.rush);
  if (hasRush) {
    ticket += repeat('─', PAPER_WIDTH) + LF;
    ticket += COMMANDS.CENTER;
    ticket += COMMANDS.DOUBLE_HEIGHT;
    ticket += COMMANDS.BOLD_ON;
    ticket += `⚡ ¡PEDIDO URGENTE! ⚡${LF}`;
    ticket += COMMANDS.NORMAL_SIZE;
    ticket += COMMANDS.BOLD_OFF;
    ticket += COMMANDS.LEFT;
  }
  
  // Ticket notes if any
  if (data.ticketNotes) {
    ticket += repeat('─', PAPER_WIDTH) + LF;
    ticket += `Notas: ${data.ticketNotes}${LF}`;
  }
  
  // Footer
  ticket += repeat('─', PAPER_WIDTH) + LF;
  ticket += COMMANDS.CENTER;
  ticket += `Ticket #${data.ticketId.slice(-6).toUpperCase()}${LF}`;
  ticket += repeat('═', PAPER_WIDTH) + LF;
  
  // Feed and cut
  ticket += COMMANDS.FEED_LINES(4);
  ticket += COMMANDS.PARTIAL_CUT;
  
  // Beep for rush orders
  if (hasRush) {
    ticket += COMMANDS.BEEP;
  }
  
  return ticket;
}

/**
 * Generate a plain text version for preview (no ESC/POS codes)
 */
export function generateKitchenTicketText(data: KitchenTicketData): string {
  let ticket = '';
  
  // Header
  ticket += repeat('═', PAPER_WIDTH) + '\n';
  ticket += centerText(`█ ${getDestinationName(data.destination)} █`) + '\n';
  ticket += repeat('═', PAPER_WIDTH) + '\n';
  
  // Table and time
  const tableText = `Mesa: ${data.tableName}`;
  const timeText = formatTime(data.timestamp);
  const spacing = PAPER_WIDTH - tableText.length - timeText.length;
  ticket += tableText + repeat(' ', Math.max(1, spacing)) + timeText + '\n';
  
  if (data.serverName) {
    ticket += `Camarero: ${data.serverName}\n`;
  }
  ticket += `Fecha: ${formatDate(data.timestamp)}\n`;
  
  ticket += repeat('─', PAPER_WIDTH) + '\n\n';
  
  // Items
  for (const item of data.items) {
    const rushMark = item.rush ? '⚡ ' : '';
    ticket += `${rushMark}${item.qty}x ${item.name}\n`;
    
    if (item.modifiers) {
      for (const mod of item.modifiers) {
        const modLower = mod.toLowerCase();
        let prefix = '  +';
        if (modLower.includes('sin') || modLower.includes('quitar')) {
          prefix = '  ✗';
        } else if (modLower.includes('cambiar')) {
          prefix = '  ↔';
        }
        ticket += `${prefix} ${mod}\n`;
      }
    }
    
    if (item.notes) {
      ticket += `  Nota: ${item.notes}\n`;
    }
    ticket += '\n';
  }
  
  // Rush warning
  if (data.items.some(i => i.rush)) {
    ticket += repeat('─', PAPER_WIDTH) + '\n';
    ticket += centerText('⚡ ¡PEDIDO URGENTE! ⚡') + '\n';
  }
  
  // Footer
  ticket += repeat('─', PAPER_WIDTH) + '\n';
  ticket += centerText(`Ticket #${data.ticketId.slice(-6).toUpperCase()}`) + '\n';
  ticket += repeat('═', PAPER_WIDTH) + '\n';
  
  return ticket;
}

/**
 * Convert ESC/POS string to Base64 for PrintNode API
 */
export function ticketToBase64(escposContent: string): string {
  // Use TextEncoder to handle any special characters
  const encoder = new TextEncoder();
  const bytes = encoder.encode(escposContent);
  
  // Convert to base64
  let binary = '';
  bytes.forEach(byte => {
    binary += String.fromCharCode(byte);
  });
  
  return btoa(binary);
}
