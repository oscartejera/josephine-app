/**
 * RPC Health Check — Pillar 5
 *
 * Lightweight health check that validates every critical RPC
 * is reachable and returns the expected shape. Use in:
 *   1. App startup (warm check)
 *   2. Admin dashboard status page
 *   3. CI/CD smoke tests
 */

import { supabase } from '@/integrations/supabase/client';
import { RPC_REGISTRY } from './rpc-contracts';

export interface RpcHealthResult {
    name: string;
    status: 'ok' | 'error' | 'shape_mismatch';
    latencyMs: number;
    error?: string;
}

export interface HealthReport {
    timestamp: string;
    overall: 'healthy' | 'degraded' | 'down';
    rpcs: RpcHealthResult[];
}

/**
 * Default params for health probes — minimal date range, nullable location.
 * These should return data (or empty arrays) without errors.
 * Accepts dataSource to probe either 'demo' or 'pos' data.
 */
function buildHealthProbeParams(dataSource: 'pos' | 'demo' = 'pos'): Record<string, Record<string, unknown>> {
    const today = new Date().toISOString().slice(0, 10);
    return {
        get_labour_kpis: {
            date_from: today,
            date_to: today,
            selected_location_id: null,
            p_data_source: dataSource,
        },
        get_labour_timeseries: {
            date_from: today,
            date_to: today,
            selected_location_id: null,
            p_data_source: dataSource,
        },
        get_labour_locations_table: {
            date_from: today,
            date_to: today,
            selected_location_id: null,
            p_data_source: dataSource,
        },
        rpc_kpi_range_summary: {
            p_org_id: '00000000-0000-0000-0000-000000000000',
            p_location_ids: null,
            p_from: today,
            p_to: today,
        },
        get_sales_timeseries_unified: {
            p_org_id: '00000000-0000-0000-0000-000000000000',
            p_location_ids: [],
            p_from: today,
            p_to: today,
        },
        get_top_products_unified: {
            p_org_id: '00000000-0000-0000-0000-000000000000',
            p_location_ids: [],
            p_from: today,
            p_to: today,
            p_limit: 1,
        },
        get_instant_pnl_unified: {
            p_org_id: '00000000-0000-0000-0000-000000000000',
            p_location_ids: [],
            p_from: today,
            p_to: today,
        },
        menu_engineering_summary: {
            p_date_from: today,
            p_date_to: today,
            p_location_id: null,
            p_data_source: dataSource,
        },
    };
}

/**
 * Run health checks against all registered RPCs.
 * Returns a report with per-RPC status and overall health.
 * @param dataSource — probe 'pos' or 'demo' data (defaults to 'pos' for production safety)
 */
export async function checkRpcHealth(dataSource: 'pos' | 'demo' = 'pos'): Promise<HealthReport> {
    const results: RpcHealthResult[] = [];
    const probeParams = buildHealthProbeParams(dataSource);

    const entries = Object.entries(RPC_REGISTRY);

    await Promise.all(
        entries.map(async ([name, schema]) => {
            const params = probeParams[name];
            if (!params) {
                results.push({ name, status: 'error', latencyMs: 0, error: 'No probe params defined' });
                return;
            }

            const start = performance.now();
            try {
                const { data, error } = await (supabase.rpc as any)(name, params);
                const latencyMs = Math.round(performance.now() - start);

                if (error) {
                    results.push({ name, status: 'error', latencyMs, error: error.message });
                    return;
                }

                // Validate shape
                const parsed = schema.safeParse(data);
                if (!parsed.success) {
                    const issues = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
                    results.push({ name, status: 'shape_mismatch', latencyMs, error: issues });
                    return;
                }

                results.push({ name, status: 'ok', latencyMs });
            } catch (err: any) {
                const latencyMs = Math.round(performance.now() - start);
                results.push({ name, status: 'error', latencyMs, error: err.message });
            }
        })
    );

    const hasErrors = results.some(r => r.status === 'error');
    const hasMismatches = results.some(r => r.status === 'shape_mismatch');

    return {
        timestamp: new Date().toISOString(),
        overall: hasErrors ? 'down' : hasMismatches ? 'degraded' : 'healthy',
        rpcs: results.sort((a, b) => a.name.localeCompare(b.name)),
    };
}

/**
 * Log health check results to console.
 * Useful for startup diagnostics.
 */
export async function logRpcHealth(): Promise<void> {
    const report = await checkRpcHealth();
    const icon = report.overall === 'healthy' ? '✅' : report.overall === 'degraded' ? '⚠️' : '❌';

    console.log(`\n${icon} RPC Health: ${report.overall.toUpperCase()} (${report.timestamp})`);
    for (const rpc of report.rpcs) {
        const statusIcon = rpc.status === 'ok' ? '✓' : rpc.status === 'shape_mismatch' ? '△' : '✗';
        console.log(`  ${statusIcon} ${rpc.name} (${rpc.latencyMs}ms)${rpc.error ? ` — ${rpc.error}` : ''}`);
    }
    console.log('');
}
