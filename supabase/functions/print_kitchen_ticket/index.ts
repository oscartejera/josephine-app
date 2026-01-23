import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { logError, createErrorResponse } from "../_shared/error-handler.ts";

const PRINTNODE_API_URL = "https://api.printnode.com/printjobs";

// ESC/POS Command Constants
const ESC = '\x1B';
const GS = '\x1D';
const LF = '\x0A';

const COMMANDS = {
  INIT: ESC + '@',
  BOLD_ON: ESC + 'E\x01',
  BOLD_OFF: ESC + 'E\x00',
  DOUBLE_HEIGHT: GS + '!\x10',
  DOUBLE_SIZE: GS + '!\x30',
  NORMAL_SIZE: GS + '!\x00',
  UNDERLINE_ON: ESC + '-\x01',
  UNDERLINE_OFF: ESC + '-\x00',
  CENTER: ESC + 'a\x01',
  LEFT: ESC + 'a\x00',
  PARTIAL_CUT: GS + 'V\x01',
  FEED_LINES: (n: number) => ESC + 'd' + String.fromCharCode(n),
  BEEP: ESC + 'B\x03\x02',
};

const PAPER_WIDTH = 48;

interface PrintJobItem {
  name: string;
  qty: number;
  notes?: string;
  modifiers?: string[];
  rush?: boolean;
}

interface PrintJob {
  id: string;
  location_id: string;
  ticket_id: string;
  destination: 'kitchen' | 'bar' | 'prep';
  items_json: PrintJobItem[];
  status: string;
  created_at: string;
  tickets?: {
    table_name: string | null;
    server_id: string | null;
    notes: string | null;
  };
}

function repeat(char: string, count: number): string {
  return char.repeat(Math.max(0, count));
}

function getDestinationName(dest: string): string {
  switch (dest) {
    case 'kitchen': return 'COCINA';
    case 'bar': return 'BAR';
    case 'prep': return 'PREPARACIÓN';
    default: return dest.toUpperCase();
  }
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('es-ES', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false 
  });
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('es-ES', { 
    day: '2-digit', 
    month: '2-digit' 
  });
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 1) + '…';
}

