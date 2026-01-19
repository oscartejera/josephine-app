import { corsHeaders } from './cors.ts';

/**
 * Safely log errors server-side without exposing details to clients
 */
export function logError(
  provider: string,
  context: string,
  error: unknown,
  metadata?: Record<string, unknown>
): void {
  console.error(`[POS_ERROR:${provider.toUpperCase()}]`, {
    context,
    error: error instanceof Error ? {
      message: error.message,
      stack: error.stack,
    } : error,
    timestamp: new Date().toISOString(),
    ...metadata,
  });
}

/**
 * Map internal errors to safe, generic error messages for clients
 */
export function getSafeErrorResponse(error: unknown): { message: string; code: string } {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    
    // Map common database errors to safe messages
    if (msg.includes('unique constraint') || msg.includes('duplicate key')) {
      return { message: 'Duplicate data detected', code: 'DUPLICATE_DATA' };
    }
    if (msg.includes('permission denied') || msg.includes('access denied')) {
      return { message: 'Access denied', code: 'FORBIDDEN' };
    }
    if (msg.includes('foreign key') || msg.includes('violates foreign key')) {
      return { message: 'Related data not found', code: 'REFERENCE_ERROR' };
    }
    if (msg.includes('not null') || msg.includes('cannot be null')) {
      return { message: 'Required data missing', code: 'MISSING_DATA' };
    }
    if (msg.includes('timeout') || msg.includes('timed out')) {
      return { message: 'Operation timed out', code: 'TIMEOUT' };
    }
    if (msg.includes('network') || msg.includes('connection')) {
      return { message: 'Connection error', code: 'CONNECTION_ERROR' };
    }
  }
  
  // Default generic message
  return { message: 'Operation failed. Please try again or contact support.', code: 'INTERNAL_ERROR' };
}

/**
 * Create a standardized error response for edge functions
 */
export function createErrorResponse(
  provider: string,
  context: string,
  error: unknown,
  metadata?: Record<string, unknown>
): Response {
  // Log full error details server-side
  logError(provider, context, error, metadata);
  
  // Return safe, generic error to client
  const safeError = getSafeErrorResponse(error);
  
  return new Response(
    JSON.stringify({ 
      error: safeError.message,
      error_code: safeError.code,
    }),
    { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  );
}
