/**
 * Typed RPC — Zero-tolerance wrapper for Supabase RPC calls.
 *
 * Replaces `supabase.rpc(name, params)` with a typed function
 * that validates the response shape at runtime using Zod schemas.
 *
 * If the schema doesn't match, we get a loud error in dev +
 * a console.warn in production (with the raw data still returned
 * so the UI doesn't break for users).
 */

import { z, type ZodType } from 'zod';
import { supabase } from '@/integrations/supabase/client';

const isDev = import.meta.env.DEV;

interface TypedRpcOptions {
    /** If true, return null instead of throwing on Supabase error */
    softFail?: boolean;
}

/**
 * Call a Supabase RPC with compile-time + runtime type safety.
 *
 * @example
 * const data = await typedRpc('get_labour_kpis', LabourKpisSchema, params);
 * // data is fully typed as z.infer<typeof LabourKpisSchema>
 */
export async function typedRpc<T>(
    name: string,
    schema: ZodType<T>,
    params: Record<string, unknown>,
    options: TypedRpcOptions = {}
): Promise<T> {
    const { data, error } = await supabase.rpc(name, params);

    if (error) {
        console.error(`[typedRpc] ${name} error:`, error.message);
        if (options.softFail) return schema.parse(undefined);
        throw error;
    }

    // Validate response shape
    const parsed = schema.safeParse(data);
    if (!parsed.success) {
        const issues = parsed.error.issues
            .map(i => `  ${i.path.join('.')}: expected ${i.message}`)
            .join('\n');

        const msg = `[typedRpc] ${name} response SHAPE MISMATCH:\n${issues}`;

        if (isDev) {
            console.error(msg);
            console.error('[typedRpc] Raw data:', data);
        } else {
            console.warn(msg);
        }

        // In production, return raw data cast to T so UI doesn't break
        // In dev, throw so we catch it immediately
        if (isDev) {
            throw new RpcContractError(name, parsed.error);
        }
        return data as T;
    }

    return parsed.data;
}

/**
 * Call a Supabase RPC that returns an array.
 */
export async function typedRpcArray<T>(
    name: string,
    itemSchema: ZodType<T>,
    params: Record<string, unknown>,
    options: TypedRpcOptions = {}
): Promise<T[]> {
    return typedRpc(name, z.array(itemSchema), params, options);
}

/**
 * Error thrown when RPC response doesn't match the declared schema.
 * Only thrown in development mode.
 */
export class RpcContractError extends Error {
    constructor(
        public rpcName: string,
        public zodError: z.ZodError
    ) {
        super(
            `RPC "${rpcName}" returned data that doesn't match its contract.\n` +
            `Fix the SQL function OR update the schema in rpc-contracts.ts.\n` +
            zodError.issues.map(i => `  ${i.path.join('.')}: ${i.message}`).join('\n')
        );
        this.name = 'RpcContractError';
    }
}