function generateTicketESCPOS(job: PrintJob): string {
  const timestamp = new Date(job.created_at);
  const tableName = job.tickets?.table_name || 'Barra';
  
  let ticket = '';
  
  // Initialize
  ticket += COMMANDS.INIT;
  
  // Header - destination
  ticket += COMMANDS.CENTER;
  ticket += COMMANDS.DOUBLE_SIZE;
  ticket += COMMANDS.BOLD_ON;
  ticket += `█ ${getDestinationName(job.destination)} █${LF}`;
  ticket += COMMANDS.NORMAL_SIZE;
  ticket += COMMANDS.BOLD_OFF;
  ticket += repeat('═', PAPER_WIDTH) + LF;
  
  // Table and time
  ticket += COMMANDS.LEFT;
  ticket += COMMANDS.DOUBLE_HEIGHT;
  ticket += COMMANDS.BOLD_ON;
  const tableText = `Mesa: ${tableName}`;
  const timeText = formatTime(timestamp);
  const spacing = PAPER_WIDTH - tableText.length - timeText.length;
  ticket += tableText + repeat(' ', Math.max(1, spacing)) + timeText + LF;
  ticket += COMMANDS.NORMAL_SIZE;
  ticket += COMMANDS.BOLD_OFF;
  
  ticket += `Fecha: ${formatDate(timestamp)}${LF}`;
  ticket += repeat('─', PAPER_WIDTH) + LF + LF;
  
  // Items
  let hasRush = false;
  for (const item of job.items_json) {
    ticket += COMMANDS.DOUBLE_HEIGHT;
    ticket += COMMANDS.BOLD_ON;
    
    if (item.rush) {
      hasRush = true;
      ticket += '⚡ ';
    }
    
    ticket += `${item.qty}x ${truncate(item.name, PAPER_WIDTH - 5)}${LF}`;
    ticket += COMMANDS.NORMAL_SIZE;
    ticket += COMMANDS.BOLD_OFF;
    
    // Modifiers
    if (item.modifiers && item.modifiers.length > 0) {
      for (const mod of item.modifiers) {
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
    
    // Notes
    if (item.notes) {
      ticket += COMMANDS.UNDERLINE_ON;
      ticket += `  Nota: ${truncate(item.notes, PAPER_WIDTH - 8)}${LF}`;
      ticket += COMMANDS.UNDERLINE_OFF;
    }
    
    ticket += LF;
  }
  
  // Rush warning
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
  
  // Footer
  ticket += repeat('─', PAPER_WIDTH) + LF;
  ticket += COMMANDS.CENTER;
  ticket += `Ticket #${job.ticket_id.slice(-6).toUpperCase()}${LF}`;
  ticket += repeat('═', PAPER_WIDTH) + LF;
  
  // Feed and cut
  ticket += COMMANDS.FEED_LINES(4);
  ticket += COMMANDS.PARTIAL_CUT;
  
  // Beep for rush
  if (hasRush) {
    ticket += COMMANDS.BEEP;
  }
  
  return ticket;
}

function stringToBase64(str: string): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
  let binary = '';
  bytes.forEach(byte => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { printJobId } = await req.json();
    
    if (!printJobId) {
      return new Response(
        JSON.stringify({ error: "printJobId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Get the print job with ticket info
    const { data: job, error: jobError } = await supabase
      .from("pos_print_queue")
      .select(`
        *,
        tickets:ticket_id (
          table_name,
          server_id,
          notes
        )
      `)
      .eq("id", printJobId)
      .single();

    if (jobError || !job) {
      console.error("Print job not found:", jobError);
      return new Response(
        JSON.stringify({ error: "Print job not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Get printer configuration for this location and destination
    const { data: printerConfig, error: configError } = await supabase
      .from("printer_config")
      .select("printnode_printer_id, auto_print, is_active")
      .eq("location_id", job.location_id)
      .eq("destination", job.destination)
      .eq("is_active", true)
      .single();

    // 3. Get PrintNode API key for the group
    const { data: locationData } = await supabase
      .from("locations")
      .select("group_id")
      .eq("id", job.location_id)
      .single();

    if (!locationData) {
      return new Response(
        JSON.stringify({ error: "Location not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: credentials } = await supabase
      .from("printnode_credentials")
      .select("api_key_encrypted, is_active")
      .eq("group_id", locationData.group_id)
      .eq("is_active", true)
      .single();

    // If no printer config or credentials, mark as manual mode
    if (!printerConfig || !credentials || !printerConfig.auto_print) {
      console.log("No auto-print config, keeping in manual queue");
      return new Response(
        JSON.stringify({ 
          success: true, 
          mode: "manual",
          reason: !printerConfig ? "no_printer_config" : 
                  !credentials ? "no_printnode_credentials" : "auto_print_disabled"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Generate ESC/POS content
    const ticketContent = generateTicketESCPOS(job as PrintJob);
    const base64Content = stringToBase64(ticketContent);

    // 5. Send to PrintNode
    const printResponse = await fetch(PRINTNODE_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${btoa(credentials.api_key_encrypted + ":")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        printerId: parseInt(printerConfig.printnode_printer_id),
        title: `Comanda ${job.destination} - Mesa ${job.tickets?.table_name || 'Barra'}`,
        contentType: "raw_base64",
        content: base64Content,
        source: "Josephine POS",
      }),
    });

    if (!printResponse.ok) {
      const errorText = await printResponse.text();
      logError("printnode", "print_job", new Error(errorText), { printJobId, printerId: printerConfig.printnode_printer_id });
      
      // Update job with error
      await supabase
        .from("pos_print_queue")
        .update({ 
          status: "failed",
          print_attempts: (job.print_attempts || 0) + 1,
          last_error: errorText.slice(0, 255)
        })
        .eq("id", printJobId);

      return new Response(
        JSON.stringify({ error: "PrintNode error", details: errorText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const printResult = await printResponse.json();

    // 6. Update print job status
    await supabase
      .from("pos_print_queue")
      .update({ 
        status: "printed", 
        printed_at: new Date().toISOString(),
        printnode_job_id: String(printResult),
        print_attempts: (job.print_attempts || 0) + 1
      })
      .eq("id", printJobId);

    console.log("Print job sent successfully:", printResult);

    return new Response(
      JSON.stringify({ 
        success: true, 
        mode: "automatic",
        printnodeJobId: printResult
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    return createErrorResponse("print_kitchen_ticket", "process", error);
  }
});
