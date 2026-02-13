# Data Source Architecture

## Rule

All analytics hooks **must** be data-source-aware:

1. Include `dsUnified` in the React Query `queryKey`
2. Filter queries via one of:
   - `.eq('data_source_unified', dsUnified)` on a `v_*_unified` view
   - Calling a `*_unified` RPC that handles filtering internally
3. Never query sensitive tables directly without a data-source filter

### Sensitive tables

These tables contain **both demo and POS rows** and require unified filtering:

| Table | Unified view / RPC |
|-------|-------------------|
| `tickets` | — (use `v_pos_daily_finance_unified` for aggregates) |
| `ticket_lines` | — |
| `cogs_daily` | — |
| `labour_daily` | — |
| `product_sales_daily` | `v_product_sales_daily_unified` |
| `pos_daily_finance` | `v_pos_daily_finance_unified` |
| `facts_sales_15m` | `v_facts_sales_15m_unified` |
| `facts_item_mix_daily` | — |
| `facts_labor_daily` | — |
| `facts_inventory_daily` | — |
| `budgets_daily` | — |
| `cash_counts_daily` | — |
| `sales_daily_unified` | (legacy name, still sensitive) |

## Audit script

```bash
# Warn mode (lists offenders, exits 0)
npm run audit:ds

# Strict mode (exits 1 if offenders found)
npm run audit:ds:fail
```

The script scans `src/` for `.ts`/`.tsx` files querying sensitive tables via
`supabase.from('table')` and checks whether the file shows awareness of
`data_source_unified`, `dsUnified`, or uses a `*_unified` view/RPC.

## resolve_data_source RPC

The `resolve_data_source(p_org_id)` RPC is the single source of truth.
It returns:

```json
{
  "data_source": "pos" | "demo",
  "mode": "auto" | "manual",
  "reason": "<string>",
  "last_synced_at": "<timestamp> | null"
}
```

### Reason values

| Reason | Mode | Meaning |
|--------|------|---------|
| `auto_pos_recent` | auto | Active integration with sync < 24h |
| `auto_demo_no_sync` | auto | No active sync in last 24h |
| `manual_demo` | manual | User explicitly chose demo |
| `manual_pos_ok` | manual | User chose POS, sync is fresh |
| `manual_pos_blocked_integration_inactive` | manual | User chose POS but integration is not active |
| `manual_pos_blocked_never_synced` | manual | User chose POS, integration active but never synced |
| `manual_pos_blocked_sync_stale` | manual | User chose POS but sync is > 24h old |
